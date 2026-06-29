// Bulk Operations helpers pra Shopify GraphQL Admin API.
//
// Fluxo canônico de bulk mutation:
//   1. stagedUploadCreate  → recebe { url, resourceUrl, parameters } (S3-like)
//   2. uploadJsonlToStage  → POST multipart do .jsonl pra URL retornada
//   3. bulkOperationRunMutation → dispara a mutação massiva async
//   4. pollBulkOperation   → aguarda currentBulkOperation ficar COMPLETED
//   5. downloadBulkResult  → baixa o JSONL de saída e parseia
//
// Wrapper de alto nível: runBulkMutation(shop, token, mutation, items)
// Processa tudo de ponta-a-ponta e devolve { ok, fail, results, rawUrl }.
//
// Importante:
//   - Só 1 bulk mutation rodando por loja simultaneamente. A lib detecta e falha cedo.
//   - URLs de resultado expiram em 7 dias.
//   - Resultado NÃO retorna erro por linha no payload — precisa parsear o JSONL.

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { shopifyGraphQL, delay } from './shopify-api.mjs';

const STAGED_UPLOAD_MUTATION = `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets {
      url
      resourceUrl
      parameters { name value }
    }
    userErrors { field message }
  }
}`;

const BULK_MUTATION_RUN = `mutation bulkOperationRunMutation($mutation: String!, $stagedUploadPath: String!) {
  bulkOperationRunMutation(mutation: $mutation, stagedUploadPath: $stagedUploadPath) {
    bulkOperation { id status }
    userErrors { field message }
  }
}`;

const BULK_QUERY_RUN = `mutation bulkOperationRunQuery($query: String!) {
  bulkOperationRunQuery(query: $query) {
    bulkOperation { id status }
    userErrors { field message }
  }
}`;

const CURRENT_BULK_OP = `query currentBulkOperation($type: BulkOperationType!) {
  currentBulkOperation(type: $type) {
    id
    status
    errorCode
    createdAt
    completedAt
    objectCount
    fileSize
    url
    partialDataUrl
  }
}`;

const BULK_OP_BY_ID = `query bulkOperationById($id: ID!) {
  node(id: $id) {
    ... on BulkOperation {
      id
      status
      errorCode
      createdAt
      completedAt
      objectCount
      fileSize
      url
      partialDataUrl
    }
  }
}`;

/**
 * Cria 1+ staged uploads. Retorna os targets (url, resourceUrl, parameters).
 * @param {string} shop
 * @param {string} token
 * @param {Array<{filename: string, mimeType: string, fileSize?: string, resource?: string, httpMethod?: string}>} inputs
 */
export async function stagedUploadCreate(shop, token, inputs) {
  const normalized = inputs.map(i => ({
    filename: i.filename,
    mimeType: i.mimeType || 'text/jsonl',
    resource: i.resource || 'BULK_MUTATION_VARIABLES',
    httpMethod: i.httpMethod || 'POST',
    ...(i.fileSize ? { fileSize: String(i.fileSize) } : {}),
  }));
  const r = await shopifyGraphQL(shop, token, STAGED_UPLOAD_MUTATION, { input: normalized });
  const errs = r.data?.stagedUploadsCreate?.userErrors || [];
  if (errs.length) {
    throw new Error(`stagedUploadsCreate userErrors: ${JSON.stringify(errs)}`);
  }
  const targets = r.data?.stagedUploadsCreate?.stagedTargets || [];
  if (!targets.length) {
    throw new Error(`stagedUploadsCreate retornou 0 targets — response: ${JSON.stringify(r).slice(0, 400)}`);
  }
  return targets;
}

/**
 * POST multipart do JSONL pra URL retornada pelo stagedUploadsCreate.
 * Devolve o "key" do parameters (é esse valor que vira `stagedUploadPath`).
 * @param {{url: string, parameters: Array<{name:string,value:string}>}} target
 * @param {string} jsonlContent
 */
export async function uploadJsonlToStage(target, jsonlContent) {
  const { url, parameters } = target;
  const buf = Buffer.from(jsonlContent, 'utf8');
  const boundary = '----LeverBulk' + Math.random().toString(36).slice(2);
  const crlf = '\r\n';

  const parts = [];
  for (const p of parameters) {
    parts.push(Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="${p.name}"${crlf}${crlf}${p.value}${crlf}`,
      'utf8'
    ));
  }
  parts.push(Buffer.from(
    `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="bulk.jsonl"${crlf}Content-Type: text/jsonl${crlf}${crlf}`,
    'utf8'
  ));
  parts.push(buf);
  parts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf8'));
  const body = Buffer.concat(parts);

  const u = new URL(url);
  const lib = u.protocol === 'http:' ? http : https;

  await new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve();
        reject(new Error(`Upload stage falhou ${res.statusCode}: ${b.slice(0, 400)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const keyParam = parameters.find(p => p.name === 'key');
  if (!keyParam) throw new Error(`Parameters sem "key" — não há stagedUploadPath. Got: ${JSON.stringify(parameters)}`);
  return keyParam.value;
}

/**
 * Dispara bulkOperationRunMutation com uma mutação + path do upload.
 * @param {string} shop
 * @param {string} token
 * @param {string} mutation - GraphQL mutation string
 * @param {string} stagedUploadPath - valor do `key` retornado pelo upload
 */
export async function bulkOperationRunMutation(shop, token, mutation, stagedUploadPath) {
  const r = await shopifyGraphQL(shop, token, BULK_MUTATION_RUN, { mutation, stagedUploadPath });
  const errs = r.data?.bulkOperationRunMutation?.userErrors || [];
  if (errs.length) {
    throw new Error(`bulkOperationRunMutation userErrors: ${JSON.stringify(errs)}`);
  }
  const op = r.data?.bulkOperationRunMutation?.bulkOperation;
  if (!op) throw new Error(`bulkOperationRunMutation sem bulkOperation: ${JSON.stringify(r).slice(0, 400)}`);
  return op;
}

/**
 * Dispara bulkOperationRunQuery (para exportação massiva de dados).
 * @param {string} shop
 * @param {string} token
 * @param {string} query - GraphQL query string
 */
export async function bulkOperationRunQuery(shop, token, query) {
  const r = await shopifyGraphQL(shop, token, BULK_QUERY_RUN, { query });
  const errs = r.data?.bulkOperationRunQuery?.userErrors || [];
  if (errs.length) {
    throw new Error(`bulkOperationRunQuery userErrors: ${JSON.stringify(errs)}`);
  }
  const op = r.data?.bulkOperationRunQuery?.bulkOperation;
  if (!op) throw new Error(`bulkOperationRunQuery sem bulkOperation: ${JSON.stringify(r).slice(0, 400)}`);
  return op;
}

/**
 * Consulta a bulk operation corrente (ou por id).
 * @param {string} shop
 * @param {string} token
 * @param {{id?: string, type?: 'MUTATION'|'QUERY'}} opts
 */
export async function getBulkOperation(shop, token, opts = {}) {
  if (opts.id) {
    const r = await shopifyGraphQL(shop, token, BULK_OP_BY_ID, { id: opts.id });
    return r.data?.node || null;
  }
  const type = opts.type || 'MUTATION';
  const r = await shopifyGraphQL(shop, token, CURRENT_BULK_OP, { type });
  return r.data?.currentBulkOperation || null;
}

/**
 * Polla até a operation entrar em estado terminal.
 * Terminal states: COMPLETED, FAILED, EXPIRED, CANCELED.
 * @param {string} shop
 * @param {string} token
 * @param {string} operationId
 * @param {{interval?: number, timeout?: number, onTick?: function}} [opts]
 */
export async function pollBulkOperation(shop, token, operationId, opts = {}) {
  const interval = opts.interval ?? 2000;
  const timeout = opts.timeout ?? 10 * 60 * 1000; // 10 min
  const onTick = opts.onTick || (() => {});
  const terminal = new Set(['COMPLETED', 'FAILED', 'EXPIRED', 'CANCELED']);
  const started = Date.now();
  while (true) {
    const op = await getBulkOperation(shop, token, { id: operationId });
    if (!op) throw new Error(`Bulk operation ${operationId} não encontrada`);
    onTick(op);
    if (terminal.has(op.status)) return op;
    if (Date.now() - started > timeout) {
      throw new Error(`Bulk operation ${operationId} timeout após ${timeout}ms — last status: ${op.status}`);
    }
    await delay(interval);
  }
}

/**
 * Baixa o JSONL de resultado de uma bulk operation. Retorna array de objetos parseados.
 * @param {string} url - url retornada no BulkOperation.url
 */
export async function downloadBulkResult(url) {
  if (!url) return [];
  const u = new URL(url);
  const lib = u.protocol === 'http:' ? http : https;
  const text = await new Promise((resolve, reject) => {
    lib.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadBulkResult(res.headers.location).then(
          (arr) => resolve(JSON.stringify({ __redirected: arr })),
          reject
        );
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download bulk result ${res.statusCode} em ${u.pathname}`));
      }
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
  // Se foi redirect, já veio parseado
  if (text.startsWith('{"__redirected"')) {
    return JSON.parse(text).__redirected;
  }
  const out = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed)); }
    catch { /* linha quebrada, ignora */ }
  }
  return out;
}

/**
 * Serializa items como JSONL (1 obj por linha). Cada item vira `{"input": <item>}` por padrão
 * (que é o formato esperado pela maioria das mutations).
 * @param {Array<object>} items
 * @param {{wrap?: 'input'|'none', key?: string}} [opts]
 */
export function toJsonl(items, opts = {}) {
  const wrap = opts.wrap ?? 'input';
  const key = opts.key ?? 'input';
  const lines = items.map(item => {
    const payload = wrap === 'none' ? item : { [key]: item };
    return JSON.stringify(payload);
  });
  return lines.join('\n') + '\n';
}

/**
 * Wrapper de alto nível: recebe mutation + array de items,
 * faz stage, upload, run, poll, download e retorna resultados parseados.
 *
 * @param {string} shop
 * @param {string} token
 * @param {string} mutation - ex: `mutation call($input: ProductInput!) { productUpdate(input: $input) { ... } }`
 * @param {Array<object>} items - variáveis por linha (cada item será envolvido em { input: item } por default)
 * @param {{jsonlOpts?: object, pollOpts?: object, onStage?: function, onPoll?: function}} [opts]
 * @returns {Promise<{ op: object, results: object[], fail: object[], ok: number, rawUrl: string }>}
 */
export async function runBulkMutation(shop, token, mutation, items, opts = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('runBulkMutation: items vazio');
  }
  // 1. Detecta bulk operation em andamento (só 1 por loja por vez)
  const current = await getBulkOperation(shop, token, { type: 'MUTATION' });
  if (current && !['COMPLETED', 'FAILED', 'EXPIRED', 'CANCELED'].includes(current.status)) {
    throw new Error(`Já há bulk mutation em ${current.status} (${current.id}) — aguarde ou cancele antes`);
  }

  // 2. Gera JSONL
  const jsonl = toJsonl(items, opts.jsonlOpts);
  const fileSize = Buffer.byteLength(jsonl, 'utf8');

  // 3. Staged upload
  const [target] = await stagedUploadCreate(shop, token, [{
    filename: 'bulk.jsonl',
    mimeType: 'text/jsonl',
    fileSize: String(fileSize),
    resource: 'BULK_MUTATION_VARIABLES',
    httpMethod: 'POST',
  }]);
  if (opts.onStage) opts.onStage(target);

  // 4. Upload físico
  const stagedUploadPath = await uploadJsonlToStage(target, jsonl);

  // 5. Dispara run
  const op = await bulkOperationRunMutation(shop, token, mutation, stagedUploadPath);

  // 6. Polla
  const finalOp = await pollBulkOperation(shop, token, op.id, {
    ...(opts.pollOpts || {}),
    onTick: opts.onPoll,
  });

  if (finalOp.status !== 'COMPLETED') {
    const tail = finalOp.partialDataUrl ? await downloadBulkResult(finalOp.partialDataUrl) : [];
    throw new Error(`Bulk operation ${finalOp.status} (errorCode=${finalOp.errorCode || 'n/a'}) — partial: ${tail.length} linhas`);
  }

  // 7. Baixa resultado
  const results = await downloadBulkResult(finalOp.url);

  // 8. Separa ok/fail. Cada linha do JSONL de saída tem __typename + campos do retorno da mutation.
  // Erros vêm dentro de userErrors[] (estrutura padrão).
  const fail = [];
  let ok = 0;
  for (const r of results) {
    const userErrors = r?.userErrors || [];
    // Alguns JSONL têm shape `{ "data": { <mutation>: { userErrors, ... } } }`
    const nested = r?.data && Object.values(r.data)[0];
    const nestedErrors = nested?.userErrors || [];
    const allErrors = [...userErrors, ...nestedErrors];
    if (allErrors.length > 0) {
      fail.push({ line: r, errors: allErrors });
    } else {
      ok++;
    }
  }

  return {
    op: finalOp,
    results,
    fail,
    ok,
    rawUrl: finalOp.url,
  };
}

/**
 * Wrapper de alto nível pra bulkOperationRunQuery (exportação massiva).
 * @param {string} shop
 * @param {string} token
 * @param {string} query - GraphQL query string (sem variables; usa connection.pageInfo auto)
 * @param {{pollOpts?: object, onPoll?: function}} [opts]
 * @returns {Promise<{ op: object, results: object[], rawUrl: string }>}
 */
export async function runBulkQuery(shop, token, query, opts = {}) {
  const current = await getBulkOperation(shop, token, { type: 'QUERY' });
  if (current && !['COMPLETED', 'FAILED', 'EXPIRED', 'CANCELED'].includes(current.status)) {
    throw new Error(`Já há bulk query em ${current.status} (${current.id}) — aguarde ou cancele antes`);
  }
  const op = await bulkOperationRunQuery(shop, token, query);
  const finalOp = await pollBulkOperation(shop, token, op.id, {
    ...(opts.pollOpts || {}),
    onTick: opts.onPoll,
  });
  if (finalOp.status !== 'COMPLETED') {
    throw new Error(`Bulk query ${finalOp.status} (errorCode=${finalOp.errorCode || 'n/a'})`);
  }
  const results = await downloadBulkResult(finalOp.url);
  return { op: finalOp, results, rawUrl: finalOp.url };
}

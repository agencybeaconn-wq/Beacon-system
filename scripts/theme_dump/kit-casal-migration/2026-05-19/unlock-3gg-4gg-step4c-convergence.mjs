// STEP 4c — Confirma convergência do cache do storefront
// Faz N fetches sequenciais da PDP e mede % de unlocked vs disabled

import https from 'https';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchUrl(res.headers.location.startsWith('http') ? res.headers.location : `https://${u.hostname}${res.headers.location}`));
        return;
      }
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const N = 10;
  const results = [];
  for (let i = 1; i <= N; i++) {
    const url = `https://mantosdoph.com.br/products/kit-casal-camisa-brasil-home-26-27-nike-torcedor?r=${i}&t=${Date.now()}&rnd=${Math.random().toString(36).slice(2)}`;
    const r = await fetchUrl(url);
    const m3 = r.body.match(/<input[^>]+name=["']kit-tam-masc-ui["'][^>]+value=["']3GG["'][^>]*>/i);
    const m4 = r.body.match(/<input[^>]+name=["']kit-tam-masc-ui["'][^>]+value=["']4GG["'][^>]*>/i);
    const f3 = r.body.match(/<input[^>]+name=["']kit-tam-fem-ui["'][^>]+value=["']3GG["'][^>]*>/i);
    const f4 = r.body.match(/<input[^>]+name=["']kit-tam-fem-ui["'][^>]+value=["']4GG["'][^>]*>/i);
    const m3d = m3 && /\bdisabled\b/.test(m3[0]);
    const m4d = m4 && /\bdisabled\b/.test(m4[0]);
    const f3d = f3 && /\bdisabled\b/.test(f3[0]);
    const f4d = f4 && /\bdisabled\b/.test(f4[0]);
    results.push({ size: r.body.length, m3d, m4d, f3d, f4d });
    console.log(`[${i}] size=${r.body.length}  masc3GG=${m3d ? 'D' : 'u'}  masc4GG=${m4d ? 'D' : 'u'}  fem3GG=${f3d ? 'D' : 'u'}  fem4GG=${f4d ? 'D' : 'u'}`);
    await new Promise(r => setTimeout(r, 800));
  }

  const passed = results.filter(r => !r.m3d && !r.m4d && r.f3d && r.f4d).length;
  console.log(`\nConvergência: ${passed}/${N} passaram critério (masc 3GG/4GG unlocked, fem 3GG/4GG locked)`);
  console.log(`Esperado: 100% após alguns minutos. Resultados parciais indicam cache convergindo.`);
})();

// Executable validation for code-blocks transfers
// Checks actual syntax/structure instead of claiming "validation OK"

export function validateLiquid(content) {
  const errors = [];

  // Balanced Liquid tags
  const ifOpens = (content.match(/\{%-?\s*if\b/g) || []).length;
  const ifCloses = (content.match(/\{%-?\s*endif\b/g) || []).length;
  if (ifOpens !== ifCloses) errors.push(`if/endif mismatch: ${ifOpens} opens, ${ifCloses} closes`);

  const forOpens = (content.match(/\{%-?\s*for\b/g) || []).length;
  const forCloses = (content.match(/\{%-?\s*endfor\b/g) || []).length;
  if (forOpens !== forCloses) errors.push(`for/endfor mismatch: ${forOpens} opens, ${forCloses} closes`);

  const caseOpens = (content.match(/\{%-?\s*case\b/g) || []).length;
  const caseCloses = (content.match(/\{%-?\s*endcase\b/g) || []).length;
  if (caseOpens !== caseCloses) errors.push(`case/endcase mismatch: ${caseOpens} opens, ${caseCloses} closes`);

  const captureOpens = (content.match(/\{%-?\s*capture\b/g) || []).length;
  const captureCloses = (content.match(/\{%-?\s*endcapture\b/g) || []).length;
  if (captureOpens !== captureCloses) errors.push(`capture/endcapture mismatch`);

  // image_url filter in already-complete CDN URLs (common bug)
  const badImageFilter = content.match(/https?:\/\/cdn\.shopify\.com[^"'\s]+\s*\|\s*image_url/);
  if (badImageFilter) errors.push(`image_url filter applied to complete CDN URL (line: ${badImageFilter[0].slice(0, 80)})`);

  return { valid: errors.length === 0, errors };
}

export function validateJS(content) {
  const errors = [];

  // Extract only JS inside <script> tags (if liquid file)
  const scriptBlocks = [...content.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const jsContent = scriptBlocks.length > 0 ? scriptBlocks.join('\n') : content;

  // Balanced braces (ignoring strings/comments is complex — rough count)
  const stripped = jsContent
    .replace(/\/\/.*$/gm, '')           // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');  // strings

  const opens = (stripped.match(/\{/g) || []).length;
  const closes = (stripped.match(/\}/g) || []).length;
  if (opens !== closes) errors.push(`JS braces unbalanced: ${opens} { vs ${closes} }`);

  const parenOpens = (stripped.match(/\(/g) || []).length;
  const parenCloses = (stripped.match(/\)/g) || []).length;
  if (parenOpens !== parenCloses) errors.push(`JS parens unbalanced: ${parenOpens} ( vs ${parenCloses} )`);

  // Orphaned "});" at end of file (common bug from deleting code)
  const trailingOrphan = /\}\s*\)\s*;\s*<\/script>/.test(jsContent);
  // Only flag if also unbalanced
  if (trailingOrphan && opens !== closes) errors.push(`orphaned }); found — likely from incomplete code removal`);

  return { valid: errors.length === 0, errors };
}

export function validateLeverPitfalls(content, file) {
  const errors = [];

  // Pitfall 1: <a href="/checkout"> in password-protected stores silently fails
  // Recommend <button type="submit" name="checkout" form="...">
  if (file.includes('cart-drawer') || file.includes('main-cart-footer')) {
    const anchorCheckout = /<a[^>]+href="\/checkout"/.test(content);
    const buttonSubmit = /<button[^>]+name="checkout"/.test(content);
    if (anchorCheckout && !buttonSubmit) {
      errors.push(`WARN: <a href="/checkout"> fails silently on password-protected stores — use <button type="submit" name="checkout">`);
    }
  }

  // Pitfall 2: extra "button" class on checkout link (conflicts with base.css)
  const buttonClassOnCheckout = /class="cart__checkout-button\s+button"/.test(content);
  if (buttonClassOnCheckout) {
    errors.push(`WARN: checkout button has extra "button" class — causes base.css conflict. Remove extra class.`);
  }

  // Pitfall 3: hardcoded icon render bypassing settings
  const hardcodedIcon = /\{%-?\s*render\s+['"]icon-(shirt|home|gift)['"]\s*-?%\}/g;
  const hardcodedMatches = content.match(hardcodedIcon) || [];
  if (hardcodedMatches.length > 0 && file.includes('progress-bar')) {
    errors.push(`WARN: hardcoded ${hardcodedMatches.length} icon render(s) in progress-bar — may ignore milestone_X_icon setting`);
  }

  // Pitfall 4: license check without encodeURIComponent
  if (file.includes('lever-protection')) {
    const unencoded = /eq\.'\s*\+\s*\w+\s*\+/.test(content);
    if (unencoded) errors.push(`WARN: license/shop concatenated in URL without encodeURIComponent — will fail for non-ASCII keys`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateAll(content, file) {
  const liquid = validateLiquid(content);
  const js = validateJS(content);
  const pitfalls = validateLeverPitfalls(content, file);

  return {
    valid: liquid.valid && js.valid && pitfalls.valid,
    errors: [...liquid.errors, ...js.errors, ...pitfalls.errors]
  };
}

// Schema diff for merge cirúrgico — compares block types in {% schema %} of source vs dest
export function schemaBlockDiff(sourceLiquid, destLiquid) {
  const source = extractSchema(sourceLiquid);
  const dest = extractSchema(destLiquid);

  if (!source) return { error: 'source schema block not found', missing: [], extra: [], conflicts: [] };
  if (!dest) return { error: 'dest schema block not found', missing: [], extra: [], conflicts: [] };

  const sourceBlocks = Array.isArray(source.blocks) ? source.blocks : [];
  const destBlocks = Array.isArray(dest.blocks) ? dest.blocks : [];

  const sourceMap = new Map(sourceBlocks.map(b => [b.type, b]));
  const destMap = new Map(destBlocks.map(b => [b.type, b]));

  const missing = [];
  const conflicts = [];
  for (const [type, block] of sourceMap) {
    if (!destMap.has(type)) {
      missing.push({ type, name: block.name });
    } else {
      const destBlock = destMap.get(type);
      const sSig = JSON.stringify(block.settings || []);
      const dSig = JSON.stringify(destBlock.settings || []);
      if (sSig !== dSig) {
        conflicts.push({
          type,
          name: block.name,
          sourceSettings: (block.settings || []).length,
          destSettings: (destBlock.settings || []).length
        });
      }
    }
  }

  const extra = [];
  for (const [type, block] of destMap) {
    if (!sourceMap.has(type)) extra.push({ type, name: block.name });
  }

  return { missing, extra, conflicts, error: null };
}

function extractSchema(liquidContent) {
  const match = liquidContent.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].replace(/\r\n/g, '\n'));
  } catch {
    return null;
  }
}

// Visual consistency check — finds hex/var colors inside CTA-related CSS selectors
// Use on bloco novo + cart-drawer/checkout do destino pra cross-check cores
export function scanCTAColors(content) {
  const findings = [];
  const lines = content.split(/\r?\n/);
  const ctaKeywords = /(checkout|\bcta\b|buy-button|cart__checkout|add-to-cart|\bbtn\b|product-form__submit)/i;
  const colorPattern = /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|var\(--[^)]+\))/g;

  let ctaContext = false;
  let ctaSelector = '';
  let depth = 0;

  lines.forEach((line, i) => {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    if (opens > 0 && ctaKeywords.test(line) && depth === 0) {
      ctaContext = true;
      ctaSelector = line.replace(/\s*\{.*$/, '').trim();
    }

    if (ctaContext) {
      const colors = line.match(colorPattern);
      if (colors) {
        for (const color of colors) {
          findings.push({ line: i + 1, color, selector: ctaSelector, raw: line.trim() });
        }
      }
    }

    depth += opens - closes;
    if (depth <= 0) { ctaContext = false; depth = 0; }
  });

  return findings;
}

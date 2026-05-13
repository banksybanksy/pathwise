// Inject GA4 gtag after <head> in all HTML files under application/
// Run: node application/scripts/inject-gtag-once.js (from repo) or cwd application
// Re-run safe: skips files that already contain the measurement ID.
const fs = require('fs');
const path = require('path');

const MEASUREMENT_ID = 'G-EJQBHDWYN8';

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

// First substantial child inside head (skip blank lines)
const RE = /(<head[^>]*>)\s*\r?\n(\s*)(?=<meta|<link|<title|<script|<style|<!)/i;

const applicationRoot = path.join(__dirname, '..');
const files = walk(applicationRoot);

for (const f of files) {
  let html = fs.readFileSync(f, 'utf8');
  if (html.includes(MEASUREMENT_ID)) {
    console.log('skip (already has tag)', path.relative(applicationRoot, f));
    continue;
  }
  const m = html.match(RE);
  if (!m) {
    console.warn('SKIP (no head match)', path.relative(applicationRoot, f));
    continue;
  }
  const indent = m[2];
  const block =
    `${indent}<!-- Google tag (gtag.js) -->\n` +
    `${indent}<script async src="https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"></script>\n` +
    `${indent}<script>\n` +
    `${indent}  window.dataLayer = window.dataLayer || [];\n` +
    `${indent}  function gtag(){dataLayer.push(arguments);}\n` +
    `${indent}  gtag('js', new Date());\n` +
    `${indent}  gtag('config', '${MEASUREMENT_ID}');\n` +
    `${indent}</script>\n`;

  const newHtml = html.replace(RE, (_, headTag, ind) => `${headTag}\n${block}${ind}`);
  if (newHtml === html) {
    console.warn('SKIP (replace failed)', path.relative(applicationRoot, f));
    continue;
  }
  fs.writeFileSync(f, newHtml, 'utf8');
  console.log('OK', path.relative(applicationRoot, f));
}

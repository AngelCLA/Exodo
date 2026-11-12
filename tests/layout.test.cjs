const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('style.css', 'utf8');
const manual = fs.readFileSync('docs/MANUAL_DE_USUARIO.md', 'utf8');
const design = fs.readFileSync('docs/DISENO_UI.md', 'utf8');

function desktopRule() {
  return css;
}

test('desktop sidebar uses viewport anchoring instead of sticky document flow', () => {
  const desktopCss = css.match(/@media \(min-width: 821px\)[\s\S]*$/)?.[0] || '';
  assert.match(desktopCss, /aside\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(desktopCss, /top:\s*0/);
  assert.match(desktopCss, /bottom:\s*0/);
  assert.doesNotMatch(desktopCss, /margin-top:\s*calc\(\s*-1\s*\*\s*var\(--header-h\)/);
  assert.match(desktopCss, /height:\s*100vh/);
  assert.match(desktopCss, /height:\s*100dvh/);
  assert.match(desktopCss, /overflow-y:\s*auto/);
});

test('desktop layout reserves matching sidebar width at every supported state', () => {
  assert.match(desktopRule(), /\.shell\s*\{[\s\S]*?margin-left:\s*216px/);
  assert.match(desktopRule(), /html\.sidebar-collapsed\s+\.shell\s*\{[\s\S]*?margin-left:\s*60px/);
  assert.match(desktopRule('1050'), /header\s*\{[\s\S]*?margin-left:\s*200px/);
  assert.match(desktopRule('1050'), /\.shell\s*\{[\s\S]*?margin-left:\s*200px/);
  assert.match(desktopRule('1050'), /html\.sidebar-collapsed\s+header\s*\{[\s\S]*?margin-left:\s*60px/);
  assert.match(desktopRule('1050'), /html\.sidebar-collapsed\s+\.shell\s*\{[\s\S]*?margin-left:\s*60px/);
});

test('narrow layout keeps sidebar in normal flow without global clipping', () => {
  const narrowCss = css.match(/@media \(max-width: 820px\)[\s\S]*$/)?.[0] || '';
  assert.match(narrowCss, /aside\s*\{[\s\S]*?position:\s*static/);
  assert.match(narrowCss, /aside\s*\{[\s\S]*?overflow:\s*visible/);
  assert.doesNotMatch(css.match(/body\s*\{[^}]*\}/)?.[0] || '', /overflow:\s*hidden/);
  assert.doesNotMatch(css.match(/html\s*\{[^}]*\}/)?.[0] || '', /overflow:\s*hidden/);
});

test('desktop guidance describes fixed sidebar and preserved page reachability', () => {
  assert.match(manual, /En escritorio[\s\S]*barra permanece fija/i);
  assert.match(design, /sidebar fija al viewport/i);
  assert.match(design, /El contenido crece si hace falta y la página desplaza/);
});

test('loading results use an animated skeleton that respects reduced motion', () => {
  assert.match(css, /\.results-skeleton\s*\{/);
  assert.match(css, /\.skeleton-row\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(css, /animation:\s*skeleton-shimmer/);
  assert.match(css, /@keyframes skeleton-shimmer/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none/);
  assert.match(design, /`.results-skeleton`/);
});

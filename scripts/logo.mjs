// Genera el logo de Coffee Break en todos los formatos que usa el sitio.
// Las letras se convierten a trazos con la tipografía Playfair Display, así el logo
// se ve igual en cualquier lugar (favicon, Google, WhatsApp, el panel) sin depender de fuentes.
// Uso: npm run logo   (solo hace falta al cambiar el diseño del logo)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IMG = join(ROOT, 'img');
mkdirSync(IMG, { recursive: true });

const fontFile = (w, s = 'normal') => {
  const buf = readFileSync(require.resolve(`@fontsource/playfair-display/files/playfair-display-latin-${w}-${s}.woff`));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const serif = fontFile(700);
const serifItalic = fontFile(600, 'italic');

const C = {
  espresso: '#2A1C16',
  caramel: '#C46A2B',
  cream: '#F7F0E6',
  peach: '#F1C7A5',
  white: '#FFFCF7',
  patch: '#D9822B',
};

const r2 = (n) => Math.round(n * 100) / 100;

// Texto a lo largo de un círculo. top=true: arco superior, se lee de izquierda a derecha.
function arcText(font, text, { cx, cy, r, size, tracking = 0, top = true }) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  const widths = glyphs.map((g) => g.advanceWidth * scale + tracking);
  const total = widths.reduce((a, b) => a + b, 0) - tracking;
  const span = total / r;
  let acc = 0;
  let d = '';
  glyphs.forEach((g, i) => {
    const w = widths[i] - tracking;
    const mid = acc + w / 2;
    acc += widths[i];
    const phi = -span / 2 + mid / r;
    const ang = top ? phi : -phi;
    const px = cx + r * Math.sin(phi);
    const py = top ? cy - r * Math.cos(phi) : cy + r * Math.cos(phi);
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const path = g.getPath(-w / 2, 0, size);
    const tf = (x, y) => [r2(px + x * cos - y * sin), r2(py + x * sin + y * cos)];
    for (const c of path.commands) {
      if (c.type === 'Z') { d += 'Z'; continue; }
      const [x, y] = tf(c.x, c.y);
      if (c.type === 'M' || c.type === 'L') d += `${c.type}${x} ${y}`;
      else if (c.type === 'Q') { const [x1, y1] = tf(c.x1, c.y1); d += `Q${x1} ${y1} ${x} ${y}`; }
      else if (c.type === 'C') { const [x1, y1] = tf(c.x1, c.y1); const [x2, y2] = tf(c.x2, c.y2); d += `C${x1} ${y1} ${x2} ${y2} ${x} ${y}`; }
    }
  });
  return d;
}

// Texto recto centrado en (x, y) (y = línea base)
function lineText(font, text, { x, y, size, tracking = 0, align = 'center' }) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  const total = glyphs.reduce((a, g) => a + g.advanceWidth * scale + tracking, 0) - tracking;
  let cursor = align === 'center' ? x - total / 2 : x;
  let d = '';
  for (const g of glyphs) {
    d += g.getPath(cursor, y, size).toPathData(2);
    cursor += g.advanceWidth * scale + tracking;
  }
  return { d, width: total };
}

// Isotipo: gato calicó asomado en una taza. Dibujado en una grilla de 120×120.
const MARK = `
  <g stroke="${C.espresso}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M52 30c-3-5 3-8 0-13M60 28c-3-5 3-8 0-13M68 30c-3-5 3-8 0-13" fill="none" stroke="${C.caramel}" stroke-width="2.6" opacity=".8"/>
    <path d="M35 64 37 36 52 47Z" fill="${C.espresso}"/>
    <path d="M85 64 83 36 68 47Z" fill="${C.white}"/>
    <path d="M82.5 41 70 47.5 84 58Z" fill="${C.patch}" stroke="none"/>
    <path d="M85 64 83 36 68 47" fill="none"/>
    <path d="M33 68c0-15 11-24 27-24s27 9 27 24Z" fill="${C.white}"/>
    <path d="M67 45.2c9 1.7 17 7.6 19.6 17.8L87 68H71c-4-7-6-15-4-22.8Z" fill="${C.patch}" stroke="none"/>
    <path d="M33 68c0-15 11-24 27-24s27 9 27 24" fill="none"/>
    <path d="M45.5 58.5q4-4.5 8 0M66.5 58.5q4-4.5 8 0" fill="none" stroke-width="2.8"/>
    <path d="M57.6 61.6h4.8L60 64.4Z" fill="${C.espresso}" stroke-width="1.6"/>
    <circle cx="44" cy="64.5" r="3.2" fill="${C.peach}" stroke="none"/>
    <circle cx="76" cy="64.5" r="3.2" fill="${C.peach}" stroke="none" opacity=".9"/>
    <path d="M24 68h72v8c0 16-15.5 28-36 28S24 92 24 76Z" fill="${C.espresso}"/>
    <path d="M96 73h4a10 10 0 0 1 0 20h-6.5" fill="none" stroke-width="5.5"/>
    <path d="M24 68h72" stroke="${C.caramel}" stroke-width="3.2"/>
    <ellipse cx="46" cy="68" rx="7.5" ry="4.6" fill="${C.white}" stroke-width="2.8"/>
    <ellipse cx="74" cy="68" rx="7.5" ry="4.6" fill="${C.white}" stroke-width="2.8"/>
    <path d="M54.6 83.6c0-3.4 4.3-4.1 5.4-1.3 1.1-2.8 5.4-2.1 5.4 1.3 0 3.3-5.4 6.4-5.4 6.4s-5.4-3.1-5.4-6.4Z" fill="${C.peach}" stroke="none"/>
  </g>`;

const svg = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Coffee Break">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${body}</svg>\n`;

// 1) Insignia circular (logo principal)
const S = 480, cx = S / 2, cy = S / 2;
const top = arcText(serif, 'COFFEE BREAK', { cx, cy, r: 176, size: 50, tracking: 7, top: true });
const bottom = arcText(serif, 'CAFÉ · RANCAGUA', { cx, cy, r: 196, size: 22, tracking: 7, top: false });
const badge = `
  <circle cx="${cx}" cy="${cy}" r="236" fill="${C.cream}"/>
  <circle cx="${cx}" cy="${cy}" r="226" fill="none" stroke="${C.espresso}" stroke-width="2.5"/>
  <circle cx="${cx}" cy="${cy}" r="219" fill="none" stroke="${C.espresso}" stroke-width="1" opacity=".5"/>
  <path d="${top}" fill="${C.caramel}"/>
  <path d="${bottom}" fill="${C.espresso}"/>
  <circle cx="${cx - 166}" cy="${cy + 64}" r="4" fill="${C.caramel}"/>
  <circle cx="${cx + 166}" cy="${cy + 64}" r="4" fill="${C.caramel}"/>
  <circle cx="${cx}" cy="${cy + 12}" r="118" fill="${C.peach}" opacity=".55"/>
  <g transform="translate(${cx - 124} ${cy - 118}) scale(2.07)">${MARK}</g>`;
writeFileSync(join(IMG, 'logo.svg'), svg(S, S, badge));

// 2) Isotipo solo (nav, favicon)
writeFileSync(join(IMG, 'logo-mark.svg'), svg(120, 120, MARK));

// 3) Logotipo horizontal para fondos oscuros y claros (isotipo + "Coffee Break")
function horizontal(ink, accent) {
  const word = lineText(serif, 'Coffee', { x: 132, y: 72, size: 58, align: 'left' });
  const word2 = lineText(serifItalic, 'Break', { x: 132 + word.width + 14, y: 72, size: 58, align: 'left' });
  const sub = lineText(serif, 'CAFÉ DE ESPECIALIDAD · RANCAGUA', { x: 134, y: 104, size: 13, tracking: 3.2, align: 'left' });
  const w = Math.ceil(Math.max(132 + word.width + 14 + word2.width, 134 + sub.width) + 8);
  return svg(w, 120, `<g transform="translate(4 2) scale(.95)">${MARK}</g>
    <path d="${word.d}" fill="${ink}"/><path d="${word2.d}" fill="${accent}"/><path d="${sub.d}" fill="${ink}" opacity=".72"/>`);
}
writeFileSync(join(IMG, 'logo-horizontal.svg'), horizontal(C.espresso, C.caramel));
writeFileSync(join(IMG, 'logo-horizontal-claro.svg'), horizontal(C.cream, '#E39A5E'));

// 4) Versiones en imagen (Google, redes, íconos del teléfono, panel)
const badgeBuf = Buffer.from(readFileSync(join(IMG, 'logo.svg')));
await sharp(badgeBuf, { density: 300 }).resize(800, 800).flatten({ background: C.cream }).jpeg({ quality: 90 }).toFile(join(IMG, 'logo.jpg'));
const markOnCream = Buffer.from(svg(120, 120, `<g transform="translate(12 10) scale(.8)">${MARK}</g>`, C.cream));
await sharp(markOnCream, { density: 600 }).resize(192, 192).png().toFile(join(IMG, 'icon-192.png'));
await sharp(markOnCream, { density: 600 }).resize(180, 180).png().toFile(join(IMG, 'apple-touch-icon.png'));
await sharp(markOnCream, { density: 600 }).resize(48, 48).png().toFile(join(IMG, 'favicon-48.png'));

console.log('✅ logo generado en img/ (svg, jpg y png)');

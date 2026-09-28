// Arma la web para publicar. Vercel lo ejecuta en cada cambio (ver vercel.json).
//  1. Lee tienda.config.json (lo define el desarrollador) y data/*.json (lo edita el cliente en /admin)
//  2. Junta data/productos/*.json y data/categorias/*.json en data/catalogo.json
//  3. Copia el sitio a dist/ reemplazando los %%MARCADORES%% y los bloques <!-- LISTA:... -->,
//     y genera canonical, Open Graph, datos estructurados, robots.txt y sitemap.xml
// Uso local: node scripts/build.mjs  →  servir la carpeta dist/
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = join(ROOT, 'data');
const DIST = join(ROOT, 'dist');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const readData = (file) => (existsSync(join(DATA, file)) ? readJson(join(DATA, file)) : {});

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'data'), { recursive: true });

// ---------- Fotos livianas ----------
// Las fotos subidas desde /admin se copian en WebP del ancho justo a dist/img/_opt/.
// El nombre lleva un hash del contenido: se guardan en caché y una foto reemplazada se ve al tiro.
// Las fotos que son enlaces (https://…) se usan tal cual. Si sharp no está instalado, se usan las originales.
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.warn('⚠️  sharp no está instalado (npm install): se usan las fotos originales'); }
const OPT = 'img/_opt';
const optimizadas = new Map();
function optimizar(src, ancho) {
  const path = String(src || '').replace(/^\//, '');
  if (/^https?:\/\//.test(path)) {
    // Enlaces de Unsplash: se pide el ancho justo al servidor de imágenes
    return Promise.resolve(/images\.unsplash\.com/.test(path) ? path.replace(/([?&])w=\d+/, `$1w=${ancho}`) : path);
  }
  if (!sharp || !/\.(jpe?g|png|webp)$/i.test(path) || !existsSync(join(ROOT, path))) return Promise.resolve(path);
  const key = `${path}@${ancho}`;
  if (!optimizadas.has(key)) {
    optimizadas.set(key, (async () => {
      try {
        const buf = readFileSync(join(ROOT, path));
        const out = `${OPT}/${createHash('sha1').update(buf).digest('hex').slice(0, 12)}-${ancho}.webp`;
        mkdirSync(join(DIST, OPT), { recursive: true });
        await sharp(buf).rotate().resize({ width: ancho, withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(DIST, out));
        return out;
      } catch (e) {
        console.warn(`⚠️  No se pudo optimizar ${path}: ${e.message}`);
        return path;
      }
    })());
  }
  return optimizadas.get(key);
}

// ---------- 1. Datos ----------
const config = readJson(join(ROOT, 'tienda.config.json'));
const ajustes = readData('ajustes.json');
const portada = readData('portada.json');
const secciones = readData('secciones.json');

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const rel = (p) => str(p).replace(/^\//, '');
const num = (v, def) => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : def);

const propio = config.site_url && !/\.vercel\.app/.test(config.site_url);
const SITE = (!propio && process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : config.site_url || 'http://localhost:5620').replace(/\/$/, '');

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_EN = { Lunes: 'Monday', Martes: 'Tuesday', 'Miércoles': 'Wednesday', Jueves: 'Thursday', Viernes: 'Friday', 'Sábado': 'Saturday', Domingo: 'Sunday' };
const horario = (Array.isArray(ajustes.horario) ? ajustes.horario : []).map((h) => ({
  dia: str(h.dia),
  abre: str(h.abre),
  cierra: str(h.cierra),
  cerrado: h.cerrado === true || !str(h.abre) || !str(h.cierra),
})).filter((h) => DIAS.includes(h.dia));

const T = {
  nombre: str(config.nombre),
  instagram: str(ajustes.instagram).replace(/^@/, ''),
  whatsapp: str(ajustes.whatsapp).replace(/\D/g, ''),
  telefono: str(ajustes.telefono),
  email: str(ajustes.email),
  direccion: str(ajustes.direccion),
  ciudad: str(ajustes.ciudad),
  region: str(ajustes.region),
  referencia: str(ajustes.referencia),
  servicios: str(ajustes.servicios),
  maps_url: str(ajustes.maps_url),
  google_nota: str(ajustes.google_nota),
  google_resenas: num(ajustes.google_resenas, 0),
};
const faltan = ['nombre', 'direccion', 'ciudad'].filter((k) => !T[k]);
if (faltan.length) throw new Error(`Faltan datos obligatorios: ${faltan.join(', ')} (tienda.config.json / data/ajustes.json)`);
if (!T.maps_url) T.maps_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${T.nombre} ${T.direccion} ${T.ciudad}`)}`;

// Resumen corto del horario: agrupa días seguidos con el mismo horario ("Lunes a viernes · 07:00 – 20:00")
function resumenHorario() {
  const grupos = [];
  for (const h of horario) {
    const clave = h.cerrado ? 'cerrado' : `${h.abre}–${h.cierra}`;
    const ult = grupos[grupos.length - 1];
    if (ult && ult.clave === clave) ult.dias.push(h.dia); else grupos.push({ clave, dias: [h.dia], h });
  }
  return grupos.map((g) => ({
    dias: g.dias.length > 2 ? `${g.dias[0]} a ${g.dias[g.dias.length - 1].toLowerCase()}` : g.dias.join(' y '),
    horas: g.h.cerrado ? 'Cerrado' : `${g.h.abre} – ${g.h.cierra}`,
  }));
}

// ---------- 2. Catálogo ----------
function readFolder(folder) {
  const dir = join(DATA, folder);
  let files = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return []; }
  const items = [];
  for (const file of files) {
    try {
      items.push({ id: basename(file, '.json'), ...readJson(join(dir, file)) });
    } catch (e) {
      // Un archivo dañado no debe botar todo el catálogo: se omite y se avisa en el log
      console.warn(`⚠️  Se omitió ${folder}/${file}: ${e.message}`);
    }
  }
  return items;
}
const byOrder = (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es');

const productos = readFolder('productos')
  .filter((p) => p.visible !== false && typeof p.nombre === 'string' && p.nombre.trim())
  .map((p) => ({
    id: p.id,
    nombre: p.nombre.trim(),
    precio: Math.max(0, Math.round(num(p.precio, 0))),
    foto: rel(p.foto) || 'img/logo.jpg',
    descripcion: str(p.descripcion),
    etiqueta: str(p.etiqueta),
    destacado: p.destacado === true,
    agotado: p.agotado === true,
    orden: num(p.orden, 1000),
  }))
  .sort(byOrder);

await Promise.all(productos.map(async (p) => {
  p.mini = await optimizar(p.foto, 640);
  p.grande = await optimizar(p.foto, 1200);
}));

const ids = new Set(productos.map((p) => p.id));
const categorias = readFolder('categorias')
  .filter((c) => c.visible !== false && typeof c.nombre === 'string' && c.nombre.trim())
  .map((c) => {
    const lista = new Set(Array.isArray(c.productos) ? c.productos : []);
    return {
      id: c.id,
      nombre: c.nombre.trim(),
      icono: str(c.icono) || 'taza',
      descripcion: str(c.descripcion),
      orden: num(c.orden, 1000),
      // en el orden de los productos; se descartan borrados u ocultos
      productos: productos.filter((p) => lista.has(p.id)).map((p) => p.id),
    };
  })
  .filter((c) => c.productos.length)
  .sort(byOrder);

// Productos que no están en ninguna categoría igual se muestran, en "Otros"
const enCategoria = new Set(categorias.flatMap((c) => c.productos));
const sueltos = productos.filter((p) => !enCategoria.has(p.id)).map((p) => p.id);
if (sueltos.length) categorias.push({ id: 'otros', nombre: 'Otros', icono: 'grano', descripcion: '', orden: 9999, productos: sueltos });

const catDe = Object.fromEntries(categorias.flatMap((c) => c.productos.map((id) => [id, c.nombre])));
const publico = productos.map(({ orden, destacado, ...p }) => ({ ...p, categoria: catDe[p.id] || '' }));

writeFileSync(join(DATA, 'catalogo.json'), JSON.stringify({
  _aviso: 'Archivo generado por scripts/build.mjs. No editar a mano.',
  categorias: categorias.map(({ orden, ...c }) => c),
  productos: publico,
}, null, 2) + '\n');
console.log(`✅ catálogo: ${productos.length} productos, ${categorias.length} categorías`);

// ---------- 3. HTML generado ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clp = (n) => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const abs = (path) => (/^https?:/.test(path) ? path : `${SITE}/${String(path).replace(/^\//, '')}`);
const icon = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

// Tarjeta de producto (misma estructura que card() en app.js)
const card = (p, { link = false } = {}) => {
  const tag = link ? 'a' : 'button';
  const attrs = link ? `href="carta.html#${esc(p.id)}"` : `type="button" data-view="${esc(p.id)}"`;
  const badge = p.agotado ? '<span class="badge badge--off">Agotado hoy</span>' : p.etiqueta ? `<span class="badge">${esc(p.etiqueta)}</span>` : '';
  return `
        <article class="card${p.agotado ? ' is-off' : ''}">
          <${tag} class="card__link" ${attrs} aria-label="Ver ${esc(p.nombre)}">
            <span class="card__img">${badge}<img src="${esc(p.mini)}" alt="${esc(p.nombre)}" loading="lazy" decoding="async"></span>
            <span class="card__body">
              <span class="card__top"><span class="card__name">${esc(p.nombre)}</span>${p.precio ? `<span class="card__price">${clp(p.precio)}</span>` : ''}</span>
              ${p.descripcion ? `<span class="card__desc">${esc(p.descripcion)}</span>` : ''}
              <span class="card__more">Ver detalle ${icon('arrow', 'ic ic--sm')}</span>
            </span>
          </${tag}>
        </article>`;
};

const destacados = (() => {
  const d = productos.filter((p) => p.destacado);
  return (d.length ? d : productos).slice(0, 4);
})();

const franja = (() => {
  const frases = (Array.isArray(portada.franja) ? portada.franja : []).map(str).filter(Boolean);
  const vuelta = [];
  if (frases.length) while (vuelta.length < 12) vuelta.push(...frases);
  return [...vuelta, ...vuelta].map((t) => `<span>${esc(t)}</span>`).join('');
})();

const filasHorario = horario.map((h) => `
              <li data-dia="${esc(h.dia)}"><span>${esc(h.dia)}</span><span>${h.cerrado ? 'Cerrado' : `${esc(h.abre)} – ${esc(h.cierra)}`}</span></li>`).join('');
const resumen = resumenHorario();

const nos = secciones.nosotros || {};
const lib = secciones.libros || {};
const mandamientos = (Array.isArray(secciones.mandamientos) ? secciones.mandamientos : []).map(str).filter(Boolean);
const resenas = (Array.isArray(secciones.resenas) ? secciones.resenas : []).filter((r) => str(r.texto));
const galeria = (Array.isArray(secciones.galeria) ? secciones.galeria : []).map(rel).filter(Boolean).slice(0, 6);

const [HERO, HERO_MINI, NOS1, NOS2, LIB] = await Promise.all([
  optimizar(rel(portada.foto) || productos[0]?.foto, 1100),
  optimizar(rel(portada.foto_mini) || productos[1]?.foto, 360),
  optimizar(rel(nos.foto1), 1000),
  optimizar(rel(nos.foto2), 640),
  optimizar(rel(lib.foto), 1200),
]);
const GALERIA = await Promise.all(galeria.map((g) => optimizar(g, 640)));

const igUrl = T.instagram ? `https://www.instagram.com/${T.instagram}/` : '';
const waUrl = T.whatsapp ? `https://api.whatsapp.com/send?phone=${T.whatsapp}&text=${encodeURIComponent(`Hola ${T.nombre}! 😸☕`)}` : '';

const LISTAS = {
  CATEGORIAS: categorias.map((c) => `
          <a class="cat" href="carta.html#${esc(c.id)}">
            <span class="cat__ic">${icon(c.icono, 'ic ic--lg')}</span>
            <span class="cat__name">${esc(c.nombre)}</span>
            <span class="cat__count">${c.productos.length} ${c.productos.length === 1 ? 'opción' : 'opciones'}</span>
          </a>`).join(''),
  DESTACADOS: destacados.map((p) => card(p, { link: true })).join(''),
  FRANJA: franja,
  MANDAMIENTOS: mandamientos.map((m, i) => `
            <li><span class="rule__n">${String(i + 1).padStart(2, '0')}</span><p>${esc(m)}</p></li>`).join(''),
  RESENAS: resenas.map((r) => {
    const n = Math.min(5, Math.max(1, Math.round(num(r.estrellas, 5))));
    return `
          <figure class="review">
            <div class="review__stars" aria-label="${n} de 5 estrellas">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></div>
            <blockquote>“${esc(r.texto)}”</blockquote>
            <figcaption><span class="review__avatar" aria-hidden="true">${esc(str(r.nombre).replace(/^@/, '').charAt(0).toUpperCase())}</span><span><strong>${esc(r.nombre)}</strong><small>Reseña en ${esc(r.origen || 'Google')}</small></span></figcaption>
          </figure>`;
  }).join(''),
  GALERIA: GALERIA.map((g, i) => `
          <a class="shot" href="${esc(igUrl || '#')}" target="_blank" rel="noopener"><img src="${esc(g)}" alt="Foto ${i + 1} de ${esc(T.nombre)}" loading="lazy" decoding="async">${icon('ig', 'ic shot__ic')}</a>`).join(''),
  HORARIO: filasHorario,
  HORARIO_CORTO: resumen.map((r) => `<li><span>${esc(r.dias)}</span><span>${esc(r.horas)}</span></li>`).join(''),
  FILTROS: [`<button class="chip is-active" type="button" data-cat="todos">Todo <sup>${productos.length}</sup></button>`,
    ...categorias.map((c) => `<button class="chip" type="button" data-cat="${esc(c.id)}">${icon(c.icono, 'ic ic--sm')}${esc(c.nombre)} <sup>${c.productos.length}</sup></button>`)].join(''),
  CARTA: categorias.map((c) => `
      <section class="menu-group" id="${esc(c.id)}" data-group="${esc(c.id)}">
        <header class="menu-group__head">
          <span class="menu-group__ic">${icon(c.icono, 'ic ic--lg')}</span>
          <div><h2>${esc(c.nombre)}</h2>${c.descripcion ? `<p>${esc(c.descripcion)}</p>` : ''}</div>
          <span class="menu-group__count">${c.productos.length}</span>
        </header>
        <div class="grid">${c.productos.map((id) => card(productos.find((p) => p.id === id))).join('')}
        </div>
      </section>`).join(''),
};

// ---------- 4. Marcadores %%CLAVE%% ----------
const SEO_TITULO = str(config.seo_titulo) || `${T.nombre} · ${config.rubro} en ${T.ciudad}`;
const SEO_DESCRIPCION = str(config.seo_descripcion) || str(portada.bajada);
const VARS = {
  NOMBRE: T.nombre, SEO_TITULO, SEO_DESCRIPCION,
  DIRECCION: T.direccion, CIUDAD: T.ciudad, REGION: T.region, REFERENCIA: T.referencia, SERVICIOS: T.servicios,
  MAPS_URL: T.maps_url, MAPA_QUERY: encodeURIComponent([T.nombre, T.direccion, T.ciudad, 'Chile'].filter(Boolean).join(', ')),
  INSTAGRAM: T.instagram, IG_URL: igUrl, WA_URL: waUrl, TELEFONO: T.telefono, TEL_URL: T.telefono.replace(/[^\d+]/g, ''), EMAIL: T.email,
  GOOGLE_NOTA: T.google_nota, GOOGLE_RESENAS: T.google_resenas ? String(T.google_resenas) : '',
  HERO_ETIQUETA: str(portada.etiqueta), HERO_TITULO: str(portada.titulo), HERO_DESTACADO: str(portada.destacado), HERO_BAJADA: str(portada.bajada),
  HERO_FOTO: HERO, HERO_MINI, MINI_TITULO: str(portada.mini_titulo), MINI_TEXTO: str(portada.mini_texto),
  NOS_ETIQUETA: str(nos.etiqueta), NOS_TITULO: str(nos.titulo), NOS_DESTACADO: str(nos.destacado), NOS_TEXTO: str(nos.texto), NOS_FOTO1: NOS1, NOS_FOTO2: NOS2,
  LIB_ETIQUETA: str(lib.etiqueta), LIB_TITULO: str(lib.titulo), LIB_DESTACADO: str(lib.destacado), LIB_TEXTO: str(lib.texto), LIB_FOTO: LIB,
  MANDAMIENTOS: mandamientos.length ? '1' : '', RESENAS: resenas.length ? '1' : '', GALERIA: GALERIA.length ? '1' : '', FRANJA: franja ? '1' : '',
  TOTAL_PRODUCTOS: String(productos.length), ANIO: String(new Date().getFullYear()),
  GITHUB_REPO: str(config.github_repo), SITE_URL: `${SITE}/`,
  // Solo lo que necesita el navegador (app.js)
  TIENDA_JSON: JSON.stringify({ horario, direccion: T.direccion }),
  CARTA_JSON: JSON.stringify(publico.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, foto: p.grande, descripcion: p.descripcion, etiqueta: p.etiqueta, agotado: p.agotado, categoria: p.categoria }))),
};

// Bloques opcionales: <!-- SI:CLAVE --> ... <!-- /SI:CLAVE --> se eliminan si CLAVE está vacía
function render(text, file, escape) {
  let out = text;
  for (let prev; prev !== out;) {
    prev = out;
    out = out.replace(/<!-- SI:([A-Z0-9_]+) -->([\s\S]*?)<!-- \/SI:\1 -->/g, (m, key, body) => (str(VARS[key]) ? body : ''));
  }
  out = out.replace(/<!-- PARCIAL:([a-z]+) -->/g, (m, name) => readFileSync(join(ROOT, 'parciales', `${name}.html`), 'utf8'));
  // los parciales también pueden tener bloques SI
  for (let prev; prev !== out;) {
    prev = out;
    out = out.replace(/<!-- SI:([A-Z0-9_]+) -->([\s\S]*?)<!-- \/SI:\1 -->/g, (m, key, body) => (str(VARS[key]) ? body : ''));
  }
  out = out.replace(/<!-- LISTA:([A-Z_]+) -->/g, (m, key) => {
    if (!(key in LISTAS)) throw new Error(`${file}: lista desconocida ${key}`);
    return LISTAS[key];
  });
  const missing = new Set();
  out = out.replace(/%%([A-Z0-9_]+)%%/g, (m, key) => {
    const v = VARS[key];
    if (v === undefined || v === null) { missing.add(key); return m; }
    return escape && !key.endsWith('_JSON') ? esc(v) : String(v).replace(/</g, '\\u003c');
  });
  if (missing.size) throw new Error(`${file}: faltan valores para ${[...missing].join(', ')}`);
  return out;
}

// ---------- 5. SEO ----------
const OG_IMAGE = abs(rel(portada.foto) || 'img/logo.jpg');
const sameAs = [igUrl].filter(Boolean);
const aperturas = horario.filter((h) => !h.cerrado).map((h) => ({
  '@type': 'OpeningHoursSpecification', dayOfWeek: DIAS_EN[h.dia], opens: h.abre, closes: h.cierra,
}));
const jsonLd = (pagina) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': str(config.schema_tipo) || 'CafeOrCoffeeShop',
      '@id': `${SITE}/#local`,
      name: T.nombre,
      description: SEO_DESCRIPCION,
      url: `${SITE}/`,
      logo: abs('img/logo.jpg'),
      image: [OG_IMAGE, abs('img/logo.jpg')],
      telephone: T.telefono || (T.whatsapp ? `+${T.whatsapp}` : undefined),
      email: T.email || undefined,
      servesCuisine: ['Café', 'Pastelería', 'Sándwiches'],
      hasMenu: `${SITE}/carta`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: T.direccion,
        addressLocality: T.ciudad,
        addressRegion: T.region || undefined,
        addressCountry: 'CL',
      },
      openingHoursSpecification: aperturas.length ? aperturas : undefined,
      aggregateRating: T.google_nota && T.google_resenas ? {
        '@type': 'AggregateRating', ratingValue: T.google_nota.replace(',', '.'), reviewCount: T.google_resenas, bestRating: 5,
      } : undefined,
      sameAs: sameAs.length ? sameAs : undefined,
    },
    pagina === 'carta' && {
      '@type': 'Menu',
      name: `Carta de ${T.nombre}`,
      url: `${SITE}/carta`,
      hasMenuSection: categorias.map((c) => ({
        '@type': 'MenuSection',
        name: c.nombre,
        hasMenuItem: c.productos.map((id) => {
          const p = productos.find((x) => x.id === id);
          return {
            '@type': 'MenuItem', name: p.nombre, description: p.descripcion || undefined, image: abs(p.foto),
            offers: p.precio ? { '@type': 'Offer', price: p.precio, priceCurrency: 'CLP' } : undefined,
          };
        }),
      })),
    },
  ].filter(Boolean),
});

const head = (pagina, path) => `<link rel="canonical" href="${SITE}${path}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(T.nombre)}">
  <meta property="og:locale" content="es_CL">
  <meta property="og:url" content="${SITE}${path}">
  <meta property="og:title" content="${esc(pagina === 'carta' ? `Carta · ${T.nombre}` : SEO_TITULO)}">
  <meta property="og:description" content="${esc(SEO_DESCRIPCION)}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">${config.google_verificacion
    ? `\n  <meta name="google-site-verification" content="${esc(config.google_verificacion)}">` : ''}
  <script type="application/ld+json">${JSON.stringify(jsonLd(pagina)).replace(/</g, '\\u003c')}</script>`;

// ---------- 6. dist/ ----------
const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
const js = readFileSync(join(ROOT, 'app.js'), 'utf8');
const version = (text) => createHash('sha1').update(text).digest('hex').slice(0, 10);

for (const [file, pagina, path] of [['index.html', 'inicio', '/'], ['carta.html', 'carta', '/carta']]) {
  let html = readFileSync(join(ROOT, file), 'utf8');
  if (!html.includes('<!-- SEO:HEAD')) throw new Error(`Falta el marcador SEO:HEAD en ${file}`);
  html = render(html, file, true)
    .replace(/<!-- SEO:HEAD[^>]*-->/, head(pagina, path))
    .replace('href="styles.css"', `href="styles.css?v=${version(css)}"`)
    .replace('src="app.js"', `src="app.js?v=${version(js)}"`);
  writeFileSync(join(DIST, file), html);
}

cpSync(join(ROOT, 'img'), join(DIST, 'img'), { recursive: true });
cpSync(join(ROOT, 'admin'), join(DIST, 'admin'), { recursive: true });
cpSync(join(DATA, 'catalogo.json'), join(DIST, 'data', 'catalogo.json'));
writeFileSync(join(DIST, 'styles.css'), css);
writeFileSync(join(DIST, 'app.js'), js);
writeFileSync(join(DIST, 'admin', 'config.yml'), render(readFileSync(join(ROOT, 'admin', 'config.yml'), 'utf8'), 'admin/config.yml', false));

writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\n`);
const hoy = new Date().toISOString().slice(0, 10);
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${hoy}</lastmod></url>
  <url><loc>${SITE}/carta</loc><lastmod>${hoy}</lastmod></url>
</urlset>
`);

if (!existsSync(join(ROOT, 'img', 'logo.jpg'))) console.warn('⚠️  Falta img/logo.jpg (npm run logo)');
console.log(`✅ sitio listo en dist/ para ${SITE}`);

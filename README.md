# Coffee Break · Rancagua

Sitio de **Coffee Break**, cafetería de especialidad en Estado 634, Rancagua ([@coffeebreak.rancagua](https://www.instagram.com/coffeebreak.rancagua/)).

- `index.html`: página principal (portada, categorías, favoritos, nosotros, libros por café, pizarra, reseñas, galería y visítanos con horario y mapa).
- `carta.html`: carta completa con filtros por categoría y ficha de cada producto. Solo información, sin carrito.
- `/admin`: panel (Sveltia CMS) para que el local edite productos, categorías, textos, fotos, reseñas, contacto y horario. Cada cambio queda como commit en GitHub y Vercel publica en ~30 segundos.

## Cómo funciona

| Archivo | Quién lo edita | Qué contiene |
|---|---|---|
| `tienda.config.json` | Desarrollador | Nombre, SEO, repo y dominio |
| `data/ajustes.json` | Cliente (/admin) | Dirección, redes, nota de Google y horario por día |
| `data/portada.json` | Cliente (/admin) | Textos y fotos de la portada, frases de la franja |
| `data/secciones.json` | Cliente (/admin) | Nosotros, libros por café, pizarra, reseñas y galería |
| `data/productos/*.json` | Cliente (/admin) | Un archivo por producto |
| `data/categorias/*.json` | Cliente (/admin) | Categorías de la carta y sus productos |

`scripts/build.mjs` junta todo, reemplaza los `%%MARCADORES%%` de los HTML, escribe la carta dentro del HTML (para Google), agrega datos estructurados (`CafeOrCoffeeShop` + `Menu`), optimiza las fotos subidas a WebP y deja el sitio en `dist/`.

## Uso local

```bash
npm install
npm run build
python -m http.server 5620 --directory dist
```

## Logo

El logo se genera con `npm run logo` (`scripts/logo.mjs`): insignia circular (`img/logo.svg`, `img/logo.jpg`), isotipo (`img/logo-mark.svg`), versiones horizontales para fondo claro y oscuro, e íconos del teléfono y favicon. Las letras se convierten a trazos con Playfair Display.

## Publicar (igual que los otros proyectos)

1. Importar el repo en Vercel (usa `vercel.json`: build `node scripts/build.mjs`, salida `dist/`).
2. Actualizar `site_url` en `tienda.config.json` con el dominio final.
3. Para `/admin`: el cliente entra con su cuenta de GitHub (necesita acceso de escritura al repo).

## Pendiente con el cliente

- Las fotos de productos y secciones son de referencia (Unsplash). Reemplazarlas desde `/admin` con fotos reales del local.
- Precios: vacíos a propósito (no están publicados). Se agregan desde `/admin` y aparecen solos.
- WhatsApp y teléfono: vacíos. Si se agregan en `/admin`, aparecen los botones.

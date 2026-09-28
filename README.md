# Coffee Break · Rancagua

Sitio web y panel de administración para **Coffee Break**, cafetería de especialidad en Estado 634, Rancagua ([@coffeebreak.rancagua](https://www.instagram.com/coffeebreak.rancagua/)).

- **Home + landing**: portada, nosotros, productos destacados, libros por café, pizarra de mandamientos, reseñas, galería, horario con estado "abierto ahora" y mapa.
- **/productos**: carta completa con filtros por categoría y ficha de detalle (sin carrito, solo información).
- **/admin**: panel protegido con contraseña para editar textos, imágenes (con subida de archivos), productos (crear, editar, ordenar, destacar, marcar agotado), categorías, horario, contacto, frases de la pizarra y reseñas.

## Stack

Node.js + Express. Sin base de datos: el contenido vive en `data/content.json` (se crea desde `data/seed.json` al primer arranque) y las imágenes subidas en `public/uploads/`.

## Uso local

```bash
npm install
cp .env.example .env   # y cambia ADMIN_PASSWORD
npm start
```

- Sitio: http://localhost:3000
- Panel: http://localhost:3000/admin

## Publicar

Funciona en cualquier hosting con Node (Render, Railway, un VPS, etc.):

1. Comando de arranque: `npm start`.
2. Variable de entorno `ADMIN_PASSWORD` con una contraseña segura.
3. **Importante:** monta un disco persistente para `data/` y `public/uploads/`; si no, los cambios del panel se pierden en cada redeploy.

## Estructura

```
server.js              API + archivos estáticos
data/seed.json         contenido inicial
public/index.html      home
public/productos.html  carta completa
public/admin/          panel de administración
public/js/             lógica del sitio y del panel
public/css/            estilos (site.css / admin.css)
public/img/logo.svg    logo vectorizado
```

## Diseño

- Tipografías: *Instrument Serif* (títulos) y *Newsreader* (texto). Nada de sans genéricas.
- Paleta tomada del logo: terracota `#C4552B`, durazno `#F3C9A9`, café tostado `#5A3522`, espresso `#24160F`, papel crema `#FBF6EC` y un acento menta `#A9CFC1`.
- Las fotos iniciales son de Unsplash como referencia; se reemplazan desde el panel con las fotos reales del local.

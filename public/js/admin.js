(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let data = null;      // contenido en edición
  let saved = '';       // última versión guardada (JSON)
  let tab = 'textos';

  // ---------- Definición de campos de texto ----------
  const TEXT_GROUPS = [
    ['General', 'Nombre, barra de anuncio y textos del pie de página.', [
      ['name', 'Nombre del local'], ['announcement', 'Barra de anuncio (vacío para ocultar)'],
      ['metaDescription', 'Descripción para Google', 'area'], ['footerText', 'Texto del pie de página', 'area'],
    ]],
    ['Portada', 'Lo primero que ve la gente al entrar.', [
      ['heroEyebrow', 'Texto pequeño superior'], ['heroTitle', 'Título (línea 1)'], ['heroTitleItalic', 'Título en cursiva (línea 2)'],
      ['heroSideNote', 'Nota lateral (una frase por línea)', 'area'], ['heroText', 'Descripción', 'area'],
      ['heroCta', 'Botón principal'], ['heroCta2', 'Botón secundario'],
      ['marquee', 'Cinta de productos (separados por coma)', 'csv'],
    ]],
    ['Nosotros', 'Sección con las fotos en forma orgánica.', [
      ['aboutEyebrow', 'Texto pequeño'], ['aboutTitle', 'Título'], ['aboutTitleItalic', 'Título en cursiva'],
      ['aboutText', 'Texto', 'area'], ['aboutLink', 'Texto del enlace'],
    ]],
    ['Productos destacados', 'Bloque terracota con los productos marcados como destacados.', [
      ['featuredEyebrow', 'Texto pequeño'], ['featuredTitle', 'Título'], ['featuredTitleItalic', 'Título en cursiva'],
      ['featuredText', 'Descripción', 'area'], ['featuredCta', 'Botón "ver todos"'],
    ]],
    ['Libros por café', null, [
      ['booksEyebrow', 'Texto pequeño'], ['booksTitle', 'Título'], ['booksTitleItalic', 'Título en cursiva'], ['booksText', 'Texto', 'area'],
    ]],
    ['Pizarra', 'Encabezado de los mandamientos (las frases se editan en "Pizarra y reseñas").', [
      ['rulesEyebrow', 'Texto pequeño'], ['rulesTitle', 'Título'], ['rulesTitleItalic', 'Título en cursiva'],
    ]],
    ['Reseñas y galería', null, [
      ['reviewsEyebrow', 'Reseñas · texto pequeño'], ['reviewsTitle', 'Reseñas · título'], ['reviewsTitleItalic', 'Reseñas · cursiva'],
      ['galleryEyebrow', 'Galería · texto pequeño'], ['galleryTitle', 'Galería · título'], ['galleryTitleItalic', 'Galería · cursiva'],
    ]],
    ['Visítanos', null, [
      ['visitEyebrow', 'Texto pequeño'], ['visitTitle', 'Título'], ['visitTitleItalic', 'Título en cursiva'], ['visitText', 'Texto', 'area'],
    ]],
    ['Página de productos', 'Encabezado de la página /productos.', [
      ['productsPageTitle', 'Título'], ['productsPageTitleItalic', 'Título en cursiva'], ['productsPageText', 'Descripción', 'area'],
    ]],
  ];

  const IMAGE_FIELDS = [
    ['logo', 'Logo', 'Idealmente cuadrado, fondo claro.'],
    ['heroImage', 'Imagen de portada', 'Horizontal, mínimo 1800 px de ancho.'],
    ['aboutImage1', 'Nosotros · foto 1', 'Vertical.'],
    ['aboutImage2', 'Nosotros · foto 2', 'Vertical.'],
    ['booksImage', 'Libros por café', 'Horizontal.'],
  ];

  const TAB_INFO = {
    textos: ['Textos del sitio', 'Títulos, descripciones y botones de cada sección.'],
    imagenes: ['Imágenes', 'Logo, portada, fotos de secciones y galería.'],
    productos: ['Productos', 'Agrega, edita, ordena y destaca los productos de la carta.'],
    contacto: ['Horario y contacto', 'Dirección, horario de atención y redes.'],
    extras: ['Pizarra y reseñas', 'Frases de la pizarra y opiniones de clientes.'],
  };

  // ---------- API ----------
  async function api(url, opts = {}) {
    const res = await fetch(url, { credentials: 'same-origin', ...opts });
    if (res.status === 401 && url !== '/api/login') { showLogin(); throw new Error('Sesión expirada'); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Error inesperado');
    return body;
  }

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('image', file);
    const { url } = await api('/api/upload', { method: 'POST', body: fd });
    return url;
  }

  function toast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function markDirty() { $('#dirty').hidden = JSON.stringify(data) === saved; }

  // ---------- Login ----------
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; }
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#login-error').textContent = '';
    try {
      await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: e.target.password.value }) });
      e.target.reset();
      await start();
    } catch (err) { $('#login-error').textContent = err.message; }
  });
  $('#logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); showLogin(); });

  // ---------- Tabs ----------
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.dataset.panel !== tab));
    $('#tab-title').textContent = TAB_INFO[tab][0];
    $('#tab-sub').textContent = TAB_INFO[tab][1];
    window.scrollTo(0, 0);
  });

  // ---------- Componentes ----------
  function textField(obj, key, label, type) {
    const val = type === 'csv' ? (obj[key] || []).join(', ') : obj[key] ?? '';
    const wrap = document.createElement('label');
    wrap.className = 'field' + (type === 'area' || type === 'csv' ? ' field--full' : '');
    wrap.innerHTML = `<span>${esc(label)}</span>` + (type === 'area'
      ? `<textarea>${esc(val)}</textarea>`
      : `<input type="text" value="${esc(val)}">`);
    wrap.lastElementChild.addEventListener('input', (e) => {
      obj[key] = type === 'csv' ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : e.target.value;
      markDirty();
    });
    return wrap;
  }

  function imageField(obj, key, label, hint, onChange) {
    const el = document.createElement('div');
    el.className = 'field field--full';
    el.innerHTML = `
      <span>${esc(label)}</span>
      <div class="img-field">
        <div class="img-field__preview"><img alt=""></div>
        <div class="img-field__controls">
          <input type="url" placeholder="https://… o sube una imagen">
          <div class="img-field__row">
            <label class="btn btn--sm upload-btn">Subir imagen<input type="file" accept="image/*"></label>
          </div>
          ${hint ? `<small style="color:var(--ink-soft)">${esc(hint)}</small>` : ''}
        </div>
      </div>`;
    const img = el.querySelector('img');
    const url = el.querySelector('input[type="url"]');
    const set = (v) => { obj[key] = v; img.src = v || ''; url.value = v || ''; markDirty(); onChange && onChange(v); };
    img.src = obj[key] || ''; url.value = obj[key] || '';
    url.addEventListener('change', () => set(url.value.trim()));
    el.querySelector('input[type="file"]').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { toast('Subiendo imagen…'); set(await uploadFile(f)); toast('Imagen subida'); }
      catch (err) { toast(err.message, true); }
      e.target.value = '';
    });
    return el;
  }

  function group(title, hint) {
    const g = document.createElement('section');
    g.className = 'group';
    g.innerHTML = `<h2>${esc(title)}</h2>${hint ? `<p class="hint">${esc(hint)}</p>` : '<p class="hint"></p>'}`;
    return g;
  }

  function editableList(arr, { placeholder, area, onChange } = {}) {
    const box = document.createElement('div');
    box.className = 'list';
    const render = () => {
      box.innerHTML = '';
      arr.forEach((v, i) => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `
          <label class="field">${area ? `<textarea rows="2">${esc(v)}</textarea>` : `<input type="text" value="${esc(v)}">`}</label>
          <div class="list-row__actions">
            <button type="button" class="icon-btn" data-a="up" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button type="button" class="icon-btn" data-a="down" ${i === arr.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
            <button type="button" class="icon-btn" data-a="del" aria-label="Eliminar">×</button>
          </div>`;
        row.querySelector('input,textarea').addEventListener('input', (e) => { arr[i] = e.target.value; markDirty(); });
        row.addEventListener('click', (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (!a) return;
          if (a === 'del') arr.splice(i, 1);
          if (a === 'up') [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
          if (a === 'down') [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
          markDirty(); render(); onChange && onChange();
        });
        box.appendChild(row);
      });
      const add = document.createElement('button');
      add.type = 'button'; add.className = 'btn btn--sm'; add.textContent = `+ ${placeholder || 'Agregar'}`;
      add.style.justifySelf = 'start';
      add.addEventListener('click', () => { arr.push(''); markDirty(); render(); box.querySelector('.list-row:last-of-type input, .list-row:last-of-type textarea')?.focus(); });
      box.appendChild(add);
    };
    render();
    return box;
  }

  // ---------- Paneles ----------
  function renderTextos() {
    const p = $('#panel-textos');
    p.innerHTML = '';
    TEXT_GROUPS.forEach(([title, hint, fields]) => {
      const g = group(title, hint);
      const grid = document.createElement('div');
      grid.className = 'grid';
      fields.forEach(([k, l, t]) => grid.appendChild(textField(data.site, k, l, t)));
      g.appendChild(grid);
      p.appendChild(g);
    });
  }

  function renderImagenes() {
    const p = $('#panel-imagenes');
    p.innerHTML = '';
    const g = group('Imágenes de secciones', 'Sube una foto desde tu computador o pega el enlace de una imagen.');
    const grid = document.createElement('div');
    grid.className = 'grid';
    IMAGE_FIELDS.forEach(([k, l, h]) => grid.appendChild(imageField(data.site, k, l, h, k === 'logo' ? (v) => ($('#side-logo').src = v) : null)));
    g.appendChild(grid);
    p.appendChild(g);

    const gg = group('Galería', 'Fotos del bloque "Momentos de break". Recomendado: 6 fotos cuadradas.');
    const ge = document.createElement('div');
    ge.className = 'gallery-edit';
    const renderGallery = () => {
      ge.innerHTML = data.gallery.map((src, i) => `
        <div class="gallery-edit__item"><img src="${esc(src)}" alt=""><button type="button" class="icon-btn" data-i="${i}" aria-label="Quitar">×</button></div>`).join('') +
        `<label class="gallery-edit__add">+ Agregar fotos<input type="file" accept="image/*" multiple></label>`;
      ge.querySelectorAll('.icon-btn').forEach((b) => b.addEventListener('click', () => { data.gallery.splice(+b.dataset.i, 1); markDirty(); renderGallery(); }));
      ge.querySelector('input[type="file"]').addEventListener('change', async (e) => {
        try {
          for (const f of e.target.files) { toast('Subiendo…'); data.gallery.push(await uploadFile(f)); }
          markDirty(); renderGallery(); toast('Fotos agregadas');
        } catch (err) { toast(err.message, true); }
      });
    };
    renderGallery();
    gg.appendChild(ge);
    p.appendChild(gg);
  }

  let pFilter = { q: '', cat: '' };
  function renderProductos() {
    const p = $('#panel-productos');
    p.innerHTML = `
      <div class="toolbar">
        <input type="search" placeholder="Buscar producto…" value="${esc(pFilter.q)}" id="p-search">
        <select id="p-cat"><option value="">Todas las categorías</option>${data.categories.map((c) => `<option ${c === pFilter.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <button class="btn btn--primary" type="button" id="p-add">+ Nuevo producto</button>
      </div>
      <div class="plist" id="plist"></div>`;
    const list = $('#plist');
    const renderList = () => {
      const q = pFilter.q.toLowerCase();
      const items = data.products.map((x, i) => [x, i]).filter(([x]) =>
        (!pFilter.cat || x.category === pFilter.cat) && (!q || x.name.toLowerCase().includes(q)));
      list.innerHTML = items.map(([x, i]) => `
        <div class="prow">
          <img src="${esc(x.image)}" alt="">
          <div>
            <div class="prow__name">${esc(x.name)}</div>
            <div class="prow__meta">
              <span>${esc(x.category)}</span>${x.price ? `<span>· ${esc(x.price)}</span>` : ''}
              ${x.featured ? '<span class="pill pill--star">★ Destacado</span>' : ''}
              ${!x.available ? '<span class="pill pill--off">Agotado</span>' : ''}
              ${x.tag ? `<span class="pill">${esc(x.tag)}</span>` : ''}
            </div>
          </div>
          <div class="prow__order">
            <button type="button" class="icon-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button type="button" class="icon-btn" data-down="${i}" ${i === data.products.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
          </div>
          <button type="button" class="btn btn--sm" data-edit="${i}">Editar</button>
        </div>`).join('') || '<p class="hint">No hay productos con ese filtro.</p>';
    };
    renderList();
    $('#p-search').addEventListener('input', (e) => { pFilter.q = e.target.value; renderList(); });
    $('#p-cat').addEventListener('change', (e) => { pFilter.cat = e.target.value; renderList(); });
    $('#p-add').addEventListener('click', () => editProduct(-1));
    list.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      const P = data.products;
      if (t.dataset.edit) editProduct(+t.dataset.edit);
      if (t.dataset.up) { const i = +t.dataset.up; [P[i - 1], P[i]] = [P[i], P[i - 1]]; markDirty(); renderList(); }
      if (t.dataset.down) { const i = +t.dataset.down; [P[i + 1], P[i]] = [P[i], P[i + 1]]; markDirty(); renderList(); }
    });

    // Categorías
    const g = group('Categorías', 'El orden aquí define el orden en la página de productos.');
    g.appendChild(editableList(data.categories, { placeholder: 'Agregar categoría', onChange: () => {} }));
    p.appendChild(g);
  }

  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'producto';

  function editProduct(index) {
    const isNew = index < 0;
    const draft = isNew
      ? { id: '', name: '', category: data.categories[0] || '', description: '', price: '', image: '', featured: false, tag: '', available: true }
      : { ...data.products[index] };
    const dlg = $('#product-dialog');
    $('#product-dialog-title').textContent = isNew ? 'Nuevo producto' : 'Editar producto';
    $('#product-delete').hidden = isNew;
    const body = $('#product-fields');
    body.innerHTML = '';
    const localDirty = markDirty;
    const f = (k, l, t) => { const el = textField(draft, k, l, t); return el; };
    body.append(
      f('name', 'Nombre'),
      (() => {
        const w = document.createElement('label');
        w.className = 'field';
        w.innerHTML = `<span>Categoría</span><select>${data.categories.map((c) => `<option ${c === draft.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`;
        w.querySelector('select').addEventListener('change', (e) => (draft.category = e.target.value));
        return w;
      })(),
      f('description', 'Descripción', 'area'),
      f('price', 'Precio (opcional, ej: $2.900)'),
      f('tag', 'Etiqueta (opcional, ej: Nuevo, Temporada)'),
      imageField(draft, 'image', 'Foto del producto', 'Cuadrada o vertical, buena luz.'),
      (() => {
        const w = document.createElement('div');
        w.style.display = 'flex'; w.style.gap = '1.5rem'; w.style.flexWrap = 'wrap';
        w.innerHTML = `
          <label class="check"><input type="checkbox" data-k="featured" ${draft.featured ? 'checked' : ''}> Mostrar en la portada (destacado)</label>
          <label class="check"><input type="checkbox" data-k="available" ${draft.available ? 'checked' : ''}> Disponible</label>`;
        w.querySelectorAll('input').forEach((c) => c.addEventListener('change', () => (draft[c.dataset.k] = c.checked)));
        return w;
      })()
    );
    // Los cambios dentro del drawer no marcan el sitio como sucio hasta presionar "Listo"
    markDirty = () => {};
    const restore = () => { markDirty = localDirty; };

    const form = $('#product-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!draft.name.trim()) { toast('El producto necesita un nombre', true); return; }
      if (!draft.id) {
        let id = slug(draft.name), n = 2;
        while (data.products.some((x) => x.id === id)) id = `${slug(draft.name)}-${n++}`;
        draft.id = id;
      }
      if (isNew) data.products.unshift(draft); else data.products[index] = draft;
      restore(); dlg.close(); markDirty(); renderProductos();
    };
    $('#product-delete').onclick = () => {
      if (!confirm(`¿Eliminar "${draft.name}"? Se quitará al guardar los cambios.`)) return;
      data.products.splice(index, 1);
      restore(); dlg.close(); markDirty(); renderProductos();
    };
    dlg.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => { restore(); dlg.close(); }));
    dlg.oncancel = restore;
    dlg.showModal();
  }

  function renderContacto() {
    const p = $('#panel-contacto');
    p.innerHTML = '';
    const g = group('Ubicación y redes', 'Se muestran en la sección Visítanos, en el mapa y en el pie de página.');
    const grid = document.createElement('div');
    grid.className = 'grid';
    [['address', 'Dirección'], ['city', 'Ciudad / región'], ['services', 'Servicios (ej: Consumo en el local · Para llevar)'],
      ['instagram', 'Usuario de Instagram (sin @)'], ['whatsapp', 'WhatsApp (con código país, ej: 56912345678)'],
      ['phone', 'Teléfono'], ['email', 'Correo'], ['mapQuery', 'Búsqueda para el mapa (ej: Estado 634, Rancagua)'],
      ['mapsUrl', 'Enlace de Google Maps (botón "Cómo llegar")']]
      .forEach(([k, l]) => grid.appendChild(textField(data.contact, k, l)));
    g.appendChild(grid);
    p.appendChild(g);

    const h = group('Horario de atención', 'Se usa también para mostrar "Abierto ahora" en la portada.');
    const box = document.createElement('div');
    box.className = 'hours-edit';
    data.hours.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'hours-row';
      row.innerHTML = `
        <strong>${esc(d.day)}</strong>
        <input type="time" value="${esc(d.open)}" data-k="open" ${d.closed ? 'disabled' : ''} aria-label="Apertura ${esc(d.day)}">
        <input type="time" value="${esc(d.close)}" data-k="close" ${d.closed ? 'disabled' : ''} aria-label="Cierre ${esc(d.day)}">
        <label class="check"><input type="checkbox" ${d.closed ? 'checked' : ''}> Cerrado</label>`;
      row.querySelectorAll('input[type="time"]').forEach((t) => t.addEventListener('input', () => { d[t.dataset.k] = t.value; markDirty(); }));
      row.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
        d.closed = e.target.checked;
        row.querySelectorAll('input[type="time"]').forEach((t) => (t.disabled = d.closed));
        markDirty();
      });
      box.appendChild(row);
    });
    h.appendChild(box);
    p.appendChild(h);
  }

  function renderExtras() {
    const p = $('#panel-extras');
    p.innerHTML = '';
    const g = group('Mandamientos de la pizarra', 'Frases que aparecen en la sección oscura tipo pizarra.');
    g.appendChild(editableList(data.rules, { placeholder: 'Agregar frase', area: true }));
    p.appendChild(g);

    const r = group('Reseñas', 'Opiniones reales de clientes (Google, Instagram, etc.).');
    const box = document.createElement('div');
    box.className = 'list';
    const render = () => {
      box.innerHTML = '';
      data.reviews.forEach((rv, i) => {
        const row = document.createElement('div');
        row.className = 'group';
        row.style.margin = '0';
        const grid = document.createElement('div');
        grid.className = 'grid';
        grid.append(textField(rv, 'name', 'Nombre'), textField(rv, 'text', 'Opinión', 'area'));
        const del = document.createElement('button');
        del.type = 'button'; del.className = 'btn btn--sm btn--danger'; del.textContent = 'Eliminar reseña';
        del.style.marginTop = '.8rem';
        del.addEventListener('click', () => { data.reviews.splice(i, 1); markDirty(); render(); });
        row.append(grid, del);
        box.appendChild(row);
      });
      const add = document.createElement('button');
      add.type = 'button'; add.className = 'btn btn--sm'; add.textContent = '+ Agregar reseña'; add.style.justifySelf = 'start';
      add.addEventListener('click', () => { data.reviews.push({ name: '', text: '', stars: 5 }); markDirty(); render(); });
      box.appendChild(add);
    };
    render();
    r.appendChild(box);
    p.appendChild(r);

    const z = group('Restablecer', 'Vuelve todo el contenido a la versión original. No borra las imágenes subidas.');
    const reset = document.createElement('button');
    reset.className = 'btn btn--danger'; reset.type = 'button'; reset.textContent = 'Restablecer contenido original';
    reset.addEventListener('click', async () => {
      if (!confirm('¿Seguro? Se perderán todos los cambios hechos al contenido.')) return;
      await api('/api/reset', { method: 'POST' });
      await loadContent(); toast('Contenido restablecido');
    });
    z.appendChild(reset);
    p.appendChild(z);
  }

  function renderAll() {
    renderTextos(); renderImagenes(); renderProductos(); renderContacto(); renderExtras();
    $('#side-logo').src = data.site.logo || '/img/logo.svg';
    markDirty();
  }

  async function loadContent() {
    data = await api('/api/content');
    saved = JSON.stringify(data);
    renderAll();
  }

  $('#save').addEventListener('click', async () => {
    try {
      await api('/api/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      saved = JSON.stringify(data);
      markDirty();
      toast('Cambios guardados ✓');
    } catch (err) { toast(err.message, true); }
  });
  $('#discard').addEventListener('click', () => {
    if (JSON.stringify(data) === saved) return;
    if (!confirm('¿Descartar los cambios sin guardar?')) return;
    data = JSON.parse(saved); renderAll();
  });
  window.addEventListener('beforeunload', (e) => { if (data && JSON.stringify(data) !== saved) { e.preventDefault(); e.returnValue = ''; } });

  async function start() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    await loadContent();
  }

  // Arranque
  fetch('/api/session', { credentials: 'same-origin' }).then((r) => (r.ok ? start() : showLogin())).catch(showLogin);
})();

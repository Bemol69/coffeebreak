// Coffee Break · comportamiento del sitio (sin dependencias)
// Los datos llegan escritos en el HTML por scripts/build.mjs: window.TIENDA y, en la carta, window.CARTA.
(function () {
  const TIENDA = window.TIENDA || { horario: [] };
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- Navegación ----------
  const nav = $('#nav');
  const toggle = $('.nav__toggle');
  const onScroll = () => nav.classList.toggle('is-solid', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
  if (document.body.classList.contains('page-carta')) $('.nav__links a[href="carta.html"]')?.setAttribute('aria-current', 'page');

  // ---------- Abierto ahora (hora de Chile) ----------
  function ahoraEnChile() {
    const parts = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value || '';
    const dia = get('weekday');
    const idx = DIAS.findIndex((d) => d.toLowerCase() === dia.toLowerCase());
    return { idx: idx < 0 ? new Date().getDay() : idx, min: (+get('hour') % 24) * 60 + +get('minute') };
  }
  const aMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const deDia = (i) => TIENDA.horario.find((h) => h.dia === DIAS[i % 7]);

  function estado() {
    const { idx, min } = ahoraEnChile();
    const hoy = deDia(idx);
    if (hoy && !hoy.cerrado && min >= aMin(hoy.abre) && min < aMin(hoy.cierra)) {
      return { abierto: true, texto: `Abierto ahora · hasta las ${hoy.cierra}`, idx };
    }
    for (let i = 0; i < 7; i++) {
      const h = deDia(idx + i);
      if (!h || h.cerrado || (i === 0 && min >= aMin(h.abre))) continue;
      const cuando = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${h.dia.toLowerCase()}`;
      return { abierto: false, texto: `Cerrado · abrimos ${cuando} a las ${h.abre}`, idx };
    }
    return { abierto: false, texto: 'Revisa nuestro horario', idx };
  }

  function pintarEstado() {
    if (!TIENDA.horario.length) return;
    const e = estado();
    $$('[data-status]').forEach((el) => {
      el.classList.toggle('is-closed', !e.abierto);
      const t = $('[data-status-text]', el);
      if (t) t.textContent = e.texto;
    });
    $$('[data-hours] li').forEach((li) => li.classList.toggle('is-today', li.dataset.dia === DIAS[e.idx]));
  }
  pintarEstado();
  setInterval(pintarEstado, 60 * 1000);

  // ---------- Animación de entrada ----------
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  // ---------- Carta: filtros y ficha ----------
  const CARTA = window.CARTA;
  if (!CARTA) return;

  const filtros = $('[data-filters]');
  const grupos = $$('[data-group]');
  function filtrar(cat, { scroll = true } = {}) {
    $$('.chip', filtros).forEach((c) => c.classList.toggle('is-active', c.dataset.cat === cat));
    grupos.forEach((g) => { g.hidden = cat !== 'todos' && g.dataset.group !== cat; });
    if (scroll) window.scrollTo({ top: filtros.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
  }
  filtros.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filtrar(chip.dataset.cat);
    history.replaceState(null, '', chip.dataset.cat === 'todos' ? location.pathname : `#${chip.dataset.cat}`);
  });

  const sheet = $('#sheet');
  const clp = (n) => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  function abrir(id) {
    const p = CARTA.find((x) => x.id === id);
    if (!p) return false;
    $('#sheetImg').src = p.foto;
    $('#sheetImg').alt = p.nombre;
    $('#sheetCat').textContent = [p.categoria, p.etiqueta].filter(Boolean).join(' · ');
    $('#sheetName').textContent = p.nombre;
    $('#sheetDesc').textContent = p.descripcion;
    $('#sheetPrice').textContent = p.precio ? clp(p.precio) : '';
    $('#sheetNote').textContent = p.agotado
      ? 'Hoy no está disponible. Pregunta en la barra por alternativas.'
      : `Disponible en ${TIENDA.direccion}. Consumo en el local o para llevar.`;
    if (!sheet.open) sheet.showModal();
    history.replaceState(null, '', `#${id}`);
    return true;
  }
  sheet.addEventListener('close', () => history.replaceState(null, '', location.pathname));
  sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest('[data-close]')) sheet.close(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) abrir(b.dataset.view);
  });

  // Llegada con #categoria o #producto (desde la portada o un enlace compartido)
  function desdeHash() {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (!hash) return;
    if (grupos.some((g) => g.dataset.group === hash)) {
      filtrar(hash, { scroll: false });
      requestAnimationFrame(() => window.scrollTo({ top: filtros.getBoundingClientRect().top + window.scrollY - 70 }));
    } else if (CARTA.some((p) => p.id === hash)) {
      $(`[data-view="${CSS.escape(hash)}"]`)?.scrollIntoView({ block: 'center' });
      abrir(hash);
    }
  }
  desdeHash();
  window.addEventListener('hashchange', desdeHash);
})();

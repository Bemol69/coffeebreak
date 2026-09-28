/* Utilidades compartidas: carga de contenido, header, footer y animaciones */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  function bind(data, root = document) {
    root.querySelectorAll('[data-text]').forEach((el) => {
      const v = get(data, el.dataset.text);
      el.textContent = v ?? '';
    });
    root.querySelectorAll('[data-src]').forEach((el) => {
      const v = get(data, el.dataset.src);
      if (v) el.src = v;
    });
  }

  function igUrl(c) { return c.instagram ? `https://www.instagram.com/${c.instagram.replace(/^@/, '')}/` : '#'; }
  function waUrl(c) { return c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, '')}` : ''; }

  function openStatus(hours, now = new Date()) {
    const today = hours.find((h) => h.day === DAYS[now.getDay()]);
    const mins = now.getHours() * 60 + now.getMinutes();
    const toMin = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
    if (today && !today.closed && mins >= toMin(today.open) && mins < toMin(today.close)) {
      return { open: true, label: `Abierto ahora · hasta las ${today.close}` };
    }
    // Buscar la próxima apertura
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(now.getDate() + i);
      const h = hours.find((x) => x.day === DAYS[d.getDay()]);
      if (!h || h.closed) continue;
      if (i === 0 && mins >= toMin(h.open)) continue;
      const when = i === 0 ? 'hoy' : i === 1 ? 'mañana' : h.day.toLowerCase();
      return { open: false, label: `Cerrado · abrimos ${when} a las ${h.open}` };
    }
    return { open: false, label: 'Cerrado' };
  }

  function header(data, page) {
    const s = data.site;
    const links = [
      ['Inicio', '/', page === 'home'],
      ['Nosotros', '/#nosotros', false],
      ['Carta', '/productos', page === 'productos'],
      ['Visítanos', '/#visitanos', false],
    ];
    document.getElementById('header').innerHTML = `
      ${s.announcement ? `<div class="announce">${esc(s.announcement)}</div>` : ''}
      <nav class="nav" id="nav">
        <div class="wrap nav__inner">
          <a class="brand" href="/"><img src="${esc(s.logo)}" alt=""><span>${esc(s.name)}</span></a>
          <ul class="nav__links">
            ${links.map(([t, h, cur]) => `<li><a href="${h}"${cur ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}
          </ul>
          <a class="btn btn--dark nav__cta" href="${esc(data.contact.mapsUrl)}" target="_blank" rel="noopener">Cómo llegar <span class="arrow">↗</span></a>
          <button class="nav__toggle" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span></button>
        </div>
      </nav>`;
    const nav = document.getElementById('nav');
    const toggle = nav.querySelector('.nav__toggle');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
    nav.querySelectorAll('.nav__links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  function footer(data) {
    const s = data.site, c = data.contact;
    const hours = data.hours.map((h) => `<li>${esc(h.day)} · ${h.closed ? 'Cerrado' : `${esc(h.open)} – ${esc(h.close)}`}</li>`).join('');
    const wa = waUrl(c);
    document.getElementById('footer').innerHTML = `
      <footer class="footer">
        <div class="wrap">
          <p class="footer__word">${esc(s.name)}</p>
          <div class="footer__top">
            <div>
              <h4>${esc(s.name)}</h4>
              <p>${esc(s.footerText)}</p>
            </div>
            <div>
              <h4>Horario</h4>
              <ul>${hours}</ul>
            </div>
            <div>
              <h4>Encuéntranos</h4>
              <ul>
                <li>${esc(c.address)}, ${esc(c.city)}</li>
                <li><a href="${esc(igUrl(c))}" target="_blank" rel="noopener">Instagram @${esc(c.instagram)}</a></li>
                ${wa ? `<li><a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a></li>` : ''}
                ${c.phone ? `<li><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></li>` : ''}
                ${c.email ? `<li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : ''}
                <li><a href="${esc(c.mapsUrl)}" target="_blank" rel="noopener">Ver en Google Maps</a></li>
              </ul>
            </div>
          </div>
          <div class="footer__bottom">
            <span>© ${new Date().getFullYear()} ${esc(s.name)} · Rancagua, Chile</span>
            <a href="/admin">Administrar</a>
          </div>
        </div>
      </footer>`;
  }

  function reveal() {
    const els = document.querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) return els.forEach((e) => e.classList.add('in'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach((e) => io.observe(e));
  }

  function productCard(p, { tag = 'a' } = {}) {
    const href = `/productos#${encodeURIComponent(p.id)}`;
    const badge = !p.available ? 'Agotado hoy' : p.tag;
    return `
      <${tag} class="card${p.available ? '' : ' card--off'}" ${tag === 'a' ? `href="${href}"` : `data-id="${esc(p.id)}" tabindex="0" role="button"`}>
        <div class="card__img">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
          ${badge ? `<span class="card__tag">${esc(badge)}</span>` : ''}
        </div>
        <div class="card__body">
          <h3 class="card__name">${esc(p.name)}</h3>
          ${p.price ? `<span class="card__price">${esc(p.price)}</span>` : `<span class="card__cat">${esc(p.category)}</span>`}
        </div>
        ${p.description ? `<p class="card__desc">${esc(p.description)}</p>` : ''}
      </${tag}>`;
  }

  async function load() {
    const res = await fetch('/api/content');
    if (!res.ok) throw new Error('No se pudo cargar el contenido');
    const data = await res.json();
    const page = document.body.dataset.page;
    if (data.site.metaDescription) document.querySelector('meta[name="description"]')?.setAttribute('content', data.site.metaDescription);
    header(data, page);
    footer(data);
    bind(data);
    return data;
  }

  window.CB = { esc, get, bind, load, reveal, openStatus, productCard, igUrl, waUrl, DAYS };
})();

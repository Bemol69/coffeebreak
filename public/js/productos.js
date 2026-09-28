(async function () {
  const { esc, load, reveal, productCard } = window.CB;
  const data = await load();
  const products = data.products;
  const cats = data.categories.filter((c) => products.some((p) => p.category === c));
  let active = 'Todos';

  const filters = document.getElementById('filters');
  const menu = document.getElementById('menu');

  function renderFilters() {
    const all = [['Todos', products.length], ...cats.map((c) => [c, products.filter((p) => p.category === c).length])];
    filters.innerHTML = all.map(([c, n]) =>
      `<button class="chip" type="button" data-cat="${esc(c)}" aria-pressed="${c === active}">${esc(c)}<sup>${n}</sup></button>`).join('');
  }

  function renderMenu() {
    const groups = active === 'Todos' ? cats : [active];
    menu.innerHTML = groups.map((c) => {
      const list = products.filter((p) => p.category === c);
      return `
        <section class="menu-group" id="cat-${esc(c)}">
          <h2 class="display h-md menu-group__title">${esc(c)} <small>${list.length} productos</small></h2>
          <div class="cards menu-grid">${list.map((p) => productCard(p, { tag: 'article' })).join('')}</div>
        </section>`;
    }).join('') || '<p class="empty">Pronto agregaremos productos a la carta.</p>';
  }

  filters.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    active = b.dataset.cat;
    renderFilters();
    renderMenu();
    window.scrollTo({ top: filters.offsetTop - 72, behavior: 'smooth' });
  });

  // Modal de detalle
  const modal = document.getElementById('modal');
  function openProduct(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    document.getElementById('modal-img').src = p.image;
    document.getElementById('modal-img').alt = p.name;
    document.getElementById('modal-cat').textContent = p.category + (p.tag ? ` · ${p.tag}` : '');
    document.getElementById('modal-title').textContent = p.name;
    document.getElementById('modal-desc').textContent = p.description;
    document.getElementById('modal-price').textContent = p.price || '';
    document.getElementById('modal-note').textContent = p.available
      ? `Disponible en ${data.contact.address}. Consumo en el local o para llevar.`
      : 'Hoy no está disponible — pregunta en la barra por alternativas.';
    if (!modal.open) modal.showModal();
    history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  }
  function closeModal() { modal.close(); }
  modal.addEventListener('close', () => history.replaceState(null, '', location.pathname));
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
  menu.addEventListener('click', (e) => { const c = e.target.closest('.card[data-id]'); if (c) openProduct(c.dataset.id); });
  menu.addEventListener('keydown', (e) => {
    const c = e.target.closest('.card[data-id]');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProduct(c.dataset.id); }
  });

  renderFilters();
  renderMenu();
  reveal();

  // Llegada desde la home con #producto
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) {
    const card = menu.querySelector(`.card[data-id="${CSS.escape(hash)}"]`);
    if (card) { card.scrollIntoView({ block: 'center' }); openProduct(hash); }
  }
})();

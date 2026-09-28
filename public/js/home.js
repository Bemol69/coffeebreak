(async function () {
  const { esc, load, reveal, openStatus, productCard, igUrl, waUrl, DAYS } = window.CB;
  const data = await load();
  const { site, contact } = data;

  // Estado abierto/cerrado
  const st = openStatus(data.hours);
  const statusEl = document.getElementById('status');
  statusEl.classList.toggle('status--closed', !st.open);
  statusEl.lastElementChild.textContent = st.label;

  // Marquee (duplicado para loop continuo)
  const items = (site.marquee || []).map((t) => `<span>${esc(t)}</span>`).join('');
  document.getElementById('marquee').innerHTML = items + items;

  // Destacados
  const featured = data.products.filter((p) => p.featured).slice(0, 4);
  document.getElementById('featured').innerHTML = featured.map((p) => productCard(p)).join('');

  // Mandamientos
  document.getElementById('rules').innerHTML = (data.rules || []).map((r) => `<li>${esc(r)}</li>`).join('');

  // Reseñas
  document.getElementById('reviews').innerHTML = (data.reviews || []).map((r) => `
    <figure class="review reveal">
      <span class="stars" aria-label="${r.stars} estrellas">${'★'.repeat(r.stars || 5)}</span>
      <blockquote>${esc(r.text)}</blockquote>
      <figcaption>— ${esc(r.name)}</figcaption>
    </figure>`).join('');

  // Galería
  const ig = igUrl(contact);
  document.getElementById('ig-link').href = ig;
  document.getElementById('gallery').innerHTML = (data.gallery || []).map((src, i) =>
    `<a href="${esc(ig)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="Foto ${i + 1} de Coffee Break" loading="lazy"></a>`).join('');

  // Horario
  const todayName = DAYS[new Date().getDay()];
  document.getElementById('hours').innerHTML = data.hours.map((h) => `
    <tr class="${h.day === todayName ? 'today' : ''}">
      <td>${esc(h.day)}</td>
      <td>${h.closed ? 'Cerrado' : `${esc(h.open)} – ${esc(h.close)}`}</td>
    </tr>`).join('');

  // Acciones de visita
  const wa = waUrl(contact);
  document.getElementById('visit-actions').innerHTML = `
    <a class="btn btn--terra" href="${esc(contact.mapsUrl)}" target="_blank" rel="noopener">Abrir en Google Maps <span class="arrow">↗</span></a>
    <a class="btn btn--ghost" href="${esc(ig)}" target="_blank" rel="noopener">Instagram</a>
    ${wa ? `<a class="btn btn--ghost" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}`;

  // Mapa
  const q = encodeURIComponent(contact.mapQuery || `${contact.address}, ${contact.city}`);
  document.getElementById('map').innerHTML =
    `<iframe title="Mapa de ${esc(site.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}&z=17&output=embed"></iframe>`;

  reveal();
})();

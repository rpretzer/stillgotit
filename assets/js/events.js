(function() {
  'use strict';

  const ENDPOINTS = ['/api/events.json', '/events.json'];
  const grid = document.getElementById('events-grid');
  const empty = document.getElementById('events-empty');

  if (!grid) return;

  async function fetchEvents() {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        return await res.json();
      } catch (_) {
        // try next
      }
    }
    throw new Error('Unable to load events');
  }

  function isFuture(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function render(events) {
    grid.innerHTML = '';
    if (!events.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    events.slice(0, 8).forEach((ev) => {
      const card = document.createElement('article');
      card.className = 'event-card fade-in';

      if (ev.imageUrl) {
        const media = document.createElement('div');
        media.className = 'event-media';
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.src = ev.imageUrl;
        img.alt = ev.title || 'Event poster';
        media.appendChild(img);
        card.appendChild(media);
      }

      const body = document.createElement('div');
      body.className = 'event-body';

      const h3 = document.createElement('h3');
      h3.className = 'event-title';
      h3.textContent = ev.title || 'Event';
      body.appendChild(h3);

      const meta = document.createElement('div');
      meta.className = 'event-meta';
      const when = document.createElement('div');
      when.textContent = `${formatDate(ev.startDate)}${ev.startTime ? ' • ' + ev.startTime : ''}`;
      meta.appendChild(when);
      if (ev.location) {
        const where = document.createElement('div');
        where.textContent = ev.location;
        meta.appendChild(where);
      }
      body.appendChild(meta);

      if (ev.description) {
        const desc = document.createElement('p');
        desc.textContent = ev.description;
        body.appendChild(desc);
      }

      const actions = document.createElement('div');
      actions.className = 'event-actions';
      const btn = document.createElement('a');
      btn.className = 'btn btn-primary';
      btn.href = ev.ticketUrl || '#tickets';
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
      btn.textContent = 'Get Tickets';
      btn.setAttribute('aria-label', `Get tickets for ${ev.title || 'event'}`);
      actions.appendChild(btn);
      body.appendChild(actions);

      card.appendChild(body);
      grid.appendChild(card);
    });

    // structured data
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: events.slice(0, 8).map((ev, idx) => ({
        '@type': 'Event',
        name: ev.title,
        startDate: ev.startDate,
        location: ev.location ? { '@type': 'Place', name: ev.location } : undefined,
        url: ev.ticketUrl || document.location.href,
        image: ev.imageUrl || undefined,
        position: idx + 1
      }))
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);

    if (typeof window.__observeFadeIns === 'function') window.__observeFadeIns(grid);
  }

  fetchEvents()
    .then((data) => {
      const events = Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [];
      const upcoming = events.filter((e) => e?.startDate && isFuture(e.startDate))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      render(upcoming);
    })
    .catch(() => {
      if (grid) grid.innerHTML = '<p class="section-subtitle">Unable to load events right now.</p>';
    });
})();



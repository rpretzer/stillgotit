'use strict';

(function() {
  const ENDPOINTS = ['/api/events.json', '/events.json'];
  const grid = document.getElementById('events-grid');
  const empty = document.getElementById('events-empty');
  const monthLabel = document.getElementById('events-month-label');
  const prevBtn = document.getElementById('events-prev');
  const nextBtn = document.getElementById('events-next');
  const modal = document.getElementById('event-modal');
  const modalBody = document.getElementById('event-modal-body');
  const modalClose = document.getElementById('event-modal-close');
  const weekdaysEl = document.getElementById('events-weekdays');

  if (!grid || !monthLabel) return;

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  function normalize(data) {
    return (Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [])
      .filter((e) => e?.startDate)
      .map((e) => ({
        title: e.title || 'Event',
        startDate: e.startDate,
        startTime: e.startTime || '',
        location: e.location || '',
        ticketUrl: e.ticketUrl || '',
        imageUrl: e.imageUrl || '',
        description: e.description || ''
      }));
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function iso(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  function renderWeekdays() {
    if (!weekdaysEl) return;
    weekdaysEl.innerHTML = '';
    WEEKDAYS.forEach((w) => {
      const div = document.createElement('div');
      div.textContent = w;
      weekdaysEl.appendChild(div);
    });
  }

  function renderModal(ev) {
    if (!modal || !modalBody) return;
    modalBody.innerHTML = '';

    const h = document.createElement('h3');
    h.id = 'event-modal-title';
    h.textContent = ev.title;
    modalBody.appendChild(h);

    const meta = document.createElement('p');
    meta.className = 'event-meta';
    meta.textContent = `${formatDate(ev.startDate)}${ev.startTime ? ' • ' + ev.startTime : ''}${ev.location ? ' • ' + ev.location : ''}`;
    modalBody.appendChild(meta);

    if (ev.imageUrl) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = ev.imageUrl;
      img.alt = ev.title;
      modalBody.appendChild(img);
    }

    if (ev.description) {
      const desc = document.createElement('p');
      desc.textContent = ev.description;
      modalBody.appendChild(desc);
    }

    const actions = document.createElement('div');
    actions.className = 'event-actions';
    const btn = document.createElement('a');
    btn.className = 'btn btn-primary';
    btn.href = ev.ticketUrl || '#tickets';
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.textContent = 'Get Tickets';
    btn.setAttribute('aria-label', `Get tickets for ${ev.title}`);
    actions.appendChild(btn);
    modalBody.appendChild(actions);

    modal.hidden = false;
  }

  function closeModal() {
    if (modal) modal.hidden = true;
  }

  function renderCalendar(events, year, month) {
    // month is 0-indexed
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const eventMap = events.reduce((acc, ev) => {
      const key = iso(ev.startDate);
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key).push(ev);
      return acc;
    }, new Map());

    grid.innerHTML = '';
    // blanks before first day
    for (let i = 0; i < startDay; i++) {
      const div = document.createElement('div');
      div.className = 'event-day disabled';
      grid.appendChild(div);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const key = iso(date);
      const dayEvents = eventMap.get(key) || [];

      const cell = document.createElement('div');
      cell.className = 'event-day';

      const dLabel = document.createElement('div');
      dLabel.className = 'event-date';
      dLabel.textContent = String(day);
      cell.appendChild(dLabel);

      if (dayEvents.length > 0) {
        const list = document.createElement('div');
        list.className = 'event-card-list';
        dayEvents.forEach((ev) => {
          const link = document.createElement('button');
          link.className = 'event-link';
          link.type = 'button';
          link.innerHTML = `<span class="event-dot"></span> ${ev.title}`;
          link.addEventListener('click', () => renderModal(ev));
          list.appendChild(link);
        });
        cell.appendChild(list);
      }

      grid.appendChild(cell);
    }

    if (empty) empty.hidden = events.length > 0;
    if (monthLabel) {
      const fmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
      monthLabel.textContent = fmt.format(new Date(year, month, 1));
    }
  }

  fetchEvents()
    .then((data) => {
      const events = normalize(data);
      renderWeekdays();
      let current = new Date();
      const renderCurrent = () => renderCalendar(events, current.getFullYear(), current.getMonth());
      renderCurrent();
      if (prevBtn) prevBtn.onclick = () => { current = new Date(current.getFullYear(), current.getMonth() - 1, 1); renderCurrent(); };
      if (nextBtn) nextBtn.onclick = () => { current = new Date(current.getFullYear(), current.getMonth() + 1, 1); renderCurrent(); };
    })
    .catch(() => {
      if (grid) grid.innerHTML = '<p class="section-subtitle">Unable to load events right now.</p>';
    });

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
})();



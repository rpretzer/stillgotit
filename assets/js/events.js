'use strict';

(function() {
  // Event JSON schema (Decap-managed at data/events.json):
  // [
  //   {
  //     "id": "big-energy-80s",
  //     "title": "Big Energy 80’s",
  //     "date": "2026-01-28",
  //     "time": "6PM",
  //     "location": "B-Side Lounge",
  //     "venue": "Cleveland",
  //     "description": "Pure 80’s nostalgia—synths, neon, and no pretense.",
  //     "ctaLabel": "Get Tickets",
  //     "ticketUrl": "https://...",
  //     "image": "/assets/images/uploads/gallery/full/....webp"
  //   }
  // ]

  // Decap-managed source (`data/events.json`)
  const ENDPOINTS = ['/data/events.json'];
  const grid = document.getElementById('events-grid');
  const empty = document.getElementById('events-empty');
  const monthLabel = document.getElementById('events-month-label');
  const prevBtn = document.getElementById('events-prev');
  const nextBtn = document.getElementById('events-next');
  const modal = document.getElementById('event-modal');
  const modalBody = document.getElementById('event-modal-body');
  const modalClose = document.getElementById('event-modal-close');
  const weekdaysEl = document.getElementById('events-weekdays');
  let lastFocus = null;

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
      .filter((e) => e?.date || e?.startDate)
      .map((e) => ({
        id: e.id || crypto.randomUUID(),
        title: e.title || 'Event',
        startDate: e.startDate || e.date,
        startTime: e.startTime || e.time || '',
        location: e.location || '',
        venue: e.venue || '',
        ticketUrl: e.ticketUrl || '',
        imageUrl: e.imageUrl || e.image || '',
        description: e.description || '',
        ctaLabel: e.ctaLabel || 'Get Tickets'
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
    lastFocus = document.activeElement;
    modalBody.innerHTML = '';

    const h = document.createElement('h3');
    h.id = 'event-modal-title';
    h.textContent = ev.title;
    modalBody.appendChild(h);

    const meta = document.createElement('p');
    meta.className = 'event-meta';
    meta.textContent = `${formatDate(ev.startDate)}${ev.startTime ? ' • ' + ev.startTime : ''}${ev.location ? ' • ' + ev.location : ''}${ev.venue ? ' • ' + ev.venue : ''}`;
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
    btn.textContent = ev.ctaLabel || 'Get Tickets';
    btn.setAttribute('aria-label', `Get tickets for ${ev.title}`);
    actions.appendChild(btn);
    modalBody.appendChild(actions);

    modal.hidden = false;
    modal.setAttribute('aria-labelledby', 'event-modal-title');

    const focusable = modal.querySelectorAll('a,button,[tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    if (first) first.focus();

    const handleTrap = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
      if (e.key === 'Tab' && focusable.length > 0) {
        const f = Array.from(focusable);
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i === 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    modal.addEventListener('keydown', handleTrap, { once: false });
  }

  function closeModal() {
    if (modal) {
      modal.hidden = true;
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }
  }

  function renderCalendar(events, year, month) {
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Filter events for this specific month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const monthEvents = events.filter(ev => {
      const evDate = new Date(ev.startDate);
      return evDate >= monthStart && evDate <= monthEnd;
    });

    const eventMap = monthEvents.reduce((acc, ev) => {
      const key = iso(ev.startDate);
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key).push(ev);
      return acc;
    }, new Map());

    // Show/hide empty message for this month
    let emptyMessage = document.getElementById('events-calendar-empty-message');
    if (!emptyMessage) {
      emptyMessage = document.createElement('div');
      emptyMessage.id = 'events-calendar-empty-message';
      emptyMessage.className = 'events-calendar-empty-message';
      const calendar = document.querySelector('.events-calendar');
      if (calendar) {
        calendar.insertBefore(emptyMessage, calendar.firstChild);
      }
    }

    if (monthEvents.length === 0) {
      const fmt = new Intl.DateTimeFormat(undefined, { month: 'long' });
      const monthName = fmt.format(new Date(year, month, 1));
      emptyMessage.textContent = `No events scheduled for ${monthName}`;
      emptyMessage.hidden = false;
    } else {
      emptyMessage.hidden = true;
    }

    grid.innerHTML = '';
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
          link.setAttribute('aria-label', `View event: ${ev.title}`);
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



'use strict';

(function() {
  // Data source
  const EVENTS_ENDPOINT = '/data/events.json';

  // DOM elements
  const grid = document.getElementById('events-page-grid');
  const emptyState = document.getElementById('events-page-empty');

  if (!grid) return;

  /**
   * Fetches events from CMS
   * @returns {Promise<Array>} Array of event objects
   */
  async function fetchEvents() {
    try {
      const res = await fetch(EVENTS_ENDPOINT, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      return Array.isArray(data?.events) ? data.events : [];
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  /**
   * Normalizes event data to consistent format
   * @param {Object} event - Raw event object from JSON
   * @returns {Object} Normalized event object
   */
  function normalizeEvent(event) {
    return {
      id: event.id || crypto.randomUUID(),
      title: event.title || 'Event',
      date: event.date || event.startDate,
      time: event.time || event.startTime || '',
      location: event.location || '',
      venue: event.venue || '',
      description: event.description || '',
      image: event.image || event.imageUrl || '',
      ticketUrl: event.ticketUrl || '',
      ctaLabel: event.ctaLabel || 'Get Tickets'
    };
  }

  /**
   * Checks if event date is in the past
   * @param {string} dateStr - Date string in YYYY-MM-DD format
   * @returns {boolean} True if event is past
   */
  function isPastEvent(dateStr) {
    if (!dateStr) return false;

    // Parse as local date to avoid timezone issues
    const parts = dateStr.split('-');
    const eventDate = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    return eventDate < today;
  }

  /**
   * Formats date string for display
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Formatted date (e.g., "Jan 15, 2026")
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';

    const parts = dateStr.split('-');
    const date = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Sorts events by date (newest first)
   * @param {Array} events - Array of event objects
   * @returns {Array} Sorted events
   */
  function sortEvents(events) {
    return events.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA; // Descending (newest first)
    });
  }

  /**
   * Creates event card HTML element
   * @param {Object} event - Normalized event object
   * @returns {HTMLElement} Event card element
   */
  function createEventCard(event) {
    const isPast = isPastEvent(event.date);
    const card = document.createElement('article');
    card.className = `event-page-card fade-in ${isPast ? 'past-event' : ''}`;
    card.setAttribute('data-event-id', event.id);

    // Card image
    if (event.image) {
      const imageDiv = document.createElement('div');
      imageDiv.className = 'card-image';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = event.image;
      img.alt = event.title;
      imageDiv.appendChild(img);
      card.appendChild(imageDiv);
    }

    // Card content
    const content = document.createElement('div');
    content.className = 'card-content';

    // Status badge
    const badge = document.createElement('span');
    badge.className = `event-status-badge ${isPast ? 'past' : 'upcoming'}`;
    badge.textContent = isPast ? 'Event Concluded' : 'Upcoming';
    content.appendChild(badge);

    // Event title
    const title = document.createElement('h3');
    title.textContent = event.title;
    content.appendChild(title);

    // Event metadata (date, time, location)
    const meta = document.createElement('div');
    meta.className = 'event-meta';

    if (event.date) {
      const dateItem = document.createElement('div');
      dateItem.className = 'event-meta-item';
      dateItem.innerHTML = `<strong>Date:</strong> ${formatDate(event.date)}`;
      meta.appendChild(dateItem);
    }

    if (event.time) {
      const timeItem = document.createElement('div');
      timeItem.className = 'event-meta-item';
      timeItem.innerHTML = `<strong>Time:</strong> ${event.time}`;
      meta.appendChild(timeItem);
    }

    if (event.location) {
      const locationItem = document.createElement('div');
      locationItem.className = 'event-meta-item';
      locationItem.innerHTML = `<strong>Location:</strong> ${event.location}`;
      meta.appendChild(locationItem);
    }

    content.appendChild(meta);

    // Event description
    if (event.description) {
      const desc = document.createElement('p');
      desc.textContent = event.description;
      content.appendChild(desc);
    }

    // CTA button (only for upcoming events with ticket URL)
    if (!isPast && event.ticketUrl) {
      const btn = document.createElement('a');
      btn.className = 'btn btn-primary';
      btn.href = event.ticketUrl;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
      btn.textContent = event.ctaLabel;
      btn.setAttribute('aria-label', `Get tickets for ${event.title}`);
      content.appendChild(btn);
    }

    card.appendChild(content);
    return card;
  }

  /**
   * Renders events to the grid
   * @param {Array} events - Array of normalized events
   */
  function renderEvents(events) {
    // Clear loading skeletons
    grid.innerHTML = '';

    if (events.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    // Sort events (newest first)
    const sortedEvents = sortEvents(events);

    // Create and append cards
    sortedEvents.forEach(event => {
      const card = createEventCard(event);
      grid.appendChild(card);
    });

    // Trigger fade-in animations
    triggerFadeIns();
  }

  /**
   * Triggers fade-in animation for cards
   * Reuses existing fade-in logic from scripts.js
   */
  function triggerFadeIns() {
    const fadeElements = document.querySelectorAll('.fade-in');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    fadeElements.forEach(el => observer.observe(el));
  }

  /**
   * Main initialization function
   */
  async function init() {
    try {
      const rawEvents = await fetchEvents();
      const events = rawEvents.map(normalizeEvent);
      renderEvents(events);
    } catch (error) {
      console.error('Failed to initialize events page:', error);
      grid.innerHTML = '<p class="section-subtitle">Unable to load events. Please try again later.</p>';
    }
  }

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

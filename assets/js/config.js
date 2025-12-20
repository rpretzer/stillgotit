/* ========================================
   Configuration Constants
   Centralized URLs and API endpoints
   ======================================== */

(function() {
  'use strict';

  // API Endpoints
  window.SGIC_CONFIG = {
    // Merch API (Cloudflare Worker)
    API_BASE: 'https://sgic-merch-api.rpretzer.workers.dev/api',
    
    // CMS Content Paths
    CONTENT_PATHS: {
      UPDATES: 'content/updates.json',
      GALLERY: 'content/gallery.json',
      SITE_SETTINGS: 'content/site.json',
      MERCH_CATALOG: 'content/merch.json',
      EVENTS: 'data/events.json'
    },
    
    // CMS Page Paths
    getPagePath: function(pageSlug) {
      return `content/pages/${pageSlug}.json`;
    },
    
    // Local Storage Keys
    STORAGE: {
      CART: 'sgic_merch_cart_v1',
      ABANDONED_CART_TOKEN: 'sgic_abandoned_cart_token'
    }
  };
})();


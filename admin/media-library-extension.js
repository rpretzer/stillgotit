/**
 * Custom Media Library Extension for Decap CMS
 * Enhances the file picker to show all files from media-index.json
 */

(function() {
  'use strict';

  // Wait for Decap CMS to load
  if (typeof window.CMS === 'undefined') {
    setTimeout(arguments.callee, 100);
    return;
  }

  // Load media index and inject into file picker
  async function enhanceMediaLibrary() {
    try {
      const response = await fetch('/content/media-index.json?t=' + Date.now(), {
        cache: 'no-store'
      });
      if (!response.ok) return;
      
      const data = await response.json();
      if (!data.files || !Array.isArray(data.files)) return;

      // Find the media library modal/file picker
      const mediaModal = document.querySelector('[class*="MediaLibrary"], [class*="media-library"], [class*="FileUpload"]');
      if (!mediaModal) return;

      // Create a custom section showing all files
      const allFilesSection = document.createElement('div');
      allFilesSection.className = 'custom-media-library-all-files';
      allFilesSection.innerHTML = `
        <div style="padding: 16px; border-bottom: 1px solid #e0e0e0; background: #f5f5f5;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">All Repository Files (${data.files.length})</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">Files from assets/images/uploads/ including subdirectories</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; padding: 16px; max-height: 400px; overflow-y: auto;">
          ${data.files.map(file => `
            <div class="custom-media-item" style="cursor: pointer; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; transition: transform 0.2s;" 
                 data-url="${file.url}" 
                 data-path="${file.path}"
                 onclick="window.selectCustomMediaFile('${file.url}', '${file.path}')">
              <img src="${file.preview}" alt="${file.name}" style="width: 100%; height: 100px; object-fit: cover; display: block;" loading="lazy" />
              <div style="padding: 8px; font-size: 11px; color: #333; word-break: break-word;">${file.name}</div>
            </div>
          `).join('')}
        </div>
      `;

      // Insert before existing media library content
      const existingContent = mediaModal.querySelector('[class*="MediaLibrary"]') || mediaModal.firstElementChild;
      if (existingContent && existingContent.parentNode) {
        existingContent.parentNode.insertBefore(allFilesSection, existingContent);
      } else {
        mediaModal.appendChild(allFilesSection);
      }

      // Add click handler
      window.selectCustomMediaFile = function(url, path) {
        // Trigger Decap CMS file selection
        if (window.CMS && window.CMS.widgets) {
          // Find the active widget and set its value
          const activeWidget = document.querySelector('[class*="Widget"]:focus, [class*="widget"]:focus');
          if (activeWidget) {
            const input = activeWidget.querySelector('input[type="text"]');
            if (input) {
              input.value = url;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
        
        // Close modal if possible
        const closeBtn = document.querySelector('[class*="Modal"] [class*="close"], [aria-label*="close" i]');
        if (closeBtn) closeBtn.click();
      };

    } catch (error) {
      console.error('Failed to enhance media library:', error);
    }
  }

  // Try to enhance when CMS loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceMediaLibrary);
  } else {
    enhanceMediaLibrary();
  }

  // Also watch for modal opens
  const observer = new MutationObserver(() => {
    if (document.querySelector('[class*="MediaLibrary"], [class*="media-library"]')) {
      enhanceMediaLibrary();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();


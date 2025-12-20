/**
 * Custom Media Library Extension for Decap CMS
 * Enhances the file picker to show all files from media-index.json
 * This works around the GitHub backend limitation where only CMS-uploaded files are shown
 */

(function() {
  'use strict';

  let mediaIndexData = null;
  let injected = false;

  // Load media index data
  async function loadMediaIndex() {
    if (mediaIndexData) return mediaIndexData;
    
    try {
      const response = await fetch('/content/media-index.json?t=' + Date.now(), {
        cache: 'no-store'
      });
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.files && Array.isArray(data.files)) {
        mediaIndexData = data;
        return data;
      }
    } catch (error) {
      console.error('Failed to load media index:', error);
    }
    return null;
  }

  // Inject custom media library into file picker modal
  function injectCustomMediaLibrary() {
    if (injected) return;
    
    // Find the media library modal - try multiple selectors
    const modalSelectors = [
      '[class*="MediaLibrary"]',
      '[class*="media-library"]',
      '[class*="FileUpload"]',
      '[class*="file-upload"]',
      '[role="dialog"]',
      '.nc-mediaLibrary',
      '[data-testid="media-library"]'
    ];

    let mediaModal = null;
    for (const selector of modalSelectors) {
      mediaModal = document.querySelector(selector);
      if (mediaModal) break;
    }

    if (!mediaModal || !mediaIndexData) return;

    // Check if we've already injected
    if (mediaModal.querySelector('.custom-media-library-all-files')) {
      injected = true;
      return;
    }

    // Create custom section
    const allFilesSection = document.createElement('div');
    allFilesSection.className = 'custom-media-library-all-files';
    allFilesSection.style.cssText = 'border-top: 2px solid #0066cc; margin-top: 16px;';
    
    const header = document.createElement('div');
    header.style.cssText = 'padding: 16px; background: #f5f5f5; border-bottom: 1px solid #e0e0e0;';
    header.innerHTML = `
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #333;">All Repository Files (${mediaIndexData.files.length})</h3>
      <p style="margin: 0; font-size: 12px; color: #666;">Files from assets/images/uploads/ including subdirectories</p>
    `;
    
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; padding: 16px; max-height: 500px; overflow-y: auto;';
    
    mediaIndexData.files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'custom-media-item';
      item.style.cssText = 'cursor: pointer; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; transition: all 0.2s; background: white;';
      item.dataset.url = file.url;
      item.dataset.path = file.path;
      
      item.addEventListener('mouseenter', () => {
        item.style.transform = 'scale(1.05)';
        item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.transform = 'scale(1)';
        item.style.boxShadow = 'none';
      });
      
      item.addEventListener('click', () => selectCustomMediaFile(file.url, file.path));
      
      const img = document.createElement('img');
      img.src = file.preview;
      img.alt = file.name;
      img.style.cssText = 'width: 100%; height: 100px; object-fit: cover; display: block;';
      img.loading = 'lazy';
      
      const label = document.createElement('div');
      label.style.cssText = 'padding: 8px; font-size: 11px; color: #333; word-break: break-word; line-height: 1.3;';
      label.textContent = file.name;
      
      item.appendChild(img);
      item.appendChild(label);
      grid.appendChild(item);
    });
    
    allFilesSection.appendChild(header);
    allFilesSection.appendChild(grid);
    
    // Insert into modal - try to find the main content area
    const modalContent = mediaModal.querySelector('[class*="content"], [class*="body"], [class*="main"]') || mediaModal;
    if (modalContent) {
      modalContent.appendChild(allFilesSection);
      injected = true;
    }
  }

  // Handle file selection
  function selectCustomMediaFile(url, path) {
    // Find the active image widget input
    const activeInputs = document.querySelectorAll('input[type="text"][value=""], input[type="text"]:focus');
    
    // Try to find the most recently opened widget
    const modals = document.querySelectorAll('[role="dialog"], [class*="Modal"]');
    if (modals.length > 0) {
      const lastModal = modals[modals.length - 1];
      const input = lastModal.querySelector('input[type="text"]');
      if (input) {
        input.value = url;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Try to trigger Decap CMS update
        if (window.CMS && window.CMS.widgets) {
          const widget = window.CMS.widgets.getWidget(input);
          if (widget && widget.setValue) {
            widget.setValue(url);
          }
        }
      }
    }
    
    // Close modal
    setTimeout(() => {
      const closeBtn = document.querySelector('[aria-label*="close" i], [class*="close"], button[aria-label*="Close" i]');
      if (closeBtn) closeBtn.click();
    }, 100);
  }

  // Initialize
  async function init() {
    await loadMediaIndex();
    
    // Watch for modal opens
    const observer = new MutationObserver(() => {
      if (document.querySelector('[class*="MediaLibrary"], [class*="media-library"], [role="dialog"]')) {
        setTimeout(injectCustomMediaLibrary, 300); // Wait for modal to fully render
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also try immediately
    setTimeout(injectCustomMediaLibrary, 1000);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


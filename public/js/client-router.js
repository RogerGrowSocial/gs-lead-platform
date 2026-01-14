/**
 * Client-Side Router voor snelle navigatie zonder page reloads
 * Intercepteert link clicks en laadt content via AJAX
 */

(function() {
  'use strict';

  // Config
  const CONFIG = {
    // Routes die client-side geladen moeten worden (alle admin en dashboard routes)
    clientRoutes: [
      '/dashboard',
      '/admin'
    ],
    // Routes die altijd full page reload moeten doen
    skipRoutes: [
      '/login',
      '/logout',
      '/register',
      '/api/',
      '/auth/',
      '/onboarding'
    ],
    // Selector voor main content area (probeer verschillende selectors)
    contentSelector: '.main-content, main, #main-content, .content-wrapper, .main-container, .admin-content, .dashboard-content',
    // Cache voor geladen content
    cache: new Map(),
    cacheMaxAge: 5 * 60 * 1000 // 5 minuten
  };

  // State
  let isNavigating = false;
  let currentUrl = window.location.pathname;

  /**
   * Check of een route client-side geladen moet worden
   */
  function shouldHandleClientSide(href) {
    // Skip externe links
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return false;
    }

    // Skip routes die altijd full reload moeten doen
    if (CONFIG.skipRoutes.some(route => href.startsWith(route))) {
      return false;
    }

    // Skip hash links
    if (href.startsWith('#')) {
      return false;
    }

    // Check of het een client route is (prefix match)
    return CONFIG.clientRoutes.some(route => href.startsWith(route));
  }

  /**
   * Haal content op via fetch
   */
  async function fetchPageContent(url) {
    try {
      // Check cache eerst
      const cached = CONFIG.cache.get(url);
      if (cached && (Date.now() - cached.timestamp) < CONFIG.cacheMaxAge) {
        return cached.html;
      }

      // Fetch nieuwe content
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest', // Markeer als AJAX request
          'Accept': 'text/html'
        },
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      
      // Parse HTML en extract alleen de content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Find main content - probeer verschillende selectors
      let content = null;
      const selectors = CONFIG.contentSelector.split(',').map(s => s.trim());
      
      for (const selector of selectors) {
        content = doc.querySelector(selector);
        if (content) break;
      }

      // Als nog steeds geen content, probeer body > main of body > .container
      if (!content) {
        content = doc.querySelector('body > main') || 
                  doc.querySelector('body > .container') ||
                  doc.querySelector('body > div[class*="main"]') ||
                  doc.body;
      }

      // Extract alleen de innerHTML, niet de hele body
      const contentHtml = content === doc.body ? 
        Array.from(doc.body.children).map(el => el.outerHTML).join('') : 
        content.innerHTML;

      // Cache de content
      CONFIG.cache.set(url, {
        html: contentHtml,
        timestamp: Date.now()
      });

      // Cleanup oude cache entries
      if (CONFIG.cache.size > 50) {
        const entriesToDelete = [];
        for (const [key, value] of CONFIG.cache.entries()) {
          if ((Date.now() - value.timestamp) > CONFIG.cacheMaxAge) {
            entriesToDelete.push(key);
          }
        }
        entriesToDelete.forEach(key => CONFIG.cache.delete(key));
      }

      return contentHtml;
    } catch (error) {
      console.error('[Client Router] Error fetching content:', error);
      throw error;
    }
  }

  /**
   * Update page content zonder reload
   */
  async function navigateTo(url, pushState = true) {
    if (isNavigating) return;
    if (url === currentUrl) return;

    isNavigating = true;
    currentUrl = url;

    try {
      // Show loading indicator
      document.body.classList.add('navigating');

      // Fetch content
      const content = await fetchPageContent(url);

      // Find content container - probeer verschillende selectors
      let container = null;
      const selectors = CONFIG.contentSelector.split(',').map(s => s.trim());
      
      for (const selector of selectors) {
        container = document.querySelector(selector);
        if (container) break;
      }

      // Fallback selectors
      if (!container) {
        container = document.querySelector('body > main') || 
                    document.querySelector('body > .container') ||
                    document.querySelector('body > div[class*="main"]') ||
                    document.querySelector('.admin-content') ||
                    document.querySelector('.dashboard-content');
      }

      if (!container) {
        console.error('[Client Router] Content container not found, falling back to full reload');
        window.location.href = url;
        return;
      }

      // Update content met fade effect
      container.style.opacity = '0';
      container.style.transition = 'opacity 150ms ease-out';
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      container.innerHTML = content;
      
      // Update browser history
      if (pushState) {
        window.history.pushState({ url: url }, '', url);
      }

      // Update page title (haal uit nieuwe content als mogelijk)
      const titleMatch = content.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) {
        document.title = titleMatch[1];
      }

      // Re-initialize scripts in nieuwe content
      // Execute any script tags in the new content
      const scripts = container.querySelectorAll('script');
      scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });

      // Trigger custom event voor andere scripts
      window.dispatchEvent(new CustomEvent('page:loaded', { 
        detail: { url: url, content: content } 
      }));

      // Fade in nieuwe content
      await new Promise(resolve => setTimeout(resolve, 50));
      container.style.opacity = '1';

      // Update active menu items
      updateActiveMenuItems(url);

    } catch (error) {
      console.error('[Client Router] Navigation failed:', error);
      // Fallback naar full page reload na korte delay
      setTimeout(() => {
        window.location.href = url;
      }, 100);
      return;
    } finally {
      isNavigating = false;
      document.body.classList.remove('navigating');
    }
  }

  /**
   * Update active menu items
   */
  function updateActiveMenuItems(url) {
    // Update sidebar menu items
    document.querySelectorAll('.menu-item, .nav-link').forEach(item => {
      const href = item.getAttribute('href');
      if (href && url.startsWith(href)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * Intercept link clicks
   */
  function handleLinkClick(e) {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Skip als modifier keys ingedrukt
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
      return;
    }

    // Skip als target="_blank"
    if (link.getAttribute('target') === '_blank') {
      return;
    }

    // Skip form submissions en special links
    if (link.closest('form') || link.hasAttribute('download')) {
      return;
    }

    // Check of we client-side moeten navigeren
    if (!shouldHandleClientSide(href)) {
      return; // Laat browser normale navigatie doen
    }

    e.preventDefault();
    e.stopPropagation();
    navigateTo(href);
  }

  /**
   * Handle browser back/forward
   */
  function handlePopState(e) {
    const url = window.location.pathname + window.location.search;
    navigateTo(url, false); // Don't push state, we're already there
  }

  /**
   * Initialize router
   */
  function init() {
    // Intercept link clicks (use capture phase to catch early)
    document.addEventListener('click', handleLinkClick, true);

    // Handle browser back/forward
    window.addEventListener('popstate', handlePopState);

    // Update active menu items on initial load
    updateActiveMenuItems(window.location.pathname);

    // Debug: log initialization
    if (window.GS_DEBUG || localStorage.getItem('GS_DEBUG') === 'true') {
      console.log('[Client Router] Initialized', {
        clientRoutes: CONFIG.clientRoutes,
        currentUrl: window.location.pathname
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export voor gebruik in andere scripts
  window.ClientRouter = {
    navigate: navigateTo,
    clearCache: () => CONFIG.cache.clear()
  };
})();

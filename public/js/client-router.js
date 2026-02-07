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
    // Voor admin: .main-container binnen .main-content
    // Voor dashboard: .main-content of .content-wrapper
    contentSelector: '.main-container, .main-content, main, #main-content, .content-wrapper, .admin-content, .dashboard-content',
    // Cache voor geladen content
    cache: new Map(),
    cacheMaxAge: 10 * 60 * 1000, // 10 minuten (verhoogd voor betere performance)
    // Prefetch links on hover voor instant loading
    prefetchOnHover: true,
    prefetchDelay: 100 // ms delay before prefetch
  };

  // State
  let isNavigating = false;
  let currentUrl = window.location.pathname;
  let bootstrapData = {
    admin: null,
    dashboard: null
  };

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

    // Force full page reload bij cross-area navigatie (dashboard <-> admin)
    const currentArea = currentUrl.startsWith('/admin') ? 'admin' : (currentUrl.startsWith('/dashboard') ? 'dashboard' : null);
    const targetArea = href.startsWith('/admin') ? 'admin' : (href.startsWith('/dashboard') ? 'dashboard' : null);
    
    if (currentArea && targetArea && currentArea !== targetArea) {
      console.log('[Client Router] Cross-area navigation detected, forcing full reload:', currentArea, '->', targetArea);
      return false; // Force full page reload
    }

    // Check of het een client route is (prefix match)
    return CONFIG.clientRoutes.some(route => href.startsWith(route));
  }

  /**
   * Haal content op via fetch
   * Returns both content HTML and full HTML for stylesheet extraction
   */
  async function fetchPageContent(url) {
    try {
      // Check cache eerst
      const cached = CONFIG.cache.get(url);
      if (cached && (Date.now() - cached.timestamp) < CONFIG.cacheMaxAge) {
        return { content: cached.html, fullHtml: cached.fullHtml || '' };
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
      // Voor admin layout: zoek .main-container binnen .main-content
      // Voor dashboard: zoek .main-content direct
      let content = null;
      
      // Eerst proberen .main-container (admin layout)
      content = doc.querySelector('.main-container');
      
      // Als dat niet werkt, probeer .main-content
      if (!content) {
        content = doc.querySelector('.main-content');
      }
      
      // Fallback naar andere selectors
      if (!content) {
        const selectors = CONFIG.contentSelector.split(',').map(s => s.trim());
        for (const selector of selectors) {
          content = doc.querySelector(selector);
          if (content) break;
        }
      }

      // Als nog steeds geen content, probeer body > main of body > .container
      if (!content) {
        content = doc.querySelector('body > main') || 
                  doc.querySelector('body > .container') ||
                  doc.querySelector('body > div[class*="main"]');
      }

      // Laatste fallback: gebruik body maar skip header/footer
      if (!content || content === doc.body) {
        const mainEl = doc.querySelector('main');
        if (mainEl) {
          content = mainEl;
        } else {
          // Extract alleen children van body (skip scripts, etc)
          const bodyChildren = Array.from(doc.body.children);
          const mainContent = bodyChildren.find(el => 
            el.classList.contains('main-content') || 
            el.classList.contains('main-container') ||
            el.tagName === 'MAIN'
          );
          content = mainContent || doc.body;
        }
      }

      // Extract content HTML
      let contentHtml;
      if (content === doc.body) {
        // Skip scripts, styles, etc - alleen main content
        const skipTags = ['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE'];
        contentHtml = Array.from(content.children)
          .filter(el => !skipTags.includes(el.tagName))
          .map(el => el.outerHTML)
          .join('');
      } else {
        contentHtml = content.innerHTML;
      }

      // Cache de content (zowel content als full HTML voor stylesheet extraction)
      CONFIG.cache.set(url, {
        html: contentHtml,
        fullHtml: html, // Store full HTML for stylesheet extraction
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

      return { content: contentHtml, fullHtml: html };
    } catch (error) {
      console.error('[Client Router] Error fetching content:', error);
      throw error;
    }
  }

  /**
   * Load bootstrap data for admin or dashboard
   */
  async function loadBootstrapData(url) {
    const isAdmin = url.startsWith('/admin');
    const isDashboard = url.startsWith('/dashboard');
    
    if (!isAdmin && !isDashboard) {
      return null;
    }
    
    // Check if we already have fresh bootstrap data (cache for 30 seconds)
    const cacheKey = isAdmin ? 'admin' : 'dashboard';
    const cached = bootstrapData[cacheKey];
    if (cached && (Date.now() - cached.timestamp) < 30000) {
      return cached.data;
    }
    
    try {
      const endpoint = isAdmin ? '/api/admin/bootstrap' : '/api/dashboard/bootstrap';
      const response = await fetch(endpoint, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        bootstrapData[cacheKey] = {
          data: data,
          timestamp: Date.now()
        };
        
        // Store in window for easy access by other scripts
        if (isAdmin) {
          window.adminBootstrapData = data;
        } else {
          window.dashboardBootstrapData = data;
        }
        
        console.log(`✅ Bootstrap data loaded for ${cacheKey} in ${data.loadTime || 0}ms`);
        return data;
      }
    } catch (error) {
      console.error(`Error loading bootstrap data for ${cacheKey}:`, error);
    }
    
    return null;
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

      // Load bootstrap data in parallel with page content (if admin or dashboard)
      const bootstrapPromise = loadBootstrapData(url);

      // Fetch content (returns { content, fullHtml })
      const { content, fullHtml } = await fetchPageContent(url);
      
      // Wait for bootstrap data (but don't block if it's slow)
      await bootstrapPromise;

      // Find content container - probeer verschillende selectors
      // Voor admin: .main-container binnen .main-content
      // Voor dashboard: .main-content direct
      let container = null;
      
      // Eerst proberen .main-container (admin layout)
      container = document.querySelector('.main-container');
      
      // Als dat niet werkt, probeer .main-content
      if (!container) {
        container = document.querySelector('.main-content');
      }
      
      // Fallback naar andere selectors
      if (!container) {
        const selectors = CONFIG.contentSelector.split(',').map(s => s.trim());
        for (const selector of selectors) {
          container = document.querySelector(selector);
          if (container) break;
        }
      }

      // Laatste fallback selectors
      if (!container) {
        container = document.querySelector('body > main') || 
                    document.querySelector('body > .container') ||
                    document.querySelector('body > div[class*="main"]') ||
                    document.querySelector('.admin-content') ||
                    document.querySelector('.dashboard-content');
      }

      if (!container) {
        console.error('[Client Router] Content container not found, falling back to full reload');
        console.error('[Client Router] Available elements:', {
          hasMain: !!document.querySelector('main'),
          hasMainContent: !!document.querySelector('.main-content'),
          hasMainContainer: !!document.querySelector('.main-container'),
          bodyChildren: Array.from(document.body.children).map(el => el.tagName + (el.className ? '.' + el.className : ''))
        });
        window.location.href = url;
        return;
      }

      // Update content met snelle fade effect (50ms voor instant feel)
      container.style.opacity = '0';
      container.style.transition = 'opacity 50ms ease-out';
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      container.innerHTML = content;
      
      // Force reflow voor snellere rendering
      container.offsetHeight;
      
      // Update browser history
      if (pushState) {
        window.history.pushState({ url: url }, '', url);
      }

      // Update page title en load new stylesheets from the fetched HTML
      const fullDoc = new DOMParser().parseFromString(fullHtml, 'text/html');
      
      // Update title
      const newTitle = fullDoc.querySelector('title');
      if (newTitle) {
        document.title = newTitle.textContent;
      }

      // Normalize URL for consistent comparison (parsed doc can have different base URL)
      function resolveHref(link) {
        const raw = link.getAttribute('href') || link.href || '';
        if (!raw) return '';
        try {
          return new URL(raw, window.location.origin).href;
        } catch {
          return raw;
        }
      }

      // Load new stylesheets from head
      const newStylesheets = Array.from(fullDoc.head.querySelectorAll('link[rel="stylesheet"]'));
      const existingHrefs = new Set(
        Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
          .map(link => resolveHref(link))
      );

      // Base stylesheets die altijd in de layout zitten - nooit opnieuw toevoegen
      const basePatterns = [
        '/css/design-tokens.css',
        '/css/chart-theme.css',
        '/css/style.css',
        '/css/admin/notifications.css',
        '/css/admin/time-tracker.css',
        '/css/leads.css',
        'cdnjs.cloudflare.com',
        'fonts.googleapis.com',
        'cdn.jsdelivr.net',
        'cdn.datatables.net'
      ];

      // 1. Verwijder oude page-specific stylesheets die de nieuwe pagina niet nodig heeft
      const newPageHrefs = new Set(newStylesheets.map(link => resolveHref(link)));
      document.head.querySelectorAll('link[rel="stylesheet"][data-page-specific="true"]').forEach(link => {
        const href = resolveHref(link);
        if (!newPageHrefs.has(href)) {
          link.remove();
        }
      });

      // 2. Rebuild existingHrefs na verwijdering (anders missen we nieuwe stylesheets)
      existingHrefs.clear();
      document.head.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        existingHrefs.add(resolveHref(link));
      });

      // 3. Voeg nieuwe page-specific stylesheets toe
      const addedLinks = [];
      newStylesheets.forEach(link => {
        const href = resolveHref(link);
        const rawHref = link.getAttribute('href') || link.href || '';
        if (!href || !rawHref) return;
        if (existingHrefs.has(href)) return;

        const isBase = basePatterns.some(p => rawHref.includes(p));
        if (isBase) return;

        const newLink = document.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = rawHref.startsWith('/') || rawHref.startsWith('http') ? rawHref : (window.location.origin + (rawHref.startsWith('/') ? '' : '/') + rawHref);
        newLink.media = link.getAttribute('media') || 'all';
        newLink.setAttribute('data-page-specific', 'true');
        document.head.appendChild(newLink);
        addedLinks.push(newLink);
      });

      // 4. Wacht tot nieuwe stylesheets geladen zijn (max 2s) om FOUC te voorkomen
      if (addedLinks.length > 0) {
        await Promise.race([
          Promise.all(addedLinks.map(link => new Promise(r => { link.onload = r; link.onerror = r; }))),
          new Promise(r => setTimeout(r, 2000))
        ]);
      }

      // Re-initialize scripts in nieuwe content (async for faster rendering)
      const scripts = container.querySelectorAll('script');
      if (scripts.length > 0) {
        // Execute scripts asynchronously to not block rendering
        Promise.all(Array.from(scripts).map(oldScript => {
          return new Promise((resolve) => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => {
              newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = oldScript.textContent;
            
            // Load async scripts in parallel
            if (newScript.src) {
              newScript.onload = resolve;
              newScript.onerror = resolve; // Continue even if script fails
            } else {
              // Inline scripts execute immediately
              resolve();
            }
            
            oldScript.parentNode.replaceChild(newScript, oldScript);
          });
        })).catch(() => {
          // Continue even if some scripts fail
        });
      }

      // Trigger custom event voor andere scripts
      window.dispatchEvent(new CustomEvent('page:loaded', { 
        detail: { url: url, content: content } 
      }));

      // Fade in nieuwe content (instant - no delay)
      container.style.opacity = '1';

      // Update active menu items immediately
      updateActiveMenuItems(url);
      
      // Re-initialize submenu toggles after content update
      if (typeof window.reinitSubmenus === 'function') {
        window.reinitSubmenus();
      }

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
    // Remove all active states first
    document.querySelectorAll('.menu-item, .nav-link, .submenu-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Close all submenus first, then expand only the active one
    document.querySelectorAll('[data-submenu-toggle]').forEach(toggle => {
      toggle.classList.remove('expanded');
    });
    
    // First, check submenu items (they take priority)
    let hasActiveSubmenu = false;
    document.querySelectorAll('.submenu-item').forEach(item => {
      const href = item.getAttribute('href');
      if (href && url.startsWith(href)) {
        item.classList.add('active');
        hasActiveSubmenu = true;
        // Expand parent submenu (but don't make parent active)
        const parentMenu = item.closest('.submenu')?.previousElementSibling;
        if (parentMenu && parentMenu.classList.contains('has-submenu')) {
          parentMenu.classList.add('expanded');
        }
      }
    });
    
    // Only activate parent menu items if NO submenu item is active
    if (!hasActiveSubmenu) {
      // Update sidebar menu items
      document.querySelectorAll('.menu-item, .nav-link').forEach(item => {
        const href = item.getAttribute('href');
        if (!href) return;
        
        // Exact match for /admin and /dashboard root pages
        if ((href === '/admin' && url === '/admin') || 
            (href === '/dashboard' && url === '/dashboard')) {
          item.classList.add('active');
          return;
        }
        
        // For other routes, check if URL starts with href
        // But exclude exact matches that should be exact (like /admin matching /admin/leads)
        if (url.startsWith(href)) {
          // Special case: /admin should not match /admin/leads, etc.
          if (href === '/admin' && url !== '/admin') {
            return; // Don't activate /admin for sub-routes
          }
          item.classList.add('active');
          
          // If this is a submenu parent, expand it
          if (item.classList.contains('has-submenu')) {
            item.classList.add('expanded');
          }
        }
      });
    }
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
   * Prefetch page on link hover for instant loading
   */
  function setupPrefetch() {
    if (!CONFIG.prefetchOnHover) return;
    
    let prefetchTimeout = null;
    
    document.addEventListener('mouseenter', (e) => {
      // e.target might be a text node, so we need to check if it's an element
      const target = e.target.nodeType === Node.TEXT_NODE ? e.target.parentElement : e.target;
      if (!target || typeof target.closest !== 'function') return;
      const link = target.closest('a');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href || !shouldHandleClientSide(href)) return;
      
      // Clear any existing timeout
      if (prefetchTimeout) {
        clearTimeout(prefetchTimeout);
      }
      
      // Prefetch after short delay
      prefetchTimeout = setTimeout(() => {
        // Only prefetch if not already cached
        const cached = CONFIG.cache.get(href);
        if (!cached || (Date.now() - cached.timestamp) > CONFIG.cacheMaxAge) {
          fetchPageContent(href).catch(() => {
            // Silently fail - prefetch is optional
          });
        }
      }, CONFIG.prefetchDelay);
    }, true);
    
    document.addEventListener('mouseleave', () => {
      if (prefetchTimeout) {
        clearTimeout(prefetchTimeout);
        prefetchTimeout = null;
      }
    }, true);
  }

  /**
   * Initialize router
   */
  function init() {
    // Intercept link clicks (use capture phase to catch early)
    document.addEventListener('click', handleLinkClick, true);

    // Handle browser back/forward
    window.addEventListener('popstate', handlePopState);

    // Setup prefetching for faster navigation
    setupPrefetch();

    // Update active menu items on initial load
    updateActiveMenuItems(window.location.pathname);

    // Debug: log initialization
    if (window.GS_DEBUG || localStorage.getItem('GS_DEBUG') === 'true') {
      console.log('[Client Router] Initialized', {
        clientRoutes: CONFIG.clientRoutes,
        currentUrl: window.location.pathname,
        prefetchEnabled: CONFIG.prefetchOnHover
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

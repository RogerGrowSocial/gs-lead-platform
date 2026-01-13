// Lead Popup JavaScript functionality (safe, single-run wrapper)
(function () {
  if (window.__leadPopupInitialized) return; // guard against double inclusion
  window.__leadPopupInitialized = true;

  // Conditional logging for production optimization (scoped names to avoid collisions)
  const LEAD_POPUP_IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const lpLog = LEAD_POPUP_IS_DEV ? console.log.bind(console) : function () {};
  const lpLogError = console.error.bind(console); // Always log errors
  const lpLogWarn = LEAD_POPUP_IS_DEV ? console.warn.bind(console) : function () {};

  // Initialize lead popup functionality when DOM is loaded
  document.addEventListener('DOMContentLoaded', function () {
    initializePopupEnhancements();
  });

  function initializePopupEnhancements() {
    // Add keyboard navigation support
    document.addEventListener('keydown', function (e) {
      const popup = document.getElementById('leadDetailsPopup');
      if (popup && popup.classList.contains('active')) {
        // Close popup with Escape key
        if (e.key === 'Escape') {
          if (typeof hideLeadDetailsPopup === 'function') {
            hideLeadDetailsPopup();
          }
        }
      }
    });

    // Add focus management for accessibility
    const popup = document.getElementById('leadDetailsPopup');
    if (popup) {
      popup.addEventListener('shown', function () {
        // Focus on the first interactive element when popup opens
        const firstInput = popup.querySelector('input, select, button');
        if (firstInput) {
          firstInput.focus();
        }
      });
    }
  }

  // Export functions for use in other scripts
  window.leadPopupUtils = window.leadPopupUtils || {
    initializePopupEnhancements,
    log: lpLog,
    logError: lpLogError,
    logWarn: lpLogWarn,
  };
})();

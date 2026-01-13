// Legacy bootstrap notification helper (deprecated)
// Do NOT override the unified system if it exists
(function () {
  if (typeof window.showNotification === 'function') {
    // Provide a no-op shim to avoid re-defining a conflicting function name
    window.legacyBootstrapNotification = function (message, type) {
      window.showNotification(message, type)
    }
    return
  }

  // Minimal fallback only if unified system is absent
  window.showNotification = (message, type = 'info') => {
    try {
      // Create container if it doesn't exist
      let container = document.querySelector('.notification-container')
      if (!container) {
        container = document.createElement('div')
        container.className = 'notification-container'
        container.style.position = 'fixed'
        container.style.top = '20px'
        container.style.right = '20px'
        container.style.zIndex = '9999'
        document.body.appendChild(container)
      }
      const notification = document.createElement('div')
      notification.className = `notification ${type}`
      notification.textContent = message
      container.appendChild(notification)
      setTimeout(() => notification.remove(), 5000)
    } catch (e) {
      console.log(message)
    }
  }
})()
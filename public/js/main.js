// Voeg een globale functie toe voor notificaties
window.showNotification = (message, type = "info", duration = 5000, playSound = true) => {
  
  // Gebruik bestaande container of maak nieuwe aan
  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
    // Positioneer de container direct na aanmaken
    positionNotificationContainer();
  }

  // Maak de notificatie
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // Voeg de inhoud toe
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close">&times;</button>
    <div class="notification-progress">
      <div class="notification-progress-bar"></div>
    </div>
  `;

  // Voeg de notificatie toe aan de container
  container.appendChild(notification);
  
  // Zorg dat de container correct gepositioneerd is
  positionNotificationContainer();

  // Start de progress bar animatie
  const progressBar = notification.querySelector('.notification-progress-bar');
  if (progressBar) {
    progressBar.style.width = '100%';
    progressBar.style.transition = `width ${duration}ms linear`;
    setTimeout(() => {
      progressBar.style.width = '0%';
    }, 100);
  }

  // Voeg event listener toe voor de close button
  const closeButton = notification.querySelector('.notification-close');
  closeButton.addEventListener('click', () => {
    notification.classList.add('hiding');
    setTimeout(() => {
      notification.remove();
      // Behoud de container - verwijder deze niet, alleen de notificatie
      // Dit zorgt ervoor dat de container behouden blijft zoals in de layout
    }, 300);
  });

  // Speel geluid af als dit is ingeschakeld
  if (playSound && !isNotificationSoundMuted()) {
    playNotificationSound(type)
  }

  // Voeg hover effect toe
  notification.addEventListener("mouseenter", () => {
    // Pauzeer de progress bar animatie
    const progressBar = notification.querySelector(".notification-progress")
    if (progressBar && progressBar.style.animationPlayState) {
      progressBar.style.animationPlayState = "paused"
    }
  })

  notification.addEventListener("mouseleave", () => {
    // Hervat de progress bar animatie
    const progressBar = notification.querySelector(".notification-progress")
    if (progressBar && progressBar.style.animationPlayState) {
      progressBar.style.animationPlayState = "running"
    }
  })

  // Voeg progress bar animatie toe
  if (duration > 0) {
    const progressBar = notification.querySelector(".notification-progress")
    if (progressBar) {
      progressBar.style.animation = `progressShrink ${duration}ms linear forwards`

      // Sluit de notificatie automatisch na de opgegeven tijd
      setTimeout(() => {
        closeNotification(notification)
      }, duration)
    }
  }

  // Voeg een subtiel pop effect toe
  setTimeout(() => {
    notification.style.transform = "scale(1.03)"
    setTimeout(() => {
      notification.style.transform = "scale(1)"
      notification.style.transition = "transform 0.2s ease"
    }, 50)
  }, 10)

  // Beperk het aantal notificaties tot 3
  const notifications = container.querySelectorAll(".notification")
  if (notifications.length > 3) {
    // Verwijder de oudste notificatie (eerste kind)
    closeNotification(notifications[0])
  }

  return notification
}

// Functie om een notificatie te sluiten
function closeNotification(notification) {
  // Voeg de 'closing' class toe voor de animatie
  notification.classList.add("closing")

  // Verwijder de notificatie na de animatie
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification)
    }
  }, 300) // 300ms is de duur van de slide-out animatie
}

// Functie om te controleren of notificatiegeluiden zijn gedempt
function isNotificationSoundMuted() {
  return localStorage.getItem("notificationSoundMuted") === "true"
}

// Functie om notificatiegeluiden te dempen/ontdempen
window.toggleNotificationSound = (muted) => {
  localStorage.setItem("notificationSoundMuted", muted.toString())

  // Toon een bevestigingsnotificatie (zonder geluid)
  const message = muted ? "Notificatiegeluiden zijn uitgeschakeld" : "Notificatiegeluiden zijn ingeschakeld"
  window.showNotification(message, "info", 3000, false)

  return muted
}

// Functie om notificatiegeluid af te spelen
function playNotificationSound(type) {
  // Als geluiden zijn gedempt, speel dan geen geluid af
  if (isNotificationSoundMuted()) {
    console.log("Notificatiegeluiden zijn gedempt, geluid wordt niet afgespeeld")
    return
  }

  // Bepaal welk geluidsbestand moet worden afgespeeld op basis van het type
  let soundFile = ""
  switch (type) {
    case "success":
      soundFile = "/sounds/notification-success.mp3"
      break
    case "error":
      soundFile = "/sounds/notification-error.mp3"
      break
    case "warning":
      soundFile = "/sounds/notification-warning.mp3"
      break
    case "info":
    default:
      soundFile = "/sounds/notification-info.mp3"
      break
  }

  // Maak een nieuw Audio object en speel het geluid af
  const audio = new Audio(soundFile)
  audio.volume = 0.5 // Stel het volume in op 50%

  // Probeer het geluid af te spelen, maar vang eventuele fouten af
  audio.play().catch((error) => {
    console.log("Kon notificatiegeluid niet afspelen:", error)
  })
}

document.addEventListener("DOMContentLoaded", () => {
  // User dropdown - Updated to work with admin layout
  const userDropdownToggle = document.querySelector(".user-dropdown-toggle")
  const userDropdownMenu = document.querySelector(".user-dropdown-menu")

  if (userDropdownToggle && userDropdownMenu) {
    // Initialize user info from data attributes
    const userAvatar = userDropdownToggle.querySelector(".user-avatar")
    const userName = userDropdownToggle.querySelector(".user-name")
    const userRole = userDropdownToggle.querySelector(".user-role")
    const dropdownIcon = userDropdownToggle.querySelector(".fa-chevron-down")

    // Set initial state
    userDropdownMenu.style.opacity = '0'
    userDropdownMenu.style.visibility = 'hidden'
    userDropdownMenu.style.transform = 'translateY(-10px)'
    userDropdownMenu.classList.remove("show")

    userDropdownToggle.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      // Toggle dropdown visibility using opacity and visibility
      const isVisible = userDropdownMenu.classList.contains("show")
      if (isVisible) {
        userDropdownMenu.style.opacity = '0'
        userDropdownMenu.style.visibility = 'hidden'
        userDropdownMenu.style.transform = 'translateY(-10px)'
        userDropdownMenu.classList.remove("show")
      } else {
        userDropdownMenu.style.opacity = '1'
        userDropdownMenu.style.visibility = 'visible'
        userDropdownMenu.style.transform = 'translateY(0)'
        userDropdownMenu.classList.add("show")
      }
      
      // Rotate dropdown icon
      if (dropdownIcon) {
        dropdownIcon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)'
        dropdownIcon.style.transition = 'transform 0.2s ease'
      }
    })

    // Close dropdown when clicking outside
    document.addEventListener("click", (event) => {
      if (!userDropdownToggle.contains(event.target) && !userDropdownMenu.contains(event.target)) {
        userDropdownMenu.style.opacity = '0'
        userDropdownMenu.style.visibility = 'hidden'
        userDropdownMenu.style.transform = 'translateY(-10px)'
        userDropdownMenu.classList.remove("show")
        if (dropdownIcon) {
          dropdownIcon.style.transform = 'rotate(0deg)'
        }
      }
    })

    // Close dropdown when pressing Escape
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && userDropdownMenu.classList.contains("show")) {
        userDropdownMenu.style.opacity = '0'
        userDropdownMenu.style.visibility = 'hidden'
        userDropdownMenu.style.transform = 'translateY(-10px)'
        userDropdownMenu.classList.remove("show")
        if (dropdownIcon) {
          dropdownIcon.style.transform = 'rotate(0deg)'
        }
      }
    })
  }

  // Alert dismissal
  const alertCloseButtons = document.querySelectorAll(".alert .close")

  alertCloseButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const alert = this.closest(".alert")
      if (alert) {
        alert.style.display = "none"
      }
    })
  })

  // Form validation
  const forms = document.querySelectorAll(".needs-validation")

  forms.forEach((form) => {
    form.addEventListener(
      "submit",
      (event) => {
        if (!form.checkValidity()) {
          event.preventDefault()
          event.stopPropagation()
        }

        form.classList.add("was-validated")
      },
      false,
    )
  })

  // Tooltips
  const tooltips = document.querySelectorAll('[data-toggle="tooltip"]')

  tooltips.forEach((tooltip) => {
    tooltip.addEventListener("mouseenter", function () {
      const tooltipText = this.getAttribute("data-title")

      if (tooltipText) {
        const tooltipEl = document.createElement("div")
        tooltipEl.className = "tooltip"
        tooltipEl.textContent = tooltipText

        document.body.appendChild(tooltipEl)

        const rect = this.getBoundingClientRect()
        const tooltipRect = tooltipEl.getBoundingClientRect()

        tooltipEl.style.top = rect.top - tooltipRect.height - 10 + "px"
        tooltipEl.style.left = rect.left + rect.width / 2 - tooltipRect.width / 2 + "px"
        tooltipEl.style.opacity = "1"

        this.addEventListener(
          "mouseleave",
          () => {
            document.body.removeChild(tooltipEl)
          },
          { once: true },
        )
      }
    })
  })

  // Verbeterde tabs implementatie
  const tabLinks = document.querySelectorAll('[data-toggle="tab"]')

  tabLinks.forEach((link) => {
    link.addEventListener("click", function (event) {
      event.preventDefault()

      const targetId = this.getAttribute("href")
      const targetTab = document.querySelector(targetId)

      if (targetTab) {
        // Preload de tab content voordat we deze tonen
        targetTab.style.opacity = "0"
        targetTab.classList.add("active")

        // Deactiveer alle tab links
        tabLinks.forEach((tabLink) => {
          tabLink.classList.remove("active")
        })

        // Activeer de aangeklikte tab link
        this.classList.add("active")

        // Wacht een kort moment om de browser te laten renderen
        setTimeout(() => {
          // Verberg alle andere tabs
          const tabContents = document.querySelectorAll(".tab-pane")
          tabContents.forEach((tab) => {
            if (tab !== targetTab) {
              tab.classList.remove("active")
            }
          })

          // Toon de nieuwe tab met een fade-in effect
          targetTab.style.opacity = "1"
          targetTab.style.transition = "opacity 150ms ease-in-out"
        }, 50)
      }
    })
  })

  // Initialiseer eerste tab indien aanwezig
  const firstTabLink = document.querySelector('[data-toggle="tab"]')
  if (firstTabLink) {
    firstTabLink.click()
  }

  // Controleer of we op de admin pagina zijn en of we de welkomstnotificatie moeten tonen
  if (window.location.pathname.includes("/admin")) {
    // Controleer of we de welkomstnotificatie al hebben getoond in deze sessie
    const skipWelcome = sessionStorage.getItem("skipWelcomeNotification")

    // Toon de welkomstnotificatie alleen als we deze nog niet hebben getoond
    if (!skipWelcome) {
      console.log("Admin pagina gedetecteerd, toon welkomstnotificatie...")
      setTimeout(() => {
        if (typeof window.showNotification === "function") {
          window.showNotification("Welkom bij het GrowSocial Admin Dashboard", "info", 3000)

          // Sla op dat we de welkomstnotificatie hebben getoond
          sessionStorage.setItem("skipWelcomeNotification", "true")
        }
      }, 1000)
    } else {
      
    }
  }
})

// Voorkom dat notificaties opnieuw worden getoond bij navigatie tussen pagina's
// Dit zorgt ervoor dat de browser geen oude pagina's uit de cache laadt
window.addEventListener("pageshow", (event) => {
  // Als de pagina uit de cache wordt geladen (bij navigatie terug/vooruit)
  if (event.persisted) {
    // Verwijder eventuele bestaande notificaties
    const container = document.querySelector(".notification-container")
    if (container) {
      container.innerHTML = ""
    }
  }
})

// Voorkom dat de browser pagina's uit de cache laadt bij navigatie
window.addEventListener("unload", () => {
  // Dit is een lege functie, maar het zorgt ervoor dat de browser
  // de pagina niet uit de cache laadt bij navigatie terug/vooruit
})

// Functie om de notificatie container correct te positioneren
function positionNotificationContainer() {
  const container = document.querySelector('.notification-container');
  if (!container) return;
  
  // Zet inline styles - deze hebben voorrang boven CSS
  // Detecteer header
  const header = document.querySelector('header') || document.querySelector('.header');
  if (header) {
    const headerHeight = header.offsetHeight;
    container.style.top = `${headerHeight + 10}px`; // 10px extra ruimte
  } else {
    container.style.top = '20px';
  }
  
  // Detecteer sidebar aan de rechterkant
  const rightSidebar = document.querySelector('.sidebar.right-sidebar') || 
                       document.querySelector('.right-sidebar');
  if (rightSidebar && window.innerWidth > 768) { // Alleen op desktop
    const sidebarRect = rightSidebar.getBoundingClientRect();
    const rightOffset = window.innerWidth - sidebarRect.left;
    container.style.right = `${rightOffset + 10}px`; // 10px extra ruimte
  } else {
    container.style.right = '20px';
  }
  
  // Zorg dat position fixed is ingesteld en altijd boven alles ligt
  container.style.position = 'fixed';
  container.style.zIndex = '100000';
}

// Voer uit bij laden en bij resize
document.addEventListener('DOMContentLoaded', positionNotificationContainer);
window.addEventListener('resize', positionNotificationContainer);

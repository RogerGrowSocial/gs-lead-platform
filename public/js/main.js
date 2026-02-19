// Voeg een globale functie toe voor notificaties
window.showNotification = (message, type = "info", duration = 5000, playSound = true) => {
  
  // Gebruik bestaande container of maak nieuwe aan
  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
    positionNotificationContainer();
  }

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close">&times;</button>
    <div class="notification-progress">
      <div class="notification-progress-bar"></div>
    </div>
  `;

  container.appendChild(notification);
  positionNotificationContainer();

  const progressBar = notification.querySelector('.notification-progress-bar');
  if (progressBar) {
    progressBar.style.width = '100%';
    progressBar.style.transition = `width ${duration}ms linear`;
    setTimeout(() => { progressBar.style.width = '0%'; }, 100);
  }

  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.classList.add('hiding');
    setTimeout(() => notification.remove(), 300);
  });

  if (playSound && !isNotificationSoundMuted()) {
    playNotificationSound(type);
  }

  notification.addEventListener("mouseenter", () => {
    const pb = notification.querySelector(".notification-progress");
    if (pb && pb.style.animationPlayState) pb.style.animationPlayState = "paused";
  });
  notification.addEventListener("mouseleave", () => {
    const pb = notification.querySelector(".notification-progress");
    if (pb && pb.style.animationPlayState) pb.style.animationPlayState = "running";
  });

  if (duration > 0) {
    const pb = notification.querySelector(".notification-progress");
    if (pb) {
      pb.style.animation = `progressShrink ${duration}ms linear forwards`;
      setTimeout(() => closeNotification(notification), duration);
    }
  }

  setTimeout(() => {
    notification.style.transform = "scale(1.03)";
    setTimeout(() => {
      notification.style.transform = "scale(1)";
      notification.style.transition = "transform 0.2s ease";
    }, 50);
  }, 10);

  const notifications = container.querySelectorAll(".notification");
  if (notifications.length > 3) closeNotification(notifications[0]);

  return notification;
};

function closeNotification(notification) {
  notification.classList.add("closing");
  setTimeout(() => {
    if (notification.parentNode) notification.parentNode.removeChild(notification);
  }, 300);
}

function isNotificationSoundMuted() {
  return localStorage.getItem("notificationSoundMuted") === "true";
}

window.toggleNotificationSound = (muted) => {
  localStorage.setItem("notificationSoundMuted", muted.toString());
  window.showNotification(
    muted ? "Notificatiegeluiden zijn uitgeschakeld" : "Notificatiegeluiden zijn ingeschakeld",
    "info", 3000, false
  );
  return muted;
};

function playNotificationSound(type) {
  if (isNotificationSoundMuted()) return;
  const files = { success: "notification-success", error: "notification-error", warning: "notification-warning", info: "notification-info" };
  const name = files[type] || files.info;
  const audio = new Audio("/sounds/" + name + ".mp3");
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

function positionNotificationContainer() {
  const container = document.querySelector('.notification-container');
  if (!container) return;
  const header = document.querySelector('header') || document.querySelector('.header');
  container.style.top = header ? `${header.offsetHeight + 10}px` : '20px';
  const rightSidebar = document.querySelector('.sidebar.right-sidebar') || document.querySelector('.right-sidebar');
  container.style.right = (rightSidebar && window.innerWidth > 768) ? `${window.innerWidth - rightSidebar.getBoundingClientRect().left + 10}px` : '20px';
  container.style.position = 'fixed';
  container.style.zIndex = '100000';
}

// Idempotent UI init: dropdown, alerts, forms, tooltips, tabs. Safe to call on DOMContentLoaded, app:pagechange, pageshow.
window.initUI = function(opts) {
  opts = opts || {};
  const isInitial = opts.initial !== false;

  // User dropdown — bind once per element
  const userDropdownToggle = document.querySelector(".user-dropdown-toggle");
  const userDropdownMenu = document.querySelector(".user-dropdown-menu");
  if (userDropdownToggle && userDropdownMenu && !userDropdownToggle.dataset.gsBound) {
    userDropdownToggle.dataset.gsBound = "1";
    userDropdownMenu.style.opacity = '0';
    userDropdownMenu.style.visibility = 'hidden';
    userDropdownMenu.style.transform = 'translateY(-10px)';
    const dropdownIcon = userDropdownToggle.querySelector(".fa-chevron-down");
    userDropdownToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = userDropdownMenu.classList.contains("show");
      userDropdownMenu.style.opacity = isVisible ? '0' : '1';
      userDropdownMenu.style.visibility = isVisible ? 'hidden' : 'visible';
      userDropdownMenu.style.transform = isVisible ? 'translateY(-10px)' : 'translateY(0)';
      userDropdownMenu.classList.toggle("show", !isVisible);
      if (dropdownIcon) dropdownIcon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
    });
    document.addEventListener("click", (event) => {
      if (!userDropdownToggle.contains(event.target) && !userDropdownMenu.contains(event.target)) {
        userDropdownMenu.style.opacity = '0';
        userDropdownMenu.style.visibility = 'hidden';
        userDropdownMenu.style.transform = 'translateY(-10px)';
        userDropdownMenu.classList.remove("show");
        if (dropdownIcon) dropdownIcon.style.transform = 'rotate(0deg)';
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && userDropdownMenu.classList.contains("show")) {
        userDropdownMenu.style.opacity = '0';
        userDropdownMenu.style.visibility = 'hidden';
        userDropdownMenu.style.transform = 'translateY(-10px)';
        userDropdownMenu.classList.remove("show");
        if (dropdownIcon) dropdownIcon.style.transform = 'rotate(0deg)';
      }
    });
  }

  // Alert close — bind once per button
  document.querySelectorAll(".alert .close").forEach((button) => {
    if (button.dataset.gsBound) return;
    button.dataset.gsBound = "1";
    button.addEventListener("click", function () {
      const alert = this.closest(".alert");
      if (alert) alert.style.display = "none";
    });
  });

  // Form validation
  document.querySelectorAll(".needs-validation").forEach((form) => {
    if (form.dataset.gsBound) return;
    form.dataset.gsBound = "1";
    form.addEventListener("submit", (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add("was-validated");
    }, false);
  });

  // Tooltips
  document.querySelectorAll('[data-toggle="tooltip"]').forEach((tooltip) => {
    if (tooltip.dataset.gsBound) return;
    tooltip.dataset.gsBound = "1";
    tooltip.addEventListener("mouseenter", function () {
      const tooltipText = this.getAttribute("data-title");
      if (tooltipText) {
        const tooltipEl = document.createElement("div");
        tooltipEl.className = "tooltip";
        tooltipEl.textContent = tooltipText;
        document.body.appendChild(tooltipEl);
        const rect = this.getBoundingClientRect();
        const tr = tooltipEl.getBoundingClientRect();
        tooltipEl.style.top = rect.top - tr.height - 10 + "px";
        tooltipEl.style.left = rect.left + rect.width / 2 - tr.width / 2 + "px";
        tooltipEl.style.opacity = "1";
        this.addEventListener("mouseleave", () => tooltipEl.remove(), { once: true });
      }
    });
  });

  // Tabs
  const tabLinks = document.querySelectorAll('[data-toggle="tab"]');
  tabLinks.forEach((link) => {
    if (link.dataset.gsBound) return;
    link.dataset.gsBound = "1";
    link.addEventListener("click", function (event) {
      event.preventDefault();
      const targetId = this.getAttribute("href");
      const targetTab = document.querySelector(targetId);
      if (targetTab) {
        targetTab.style.opacity = "0";
        targetTab.classList.add("active");
        tabLinks.forEach((l) => l.classList.remove("active"));
        this.classList.add("active");
        setTimeout(() => {
          document.querySelectorAll(".tab-pane").forEach((tab) => {
            if (tab !== targetTab) tab.classList.remove("active");
          });
          targetTab.style.opacity = "1";
          targetTab.style.transition = "opacity 150ms ease-in-out";
        }, 50);
      }
    });
  });

  // Activate first tab only once per "page" (initial load or after pagechange)
  const firstTabLink = document.querySelector('[data-toggle="tab"]');
  if (firstTabLink && isInitial && !firstTabLink.classList.contains("active")) {
    firstTabLink.click();
  }

  // Welcome notification (admin, once per session)
  if (isInitial && window.location.pathname.includes("/admin") && !sessionStorage.getItem("skipWelcomeNotification")) {
    setTimeout(() => {
      if (typeof window.showNotification === "function") {
        window.showNotification("Welkom bij het GrowSocial Admin Dashboard", "info", 3000);
        sessionStorage.setItem("skipWelcomeNotification", "true");
      }
    }, 1000);
  }
};

// Initial load
document.addEventListener("DOMContentLoaded", () => {
  initUI({ initial: true });
  positionNotificationContainer();
});
window.addEventListener("resize", positionNotificationContainer);

// Re-run UI init after client-side page change (if client-router re-enabled later)
window.addEventListener("app:pagechange", () => initUI({ initial: true }));

// bfcache: re-init and clear stale notifications
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    const container = document.querySelector(".notification-container");
    if (container) container.innerHTML = "";
    initUI({ initial: true });
  }
});

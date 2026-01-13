// Admin Contacts - Right drawer modal for creating a new contact
// Loaded on /admin/contacts via views/admin/contacts.ejs
(function () {
  'use strict';

  // Prevent double-init if script is included twice
  if (window.__gsContactsDrawerInit) return;
  window.__gsContactsDrawerInit = true;

  const DRAWER_ID = 'contactDrawer';
  const OVERLAY_ID = 'contactDrawerOverlay';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function setOpen(isOpen) {
    const drawer = qs(`#${DRAWER_ID}`);
    const overlay = qs(`#${OVERLAY_ID}`);
    if (!drawer || !overlay) return;

    drawer.classList.toggle('is-open', isOpen);
    overlay.classList.toggle('is-open', isOpen);
    document.documentElement.classList.toggle('drawer-open', isOpen);
    document.body.classList.toggle('drawer-open', isOpen);

    // Inline-style fallback
    drawer.style.transform = isOpen ? 'translateX(0)' : 'translateX(110%)';
    overlay.style.opacity = isOpen ? '1' : '0';
    overlay.style.pointerEvents = isOpen ? 'auto' : 'none';

    drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  function resetForm() {
    const form = qs('#contactCreateForm');
    if (!form) return;
    form.reset();
    const submit = qs('#contactCreateSubmit');
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Aanmaken';
    }
    const err = qs('#contactCreateError');
    if (err) {
      err.textContent = '';
      err.style.display = 'none';
    }
    // Reset new company input
    const newCompanyInputContainer = qs('#newCompanyInputContainer');
    const addNewCompanyBtn = qs('#addNewCompanyBtn');
    if (newCompanyInputContainer) {
      newCompanyInputContainer.style.display = 'none';
    }
    if (addNewCompanyBtn) {
      addNewCompanyBtn.style.display = 'flex';
    }
  }

  function openDrawer() {
    const drawer = qs(`#${DRAWER_ID}`);
    if (!drawer) return;
    resetForm();
    setOpen(true);
    // Focus first input
    const first = qs('#contact_first_name', drawer);
    if (first) setTimeout(() => first.focus(), 50);
  }

  function closeDrawer() {
    setOpen(false);
  }

  function onDocumentClick(e) {
    const openBtn = e.target.closest('#createContactBtn, [data-action="add-contact"]');
    if (openBtn) {
      e.preventDefault();
      e.stopPropagation();
      openDrawer();
      return;
    }

    const closeBtn = e.target.closest('[data-drawer-close]');
    if (closeBtn) {
      e.preventDefault();
      closeDrawer();
      return;
    }

    // Click on overlay closes
    const overlay = e.target.closest(`#${OVERLAY_ID}`);
    if (overlay) {
      closeDrawer();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      const drawer = qs(`#${DRAWER_ID}`);
      if (drawer && drawer.classList.contains('is-open')) {
        e.preventDefault();
        closeDrawer();
      }
    }
  }

  function init() {
    const drawer = qs(`#${DRAWER_ID}`);
    const overlay = qs(`#${OVERLAY_ID}`);
    if (!drawer || !overlay) return;

    console.log('[contactsDrawer] init');

    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    // Close on route changes
    window.addEventListener('beforeunload', () => setOpen(false));

    // Ensure initial closed state
    setOpen(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

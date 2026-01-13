// Admin Employees - Right drawer modal for creating a new employee
// Loaded on /admin/employees via routes/admin.js -> scripts
(function () {
  'use strict';

  // Prevent double-init if script is included twice (layout + inline fallback, etc.)
  if (window.__gsEmployeesDrawerInit) return;
  window.__gsEmployeesDrawerInit = true;

  const DRAWER_ID = 'employeeDrawer';
  const OVERLAY_ID = 'employeeDrawerOverlay';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function setOpen(isOpen) {
    const drawer = qs(`#${DRAWER_ID}`);
    const overlay = qs(`#${OVERLAY_ID}`);
    if (!drawer || !overlay) return;

    drawer.classList.toggle('is-open', isOpen);
    overlay.classList.toggle('is-open', isOpen);
    document.documentElement.classList.toggle('drawer-open', isOpen);
    document.body.classList.toggle('drawer-open', isOpen);

    // Inline-style fallback (so it still works even if CSS fails to load)
    drawer.style.transform = isOpen ? 'translateX(0)' : 'translateX(110%)';
    overlay.style.opacity = isOpen ? '1' : '0';
    overlay.style.pointerEvents = isOpen ? 'auto' : 'none';

    drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  function resetForm() {
    const form = qs('#employeeCreateForm');
    if (!form) return;
    form.reset();
    const submit = qs('#employeeCreateSubmit');
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Aanmaken';
    }
    const err = qs('#employeeCreateError');
    if (err) {
      err.textContent = '';
      err.style.display = 'none';
    }
  }

  function formatDate(iso) {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return '-';
    }
  }

  function addEmployeeToList(employee) {
    console.log('addEmployeeToList called with:', employee);
    const employeesList = qs('#employeesList');
    if (!employeesList) {
      console.error('❌ employeesList element not found!');
      return;
    }

    console.log('✅ Found employeesList element');

    // Remove empty state if it exists
    const emptyState = employeesList.querySelector('.empty-state');
    if (emptyState) {
      console.log('✅ Removing empty state');
      emptyState.remove();
    }

    const status = employee.status || 'active';
    const isAdmin = employee.is_admin ? true : false;
    const employeeId = employee.id ? employee.id.toString() : '';
    const firstName = employee.first_name || '';
    const lastName = employee.last_name || '';
    const initials = (firstName ? firstName.charAt(0) : '') + (lastName ? lastName.charAt(0) : '') || '?';
    const fullName = (firstName + ' ' + lastName).trim() || employee.email || 'Onbekend';
    const roleDisplayName = employee.role_display_name || 'Werknemer';

    // Create the employee item HTML
    const employeeItem = document.createElement('a');
    employeeItem.href = `/admin/employees/${employeeId}`;
    employeeItem.className = 'user-item';
    employeeItem.setAttribute('data-employee-id', employeeId);
    
    employeeItem.innerHTML = `
      <div class="user-content-wrapper">
        <div class="user-card-avatar">${initials.toUpperCase()}</div>
        <div class="user-content-section">
          <div class="user-info-wrapper">
            <div class="user-email">${employee.email || '-'}</div>
            <div class="user-last-login">Sinds ${formatDate(employee.created_at)}</div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span data-slot="badge" class="inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none ${isAdmin ? 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90' : 'border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'} text-xs">
              ${isAdmin ? `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path></svg>Admin
              ` : `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${roleDisplayName}
              `}
            </span>
            <span class="text-xs ${status === 'active' ? 'text-gray-600' : 'text-gray-500'}">${status === 'active' ? 'Actief' : 'Inactief'}</span>
          </div>
        </div>
        <div class="flex-shrink-0 flex items-start gap-3">
          <button class="employee-actions-btn" data-employee-action-id="${employeeId}" title="Meer acties">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Add to the top of the list
    try {
      if (employeesList.firstChild) {
        employeesList.insertBefore(employeeItem, employeesList.firstChild);
        console.log('✅ Employee item inserted before first child');
      } else {
        employeesList.appendChild(employeeItem);
        console.log('✅ Employee item appended (no children)');
      }
      
      console.log('✅ Employee item added to list successfully');
      console.log('   List now has', employeesList.children.length, 'children');
    } catch (insertError) {
      console.error('❌ Error inserting employee item:', insertError);
      throw insertError;
    }

    // Add a subtle highlight animation
    employeeItem.style.opacity = '0';
    employeeItem.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      employeeItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      employeeItem.style.opacity = '1';
      employeeItem.style.transform = 'translateY(0)';
    }, 10);
  }

  async function submitEmployee(payload) {
    const submit = qs('#employeeCreateSubmit');
    const err = qs('#employeeCreateError');
    if (err) {
      err.textContent = '';
      err.style.display = 'none';
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Bezig...';
    }

    try {
      const res = await fetch('/admin/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      console.log('📥 Response data:', data);
      
      if (!res.ok || !data?.success) {
        const message = data?.message || 'Kon werknemer niet aanmaken.';
        if (err) {
          err.textContent = message;
          err.style.display = '';
        }
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Aanmaken';
        }
        // Show error notification
        if (typeof window.showNotification === 'function') {
          window.showNotification(message, 'error', 5000);
        }
        return;
      }

      // Show success notification using platform notification system
      let notificationMessage = data.message || 'Werknemer succesvol aangemaakt.';
      let notificationType = 'success';
      
      // Check if email was sent
      if (data.email_sent === false || data.email_error) {
        notificationType = 'warning';
        if (data.email_error) {
          notificationMessage += ` ⚠️ Email probleem: ${data.email_error}`;
        } else {
          notificationMessage += ' ⚠️ Welkomstemail kon niet worden verstuurd.';
        }
        console.warn('Email sending issue:', data.email_error || 'Unknown error');
      }
      
      if (typeof window.showNotification === 'function') {
        window.showNotification(notificationMessage, notificationType, 6000);
      }

      // Close drawer and reset form
      setOpen(false);
      resetForm();

      // Add employee to list if user data is available
      // Use a small delay to ensure DOM is ready after drawer closes
      setTimeout(() => {
        if (data.user) {
          console.log('✅ User data received, adding to list:', data.user);
          try {
            addEmployeeToList(data.user);
          } catch (addError) {
            console.error('❌ Error adding employee to list:', addError);
            console.error('   Error details:', addError.stack);
            // Fallback: reload the page if adding fails
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        } else {
          console.warn('⚠️ No user data in response:', data);
          // If no user data, reload to show the new employee
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }, 100);
    } catch (e) {
      const errorMessage = e?.message || 'Netwerkfout.';
      if (err) {
        err.textContent = errorMessage;
        err.style.display = '';
      }
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Aanmaken';
      }
      // Show error notification
      if (typeof window.showNotification === 'function') {
        window.showNotification(errorMessage, 'error', 5000);
      }
    }
  }

  function openDrawer() {
    const drawer = qs(`#${DRAWER_ID}`);
    if (!drawer) return;
    resetForm();
    setOpen(true);
    // focus first input
    const first = qs('#employee_first_name', drawer);
    if (first) setTimeout(() => first.focus(), 50);
  }

  function closeDrawer() {
    setOpen(false);
  }

  function onDocumentClick(e) {
    const openBtn = e.target.closest('#addEmployeeBtn, #addEmployeeBtnEmpty, [data-action="add-employee"]');
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

    // click on overlay closes
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

  function onSubmitClick(e) {
    const btn = e.target.closest('#employeeCreateSubmit');
    if (!btn) return;
    e.preventDefault();

    const form = qs('#employeeCreateForm');
    if (!form) return;
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

    const fd = new FormData(form);
    const roleId = String(fd.get('role_id') || '').trim();
    const payload = {
      first_name: String(fd.get('first_name') || '').trim(),
      last_name: String(fd.get('last_name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      role_id: roleId || null,
      send_welcome_email: fd.get('send_welcome_email') === 'on',
      send_password_reset: true,
    };

    submitEmployee(payload);
  }

  function init() {
    // Ensure drawer exists (if template missing, fail silently)
    const drawer = qs(`#${DRAWER_ID}`);
    const overlay = qs(`#${OVERLAY_ID}`);
    if (!drawer || !overlay) return;

    // Helpful debug marker (can be removed later)
    // eslint-disable-next-line no-console
    console.log('[employeesDrawer] init');

    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('click', onSubmitClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    // Close on route changes (rare) / safety
    window.addEventListener('beforeunload', () => setOpen(false));

    // Ensure initial closed state (in case CSS didn't load yet)
    setOpen(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();



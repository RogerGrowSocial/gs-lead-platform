let signaturePhotoFile = null;
let defaultSignaturePhotoMarkup = '';
let currentMailboxId = null;
let mailboxActionsMenu = null;

document.addEventListener('DOMContentLoaded', () => {
  const previewEl = document.getElementById('signaturePhotoPreview');
  if (previewEl) {
    defaultSignaturePhotoMarkup = previewEl.innerHTML;
  }

  const photoInput = document.getElementById('signaturePhotoInput');
  if (photoInput) {
    photoInput.addEventListener('change', handleSignaturePhotoChange);
  }

  // SMTP Preset handlers
  const presetMailgun = document.getElementById('presetMailgun');
  const presetMijndomein = document.getElementById('presetMijndomein');
  const presetGmail = document.getElementById('presetGmail');

  if (presetMailgun) {
    presetMailgun.addEventListener('click', () => {
      // SMTP settings (Mailgun)
      document.getElementById('mailboxSmtpHost').value = 'smtp.eu.mailgun.org'; // EU region (GDPR compliant)
      document.getElementById('mailboxSmtpPort').value = '587';
      const secureCheckbox = document.getElementById('mailboxSmtpSecure');
      if (secureCheckbox) secureCheckbox.checked = false; // STARTTLS voor 587
      document.getElementById('mailboxSmtpUsername').placeholder = 'brad@growsocialmedia.nl';
      document.getElementById('mailboxSmtpPassword').placeholder = 'Mailgun SMTP wachtwoord';
      
      // IMAP settings (keep Mijndomein - Mailgun is only for SMTP)
      // Don't change IMAP settings, user should use their current IMAP server
      
      // Show Mailgun-specific hints
      const usernameHint = document.getElementById('mailgunUsernameHint');
      const passwordHint = document.getElementById('mailgunPasswordHint');
      const defaultPasswordHint = document.getElementById('defaultPasswordHint');
      if (usernameHint) usernameHint.style.display = 'block';
      if (passwordHint) passwordHint.style.display = 'block';
      if (defaultPasswordHint) defaultPasswordHint.style.display = 'none';
      
      if (window.showNotification) {
        window.showNotification('Mailgun SMTP configuratie ingevuld. Let op: IMAP blijft bij Mijndomein voor het ontvangen van emails.', 'info', 6000);
      }
    });
  }

  if (presetMijndomein) {
    presetMijndomein.addEventListener('click', () => {
      document.getElementById('mailboxSmtpHost').value = 'mail.mijndomein.nl';
      document.getElementById('mailboxSmtpPort').value = '465';
      const secureCheckbox = document.getElementById('mailboxSmtpSecure');
      if (secureCheckbox) secureCheckbox.checked = true; // SSL voor 465
      document.getElementById('mailboxSmtpUsername').placeholder = 'Je volledige e-mailadres';
      document.getElementById('mailboxSmtpPassword').placeholder = 'Je e-mail wachtwoord';
      
      // Hide Mailgun hints, show default
      const usernameHint = document.getElementById('mailgunUsernameHint');
      const passwordHint = document.getElementById('mailgunPasswordHint');
      const defaultPasswordHint = document.getElementById('defaultPasswordHint');
      if (usernameHint) usernameHint.style.display = 'none';
      if (passwordHint) passwordHint.style.display = 'none';
      if (defaultPasswordHint) defaultPasswordHint.style.display = 'block';
      
      if (window.showNotification) {
        window.showNotification('Mijndomein configuratie ingevuld', 'info', 3000);
      }
    });
  }

  if (presetGmail) {
    presetGmail.addEventListener('click', () => {
      document.getElementById('mailboxSmtpHost').value = 'smtp.gmail.com';
      document.getElementById('mailboxSmtpPort').value = '587';
      const secureCheckbox = document.getElementById('mailboxSmtpSecure');
      if (secureCheckbox) secureCheckbox.checked = false; // STARTTLS voor 587
      document.getElementById('mailboxSmtpUsername').placeholder = 'Je Gmail adres';
      document.getElementById('mailboxSmtpPassword').placeholder = 'App-specifiek wachtwoord';
      if (window.showNotification) {
        window.showNotification('Gmail configuratie ingevuld. Gebruik een app-specifiek wachtwoord!', 'info', 5000);
      }
    });
  }

  // Mailbox modal handlers
  const addBtn = document.getElementById('addMailboxBtn');
  const modal = document.getElementById('mailboxModal');
  const closeBtn = document.getElementById('closeMailboxModal');
  const cancelBtn = document.getElementById('cancelMailboxBtn');
  const form = document.getElementById('mailboxForm');

  addBtn?.addEventListener('click', () => {
    // Navigate to new mailbox page instead of opening modal
    window.location.href = '/admin/mail/settings/new-mailbox';
  });

  closeBtn?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  cancelBtn?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
    if (form) {
      form.reset();
      form.onsubmit = null; // Reset form handler
    }
    currentMailboxId = null;
    
    // Reset modal title and button
    const modalTitle = modal?.querySelector('h2');
    const submitBtn = modal?.querySelector('button[type="submit"]');
    if (modalTitle) modalTitle.textContent = 'Mailbox toevoegen';
    if (submitBtn) submitBtn.textContent = 'Mailbox toevoegen';
  });

  // Store original form handler
  let originalFormHandler = null;
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // If editing (currentMailboxId is set), use edit handler instead
    if (currentMailboxId) {
      // The edit handler is set in openEditMailboxModal
      // Just submit the form normally
      return;
    }
    
    // Otherwise, create new mailbox
    const data = {
      email: document.getElementById('mailboxEmail').value,
      imap_host: document.getElementById('mailboxImapHost').value,
      imap_port: document.getElementById('mailboxImapPort').value,
      imap_secure: true,
      imap_username: document.getElementById('mailboxImapUsername').value,
      imap_password: document.getElementById('mailboxImapPassword').value,
      smtp_host: document.getElementById('mailboxSmtpHost').value,
      smtp_port: document.getElementById('mailboxSmtpPort').value,
      smtp_secure: document.getElementById('mailboxSmtpSecure')?.checked || false,
      smtp_username: document.getElementById('mailboxSmtpUsername').value,
      smtp_password: document.getElementById('mailboxSmtpPassword').value
    };

    try {
      const res = await fetch('/admin/api/mailboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success && result.mailbox) {
        if (modal) modal.style.display = 'none';
        if (form) {
          form.reset();
          // Reset form handler if it was changed
          form.onsubmit = null;
        }
        currentMailboxId = null;
        
        // Reset modal title and button
        const modalTitle = modal?.querySelector('h2');
        const submitBtn = modal?.querySelector('button[type="submit"]');
        if (modalTitle) modalTitle.textContent = 'Mailbox toevoegen';
        if (submitBtn) submitBtn.textContent = 'Mailbox toevoegen';
        
        // Show success notification
        if (window.showNotification) {
          window.showNotification(`Mailbox ${result.mailbox.email} succesvol toegevoegd! Synchronisatie gestart...`, 'success', 4000);
        } else {
          alert(`Mailbox ${result.mailbox.email} succesvol toegevoegd!`);
        }
        
        // Reload after a short delay to show notification and see sync status
        setTimeout(() => {
          location.reload();
        }, 1000);
      } else {
        const errorMsg = result.error || 'Kon mailbox niet toevoegen';
        if (window.showNotification) {
          window.showNotification(errorMsg, 'error', 5000);
        } else {
          alert(errorMsg);
        }
      }
    } catch (e) {
      const errorMsg = 'Fout bij toevoegen mailbox: ' + e.message;
      if (window.showNotification) {
        window.showNotification(errorMsg, 'error', 5000);
      } else {
        alert(errorMsg);
      }
    }
  });

  // Mailbox actions menu handlers
  mailboxActionsMenu = document.getElementById('mailboxActionsMenu');
  if (mailboxActionsMenu) {
    mailboxActionsMenu.addEventListener('click', async (e) => {
      const btn = e.target.closest('.mail-action-item');
      if (!btn || !currentMailboxId) return;
      
      const action = btn.getAttribute('data-action');
      mailboxActionsMenu.style.display = 'none';
      
      if (action === 'edit') {
        // Navigate to edit page
        window.location.href = `/admin/mail/settings/edit/${currentMailboxId}`;
      } else if (action === 'set-primary') {
        try {
          const res = await fetch(`/admin/api/mailboxes/${currentMailboxId}/set-primary`, { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.success) {
            if (window.showNotification) {
              window.showNotification('Mailbox ingesteld als primair', 'success', 3000);
            }
            setTimeout(() => location.reload(), 500);
          } else {
            const errorMsg = data.error || 'Kon mailbox niet instellen als primair';
            if (window.showNotification) {
              window.showNotification(errorMsg, 'error', 5000);
            } else {
              alert(errorMsg);
            }
          }
        } catch (e) {
          const errorMsg = 'Fout bij instellen primaire mailbox: ' + e.message;
          if (window.showNotification) {
            window.showNotification(errorMsg, 'error', 5000);
          } else {
            alert(errorMsg);
          }
        }
      } else if (action === 'sync') {
        // Find the table row for this mailbox
        const row = document.querySelector(`tr[data-mailbox-id="${currentMailboxId}"]`);
        if (!row) {
          console.error('Mailbox row not found');
          return;
        }

        // Show loading state
        showMailboxSyncLoader(row);

        try {
          const res = await fetch(`/admin/api/mailboxes/${currentMailboxId}/sync`, { method: 'POST' });
          const data = await res.json();
          
          if (res.ok && data.success) {
            // Hide loader
            hideMailboxSyncLoader(row);
            
            // Show success notification
            if (window.showNotification) {
              window.showNotification('Mailbox succesvol gesynchroniseerd', 'success', 3000);
            }
            
            // Reload after a short delay to show updated data
            setTimeout(() => location.reload(), 1500);
          } else {
            // Hide loader on error
            hideMailboxSyncLoader(row);
            
            // Show error notification
            if (window.showNotification) {
              window.showNotification(data.error || 'Kon niet synchroniseren', 'error', 5000);
            } else {
              alert(data.error || 'Kon niet synchroniseren');
            }
          }
        } catch (e) {
          // Hide loader on error
          hideMailboxSyncLoader(row);
          
          // Show error notification
          if (window.showNotification) {
            window.showNotification('Fout bij synchroniseren: ' + e.message, 'error', 5000);
          } else {
            alert('Fout bij synchroniseren: ' + e.message);
          }
        }
      } else if (action === 'delete') {
        showConfirmDialog(
          'Weet je zeker dat je deze mailbox wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.',
          async () => {
            try {
              const res = await fetch(`/admin/api/mailboxes/${currentMailboxId}`, { method: 'DELETE' });
              const data = await res.json();
              if (res.ok && data.success) {
                if (window.showNotification) {
                  window.showNotification('Mailbox verwijderd', 'success', 3000);
                }
                setTimeout(() => location.reload(), 500);
              } else {
                const errorMsg = data.error || 'Kon mailbox niet verwijderen';
                if (window.showNotification) {
                  window.showNotification(errorMsg, 'error', 5000);
                } else {
                  alert(errorMsg);
                }
              }
            } catch (e) {
              const errorMsg = 'Fout bij verwijderen: ' + e.message;
              if (window.showNotification) {
                window.showNotification(errorMsg, 'error', 5000);
              } else {
                alert(errorMsg);
              }
            }
          }
        );
      }
    });
  }

  // Make showConfirmDialog available globally
  window.showConfirmDialog = showConfirmDialog;
});

// Confirm dialog function (similar to users.js)
function showConfirmDialog(message, onConfirm, onCancel) {
  // Remove existing dialog if present
  const existing = document.getElementById("confirmDialog");
  if (existing) existing.remove();

  // Create modal element
  const modal = document.createElement("div");
  modal.id = "confirmDialog";
  modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 3000; align-items: center; justify-content: center;";
  modal.className = "confirm-dialog-modal";

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 0; max-width: 480px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #111827;">Bevestiging</h2>
        <span class="modal-close" style="font-size: 24px; cursor: pointer; color: #9ca3af; line-height: 1;">&times;</span>
      </div>
      <div style="padding: 24px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <i class="fas fa-question-circle" style="font-size: 24px; color: #3b82f6; margin-top: 2px;"></i>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">${message}</p>
        </div>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid #e5e7eb;">
        <button id="cancelConfirm" class="btn-outline" style="padding: 10px 20px;">Annuleren</button>
        <button id="confirmAction" class="btn-primary" style="padding: 10px 20px;">Bevestigen</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event handlers
  const handleCancel = () => {
    modal.style.display = "none";
    if (typeof onCancel === "function") onCancel();
    setTimeout(() => modal.remove(), 300);
  };

  const handleConfirm = () => {
    modal.style.display = "none";
    if (typeof onConfirm === "function") onConfirm();
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector(".modal-close")?.addEventListener("click", handleCancel);
  modal.querySelector("#cancelConfirm")?.addEventListener("click", handleCancel);
  modal.querySelector("#confirmAction")?.addEventListener("click", handleConfirm);
  
  // Close on outside click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) handleCancel();
  });
}

// Open edit mailbox modal
async function openEditMailboxModal(mailboxId) {
  try {
    const res = await fetch(`/admin/api/mailboxes/${mailboxId}`);
    const data = await res.json();
    
    if (!res.ok || !data.mailbox) {
      throw new Error(data.error || 'Kon mailbox niet ophalen');
    }

    const mb = data.mailbox;
    const modal = document.getElementById('mailboxModal');
    const form = document.getElementById('mailboxForm');
    
    if (!modal || !form) {
      alert('Modal niet gevonden');
      return;
    }

    // Set current mailbox ID for update
    currentMailboxId = mailboxId;

    // Fill form with existing data
    document.getElementById('mailboxEmail').value = mb.email || '';
    document.getElementById('mailboxImapHost').value = mb.imap_host || '';
    document.getElementById('mailboxImapPort').value = mb.imap_port || 993;
    document.getElementById('mailboxImapUsername').value = mb.imap_username || mb.username || '';
    document.getElementById('mailboxImapPassword').value = ''; // Don't show password
    document.getElementById('mailboxImapPassword').placeholder = 'Laat leeg om niet te wijzigen';
    document.getElementById('mailboxSmtpHost').value = mb.smtp_host || '';
    document.getElementById('mailboxSmtpPort').value = mb.smtp_port || 465;
    document.getElementById('mailboxSmtpSecure').checked = mb.smtp_secure !== false;
    document.getElementById('mailboxSmtpUsername').value = mb.smtp_username || mb.username || '';
    document.getElementById('mailboxSmtpPassword').value = ''; // Don't show password
    document.getElementById('mailboxSmtpPassword').placeholder = 'Laat leeg om niet te wijzigen';

    // Update modal title and submit button
    const modalTitle = modal.querySelector('h2');
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (modalTitle) modalTitle.textContent = 'Mailbox bewerken';
    if (submitBtn) submitBtn.textContent = 'Mailbox bijwerken';

    // Change form action to update
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const updateData = {
        email: document.getElementById('mailboxEmail').value,
        imap_host: document.getElementById('mailboxImapHost').value,
        imap_port: document.getElementById('mailboxImapPort').value,
        imap_secure: true,
        imap_username: document.getElementById('mailboxImapUsername').value,
        smtp_host: document.getElementById('mailboxSmtpHost').value,
        smtp_port: document.getElementById('mailboxSmtpPort').value,
        smtp_secure: document.getElementById('mailboxSmtpSecure')?.checked || false,
        smtp_username: document.getElementById('mailboxSmtpUsername').value,
      };

      // Only include passwords if changed
      const imapPassword = document.getElementById('mailboxImapPassword').value;
      if (imapPassword && imapPassword.trim()) {
        updateData.imap_password = imapPassword;
      }
      
      const smtpPassword = document.getElementById('mailboxSmtpPassword').value;
      if (smtpPassword && smtpPassword.trim()) {
        updateData.smtp_password = smtpPassword;
      }

      try {
        const res = await fetch(`/admin/api/mailboxes/${mailboxId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        
        const result = await res.json();
        
        if (res.ok && result.success) {
          modal.style.display = 'none';
          form.reset();
          currentMailboxId = null;
          
          if (window.showNotification) {
            window.showNotification(`Mailbox ${result.mailbox?.email || 'bijgewerkt'} succesvol bijgewerkt!`, 'success', 3000);
          }
          
          setTimeout(() => location.reload(), 1000);
        } else {
          const errorMsg = result.error || 'Kon mailbox niet bijwerken';
          if (window.showNotification) {
            window.showNotification(errorMsg, 'error', 5000);
          } else {
            alert(errorMsg);
          }
        }
      } catch (e) {
        const errorMsg = 'Fout bij bijwerken mailbox: ' + e.message;
        if (window.showNotification) {
          window.showNotification(errorMsg, 'error', 5000);
        } else {
          alert(errorMsg);
        }
      }
    };

    modal.style.display = 'flex';
  } catch (e) {
    const errorMsg = 'Fout bij ophalen mailbox: ' + e.message;
    if (window.showNotification) {
      window.showNotification(errorMsg, 'error', 5000);
    } else {
      alert(errorMsg);
    }
  }
}

function handleSignaturePhotoChange(event) {
  const file = event.target.files?.[0] || null;
  const previewEl = document.getElementById('signaturePhotoPreview');

  if (!previewEl) return;

  if (!file) {
    signaturePhotoFile = null;
    restoreDefaultSignaturePhoto();
    return;
  }

  signaturePhotoFile = file;

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    if (loadEvent.target?.result) {
      previewEl.innerHTML = `<img src="${loadEvent.target.result}" alt="Preview" />`;
    }
  };
  reader.readAsDataURL(file);
}

function restoreDefaultSignaturePhoto() {
  const previewEl = document.getElementById('signaturePhotoPreview');
  if (!previewEl) return;

  if (defaultSignaturePhotoMarkup) {
    previewEl.innerHTML = defaultSignaturePhotoMarkup;
  } else {
    const initial = previewEl.getAttribute('data-initial') || 'U';
    previewEl.innerHTML = `<div class="avatar-placeholder">${initial}</div>`;
  }
}

function triggerSignaturePhotoUpload(event) {
  if (event) event.preventDefault();
  const button = document.getElementById('uploadPhotoBtn');
  const input = document.getElementById('signaturePhotoInput');

  if (!input || button?.disabled) return;
  input.click();
}

// Mailbox functions
function openAddMailboxModal() {
  const modal = document.getElementById('mailboxModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function showMailboxSyncLoader(row) {
  // Store original content
  row.setAttribute('data-original-content', row.innerHTML);
  
  // Create loader HTML
  const loaderHTML = `
    <td colspan="6" style="padding: 24px; text-align: center;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
        <div class="mailbox-sync-spinner" style="width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <span style="color: #6b7280; font-size: 14px;">Gegevens worden opgehaald...</span>
      </div>
    </td>
  `;
  
  row.innerHTML = loaderHTML;
  row.style.opacity = '0.7';
  
  // Add spinner animation if not already in document
  if (!document.getElementById('mailbox-sync-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'mailbox-sync-spinner-style';
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

function hideMailboxSyncLoader(row) {
  const originalContent = row.getAttribute('data-original-content');
  if (originalContent) {
    row.innerHTML = originalContent;
    row.removeAttribute('data-original-content');
    
    // Re-attach the onclick handler for the action button
    const actionBtn = row.querySelector('.action-menu-btn');
    if (actionBtn) {
      const mailboxId = row.getAttribute('data-mailbox-id');
      actionBtn.setAttribute('onclick', `showMailboxActions('${mailboxId}', event)`);
    }
  }
  row.style.opacity = '1';
}

function showMailboxActions(id, event) {
  event.stopPropagation();
  currentMailboxId = id;
  
  if (!mailboxActionsMenu) {
    mailboxActionsMenu = document.getElementById('mailboxActionsMenu');
  }
  
  if (mailboxActionsMenu) {
    // Hide menu first to get correct dimensions
    mailboxActionsMenu.style.display = 'none';
    
    // Get button position
    const button = event.target.closest('button');
    const buttonRect = button.getBoundingClientRect();
    
    // Show menu temporarily to get dimensions
    mailboxActionsMenu.style.display = 'block';
    mailboxActionsMenu.style.visibility = 'hidden';
    const menuRect = mailboxActionsMenu.getBoundingClientRect();
    mailboxActionsMenu.style.display = 'none';
    mailboxActionsMenu.style.visibility = 'visible';
    
    // Calculate position - align right edge of menu with right edge of button
    let leftPos = buttonRect.right - menuRect.width;
    let topPos = buttonRect.bottom + 4; // 4px gap below button
    
    // Ensure menu doesn't go off left edge
    if (leftPos < 10) {
      leftPos = 10;
    }
    
    // Check if menu would overflow bottom edge
    if (topPos + menuRect.height > window.innerHeight - 10) {
      topPos = buttonRect.top - menuRect.height - 4; // Show above button instead
      if (topPos < 10) {
        topPos = 10;
      }
    }
    
    // Check if menu would overflow right edge
    if (leftPos + menuRect.width > window.innerWidth - 10) {
      leftPos = window.innerWidth - menuRect.width - 10;
    }
    
    // Apply position
    mailboxActionsMenu.style.display = 'block';
    mailboxActionsMenu.style.position = 'fixed';
    mailboxActionsMenu.style.left = leftPos + 'px';
    mailboxActionsMenu.style.top = topPos + 'px';
    
    // Close on outside click
    setTimeout(() => {
      const closeMenu = (e) => {
        if (!mailboxActionsMenu.contains(e.target) && !button.contains(e.target)) {
          mailboxActionsMenu.style.display = 'none';
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 10);
  }
}

// Toggle AI Settings Edit Mode
function toggleEditAi() {
  const inputs = ['aiTone', 'aiFormality', 'aiLength', 'aiInstructions'];
  const toneSelect = document.getElementById('aiTone');
  const isDisabled = toneSelect ? toneSelect.disabled : true;

  inputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !isDisabled;
    }
  });

  const editBtn = document.getElementById('editAiBtn');
  const actions = document.getElementById('aiEditActions');
  if (editBtn) editBtn.style.display = isDisabled ? 'none' : 'flex';
  if (actions) actions.style.display = isDisabled ? 'flex' : 'none';
}

function cancelEditAi() {
  toggleEditAi();
  location.reload();
}

async function saveAiSettings() {
  const payload = {
    tone: document.getElementById('aiTone')?.value || 'professional',
    formality: document.getElementById('aiFormality')?.value || 'formal',
    length: document.getElementById('aiLength')?.value || 'medium',
    language: 'nl',
    custom_instructions: document.getElementById('aiInstructions')?.value || ''
  };

  try {
    const response = await fetch('/admin/api/mail/writing-style', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        alert('AI instellingen opgeslagen!');
        toggleEditAi();
      } else {
        throw new Error(result.error || 'Kon AI instellingen niet opslaan');
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Kon AI instellingen niet opslaan');
    }
  } catch (error) {
    alert(error?.message || 'Fout bij opslaan');
    console.error('AI settings save error:', error);
  }
}

// Toggle Signature Edit Mode
function toggleEditSignature() {
  const inputs = ['signatureName', 'signatureEmail', 'signaturePhone', 'uploadPhotoBtn'];
  const nameInput = document.getElementById('signatureName');
  const isDisabled = nameInput ? nameInput.disabled : true;

  inputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !isDisabled;
    }
  });

  const fileInput = document.getElementById('signaturePhotoInput');
  if (fileInput) {
    fileInput.disabled = !isDisabled;
  }

  const editBtn = document.getElementById('editSignatureBtn');
  const actions = document.getElementById('signatureEditActions');
  if (editBtn) editBtn.style.display = isDisabled ? 'none' : 'flex';
  if (actions) actions.style.display = isDisabled ? 'flex' : 'none';
}

function cancelEditSignature() {
  toggleEditSignature();
  restoreDefaultSignaturePhoto();
  const fileInput = document.getElementById('signaturePhotoInput');
  if (fileInput) {
    fileInput.value = '';
  }
  signaturePhotoFile = null;
  location.reload();
}

async function uploadSignaturePhoto(file) {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch('/admin/api/upload-signature-photo', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Foto uploaden mislukt');
  }

  const result = await response.json();
  if (result?.url) {
    return result.url;
  }
  if (result?.photo_url) {
    return result.photo_url;
  }
  if (result?.success && result?.data?.url) {
    return result.data.url;
  }

  throw new Error(result?.error || 'Onbekende fout bij foto-upload');
}

async function saveSignatureSettings() {
  const nameField = document.getElementById('signatureName');
  const emailField = document.getElementById('signatureEmail');
  const phoneField = document.getElementById('signaturePhone');

  // Validate required fields
  if (!nameField?.value || !emailField?.value) {
    alert('Weergavenaam en e-mailadres zijn verplicht');
    return;
  }

  const payload = {
    display_name: nameField.value.trim(),
    email: emailField.value.trim(),
    phone: phoneField?.value?.trim() || null
  };

  try {
    // Upload photo first if selected
    if (signaturePhotoFile) {
      try {
        const photoUrl = await uploadSignaturePhoto(signaturePhotoFile);
        if (photoUrl) {
          payload.photo_url = photoUrl;
        }
      } catch (photoError) {
        console.error('Photo upload error:', photoError);
        // Continue without photo if upload fails
      }
    }

    // Save signature
    const response = await fetch('/admin/api/mail/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Kon handtekening niet opslaan');
    }

    if (result.success) {
      alert('Handtekening opgeslagen!');
      signaturePhotoFile = null;
      toggleEditSignature();
      // Small delay before reload to show success message
      setTimeout(() => {
        location.reload();
      }, 500);
    } else {
      throw new Error(result.error || 'Kon handtekening niet opslaan');
    }
  } catch (error) {
    alert(error?.message || 'Fout bij opslaan');
    console.error('Signature save error:', error);
  }
}

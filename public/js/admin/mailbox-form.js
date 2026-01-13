// Mailbox form handler for new-mailbox.ejs page
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('mailboxForm');
  const isEditing = window.location.pathname.includes('/edit/');
  const mailboxId = isEditing ? window.location.pathname.split('/').pop() : null;

  // SMTP Preset handlers
  const presetMailgun = document.getElementById('presetMailgun');
  const presetMijndomein = document.getElementById('presetMijndomein');
  const presetGmail = document.getElementById('presetGmail');

  if (presetMailgun) {
    presetMailgun.addEventListener('click', () => {
      document.getElementById('mailboxSmtpHost').value = 'smtp.eu.mailgun.org';
      document.getElementById('mailboxSmtpPort').value = '587';
      const secureCheckbox = document.getElementById('mailboxSmtpSecure');
      if (secureCheckbox) secureCheckbox.checked = false;
      document.getElementById('mailboxSmtpUsername').placeholder = 'brad@growsocialmedia.nl';
      document.getElementById('mailboxSmtpPassword').placeholder = 'Mailgun SMTP wachtwoord';
      
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
      if (secureCheckbox) secureCheckbox.checked = true;
      document.getElementById('mailboxSmtpUsername').placeholder = 'Je volledige e-mailadres';
      document.getElementById('mailboxSmtpPassword').placeholder = 'Je e-mail wachtwoord';
      
      const usernameHint = document.getElementById('mailgunUsernameHint');
      const passwordHint = document.getElementById('mailgunPasswordHint');
      const defaultPasswordHint = document.getElementById('defaultPasswordHint');
      if (usernameHint) usernameHint.style.display = 'none';
      if (passwordHint) passwordHint.style.display = 'none';
      if (defaultPasswordHint) defaultPasswordHint.style.display = 'block';
    });
  }

  if (presetGmail) {
    presetGmail.addEventListener('click', () => {
      document.getElementById('mailboxSmtpHost').value = 'smtp.gmail.com';
      document.getElementById('mailboxSmtpPort').value = '587';
      const secureCheckbox = document.getElementById('mailboxSmtpSecure');
      if (secureCheckbox) secureCheckbox.checked = false;
      document.getElementById('mailboxSmtpUsername').placeholder = 'Je Gmail adres';
      document.getElementById('mailboxSmtpPassword').placeholder = 'App-specifiek wachtwoord';
    });
  }

  // Form submission
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
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

    // For editing, passwords are optional
    if (isEditing) {
      if (!data.imap_password || !data.imap_password.trim()) {
        delete data.imap_password;
      }
      if (!data.smtp_password || !data.smtp_password.trim()) {
        delete data.smtp_password;
      }
    }

    try {
      const url = isEditing 
        ? `/admin/api/mailboxes/${mailboxId}`
        : '/admin/api/mailboxes';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await res.json();
      
      if (res.ok && result.success) {
        if (window.showNotification) {
          window.showNotification(
            isEditing 
              ? `Mailbox ${result.mailbox?.email || 'bijgewerkt'} succesvol bijgewerkt!` 
              : `Mailbox ${result.mailbox.email} succesvol toegevoegd! Synchronisatie gestart...`,
            'success',
            4000
          );
        }
        
        // Redirect back to settings page
        setTimeout(() => {
          window.location.href = '/admin/mail/settings';
        }, 1000);
      } else {
        const errorMsg = result.error || (isEditing ? 'Kon mailbox niet bijwerken' : 'Kon mailbox niet toevoegen');
        if (window.showNotification) {
          window.showNotification(errorMsg, 'error', 5000);
        } else {
          alert(errorMsg);
        }
      }
    } catch (e) {
      const errorMsg = `Fout bij ${isEditing ? 'bijwerken' : 'toevoegen'} mailbox: ` + e.message;
      if (window.showNotification) {
        window.showNotification(errorMsg, 'error', 5000);
      } else {
        alert(errorMsg);
      }
    }
  });
});


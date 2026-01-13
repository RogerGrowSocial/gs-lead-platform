document.addEventListener("DOMContentLoaded", () => {
  // Import jQuery (if not already included)
  if (typeof jQuery === "undefined") {
    var script = document.createElement("script")
    script.src = "https://code.jquery.com/jquery-3.6.0.min.js"
    script.type = "text/javascript"
    document.head.appendChild(script)

    script.onload = () => {
      // Now jQuery is loaded, you can use the $ variable
      window.jQuery = jQuery // Declare jQuery in the global scope
      window.$ = jQuery // Declare $ in the global scope
      initializeSettings()
    }
  } else {
    // jQuery is already loaded, proceed with initialization
    initializeSettings()
  }

  function initializeSettings() {
    // Tab navigatie is nu via routes, geen JavaScript tab switching meer nodig

    // Modal functionaliteit
    document.querySelectorAll('[data-toggle="modal"]').forEach((button) => {
      button.addEventListener("click", function () {
        const target = this.getAttribute("data-target")
        const modal = document.querySelector(target)
        if (modal) {
          $(target).modal("show")
        }
      })
    })

    // Password toggle functionality (eye icon)
    const passwordToggles = document.querySelectorAll(".password-toggle")
    passwordToggles.forEach((toggle) => {
      toggle.addEventListener("click", function () {
        const targetId = this.getAttribute("data-target")
        const passwordInput = document.getElementById(targetId)
        if (passwordInput) {
          if (passwordInput.type === "password") {
            passwordInput.type = "text"
            this.classList.remove("fa-eye")
            this.classList.add("fa-eye-slash")
          } else {
            passwordInput.type = "password"
            this.classList.remove("fa-eye-slash")
            this.classList.add("fa-eye")
          }
        }
      })
    })

    // Wachtwoord validatie en show confirm field
    const newPasswordInput = document.getElementById("newPassword")
    const confirmPasswordInput = document.getElementById("confirmPassword")
    const confirmPasswordGroup = document.getElementById("confirmPasswordGroup")
    const savePasswordBtn = document.getElementById("savePasswordBtn")
    const passwordForm = document.getElementById("passwordForm")

    // Update save button state based on newPassword input
    const updateSaveButton = () => {
      if (savePasswordBtn) {
        const hasNewPassword = newPasswordInput && newPasswordInput.value.trim().length > 0
        if (hasNewPassword) {
          savePasswordBtn.disabled = false
          savePasswordBtn.classList.remove("btn-secondary")
          savePasswordBtn.classList.add("btn-primary")
          savePasswordBtn.style.opacity = "1"
          savePasswordBtn.style.cursor = "pointer"
        } else {
          savePasswordBtn.disabled = true
          savePasswordBtn.classList.remove("btn-primary")
          savePasswordBtn.classList.add("btn-secondary")
          savePasswordBtn.style.opacity = "0.6"
          savePasswordBtn.style.cursor = "not-allowed"
        }
      }
    }

    if (newPasswordInput) {
      // Update save button on input
      newPasswordInput.addEventListener("input", function () {
        updateSaveButton()
        // Remove valid class to prevent checkmark
        this.classList.remove('is-valid')
        
        // Show confirm password field when newPassword is filled
        if (this.value.length > 0) {
          if (confirmPasswordGroup) {
            confirmPasswordGroup.style.display = "block"
            confirmPasswordInput.required = true
          }
        } else {
          if (confirmPasswordGroup) {
            confirmPasswordGroup.style.display = "none"
            confirmPasswordInput.required = false
            confirmPasswordInput.value = ""
          }
        }
      })

      // Password validation
      if (confirmPasswordInput) {
        const validatePassword = () => {
          if (confirmPasswordInput.value === "") {
            confirmPasswordInput.setCustomValidity("")
          } else if (newPasswordInput.value !== confirmPasswordInput.value) {
            confirmPasswordInput.setCustomValidity("Wachtwoorden komen niet overeen")
          } else {
            confirmPasswordInput.setCustomValidity("")
          }
          updateSaveButton()
          // Remove valid classes to prevent checkmarks
          newPasswordInput.classList.remove('is-valid')
          confirmPasswordInput.classList.remove('is-valid')
        }

        newPasswordInput.addEventListener("change", validatePassword)
        newPasswordInput.addEventListener("input", validatePassword)
        confirmPasswordInput.addEventListener("keyup", validatePassword)
        confirmPasswordInput.addEventListener("input", validatePassword)
      }
      
      // Also listen to currentPassword to remove valid class
      const currentPasswordInput = document.getElementById("currentPassword")
      if (currentPasswordInput) {
        currentPasswordInput.addEventListener("input", function() {
          this.classList.remove('is-valid')
        })
      }
    }

    // Form submission - prevent default validation checkmarks
    if (passwordForm) {
      // Remove valid classes from inputs to prevent checkmarks
      const removeValidClasses = () => {
        const inputs = passwordForm.querySelectorAll('.form-control')
        inputs.forEach(input => {
          input.classList.remove('is-valid')
        })
      }

      passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault()
        e.stopPropagation()

        // Remove any validation classes that show checkmarks
        passwordForm.classList.remove("was-validated")
        removeValidClasses()
        
        if (!passwordForm.checkValidity()) {
          passwordForm.classList.add("was-validated")
          // Immediately remove valid classes again to prevent checkmarks
          setTimeout(removeValidClasses, 0)
          return
        }

        // Remove valid classes before submitting
        removeValidClasses()

        // Submit via AJAX to avoid page reload and validation feedback
        const formData = {
          currentPassword: document.getElementById("currentPassword").value,
          newPassword: document.getElementById("newPassword").value,
          confirmPassword: document.getElementById("confirmPassword").value
        }

        try {
          const response = await fetch('/dashboard/settings/password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
          })

          const result = await response.json()

          if (result.success) {
            if (window.showNotification) {
              window.showNotification(result.message || 'Wachtwoord bijgewerkt', 'success')
            }
            // Reset form and close
            passwordForm.reset()
            const passwordEdit = document.getElementById('passwordEdit')
            if (passwordEdit) passwordEdit.style.display = 'none'
            // Reset button state
            updateSaveButton()
            // Reload after short delay
            setTimeout(() => location.reload(), 1500)
          } else {
            if (window.showNotification) {
              window.showNotification(result.message || 'Fout bij bijwerken wachtwoord', 'error')
            }
          }
        } catch (error) {
          if (window.showNotification) {
            window.showNotification('Fout bij bijwerken wachtwoord', 'error')
          }
        }
      })
    }

    // Twee-factor authenticatie
    const twoFactorSetup = document.getElementById("twoFactorEdit")

    // Load 2FA QR code
    async function loadTwoFactorQRCode() {
      const qrContainer = document.getElementById('qrCodeContainer')
      const secretInput = document.getElementById('twoFactorSecret')
      const regenerateBtn = document.getElementById('regenerateQRBtn')
      
      if (!qrContainer) {
        return
      }
      
      if (!secretInput) {
        return
      }

      try {
        qrContainer.innerHTML = '<div class="qr-code-placeholder" style="width: 200px; height: 200px; margin: 0 auto; border: 1px solid #e9ecef; border-radius: 8px; display: flex; align-items: center; justify-content: center; background-color: #f9fafb; color: #9ca3af;"><span>Laden...</span></div>'
        
        const response = await fetch('/dashboard/settings/two-factor/secret')
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.success && data.qrCode) {
          qrContainer.innerHTML = `<img src="${data.qrCode}" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid #e9ecef; border-radius: 8px;">`
          secretInput.value = data.secret
          if (regenerateBtn) regenerateBtn.style.display = 'block'
        } else {
          qrContainer.innerHTML = `<div class="qr-code-placeholder" style="width: 200px; height: 200px; margin: 0 auto; border: 1px solid #e9ecef; border-radius: 8px; display: flex; align-items: center; justify-content: center; background-color: #f9fafb; color: #dc2626;"><span>Fout: ${data.message || 'Ongeldige response'}</span></div>`
        }
      } catch (error) {
        qrContainer.innerHTML = `<div class="qr-code-placeholder" style="width: 200px; height: 200px; margin: 0 auto; border: 1px solid #e9ecef; border-radius: 8px; display: flex; align-items: center; justify-content: center; background-color: #f9fafb; color: #dc2626;"><span>Fout: ${error.message}</span></div>`
      }
    }

    // Make loadTwoFactorQRCode globally available for debugging
    window.loadTwoFactorQRCode = loadTwoFactorQRCode

    // 2FA Disable form
    const twoFactorDisableForm = document.getElementById('twoFactorDisableForm')
    if (twoFactorDisableForm) {
      // Remove valid classes to prevent checkmarks
      const removeValidClassesFromForm = (form) => {
        const inputs = form.querySelectorAll('.form-control')
        inputs.forEach(input => {
          input.classList.remove('is-valid')
        })
      }
      
      // Prevent valid classes on input
      const disablePasswordInput = document.getElementById('disablePassword')
      if (disablePasswordInput) {
        disablePasswordInput.addEventListener('input', () => {
          disablePasswordInput.classList.remove('is-valid')
        })
        disablePasswordInput.addEventListener('change', () => {
          disablePasswordInput.classList.remove('is-valid')
        })
      }
      
      twoFactorDisableForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        const form = e.target
        
        // Remove any valid classes before validation
        removeValidClassesFromForm(form)
        
        if (!form.checkValidity()) {
          form.classList.add('was-validated')
          // Immediately remove valid classes again
          setTimeout(() => removeValidClassesFromForm(form), 0)
          return
        }
        
        // Remove valid classes before submitting
        removeValidClassesFromForm(form)

        const passwordInput = document.getElementById('disablePassword')
        const password = passwordInput.value

        if (!password) {
          if (window.showNotification) {
            window.showNotification('Voer je wachtwoord in', 'error')
          }
          return
        }

        try {
          const response = await fetch('/dashboard/settings/two-factor/disable', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password })
          })

          let result
          try {
            result = await response.json()
          } catch (e) {
            throw new Error('Invalid server response')
          }

          if (response.ok && result.success) {
            if (window.showNotification) {
              window.showNotification('2FA is uitgeschakeld', 'success')
            }
            
            // Reload page after a short delay to update UI
            setTimeout(() => {
              window.location.reload()
            }, 1500)
          } else {
            const errorMsg = result?.message || result?.error || 'Fout bij uitschakelen van 2FA'
            if (window.showNotification) {
              window.showNotification(errorMsg, 'error')
            }
            
            // Clear password field on error
            passwordInput.value = ''
          }
        } catch (error) {
          const errorMsg = error.message || 'Fout bij uitschakelen van 2FA'
          if (window.showNotification) {
            window.showNotification(errorMsg, 'error')
          }
          passwordInput.value = ''
        }
      })
    }

    // Regenerate QR code button
    const regenerateQRBtn = document.getElementById('regenerateQRBtn')
    if (regenerateQRBtn) {
      regenerateQRBtn.addEventListener('click', async () => {
        const secretInput = document.getElementById('twoFactorSecret')
        if (secretInput) secretInput.value = ''
        await loadTwoFactorQRCode()
      })
    }

    // 2FA verification form
    const twoFactorVerifyForm = document.getElementById('twoFactorVerifyForm')
    if (twoFactorVerifyForm) {
      // Remove valid classes to prevent checkmarks
      const removeValidClassesFromVerifyForm = (form) => {
        const inputs = form.querySelectorAll('.form-control')
        inputs.forEach(input => {
          input.classList.remove('is-valid')
        })
      }
      
      // Prevent valid classes on verification code input
      const verificationCodeInput = document.getElementById('verificationCode')
      if (verificationCodeInput) {
        verificationCodeInput.addEventListener('input', () => {
          verificationCodeInput.classList.remove('is-valid')
        })
        verificationCodeInput.addEventListener('change', () => {
          verificationCodeInput.classList.remove('is-valid')
        })
      }
      
      twoFactorVerifyForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        const form = e.target
        
        // Remove any valid classes before validation
        removeValidClassesFromVerifyForm(form)
        
        if (!form.checkValidity()) {
          form.classList.add('was-validated')
          // Immediately remove valid classes again
          setTimeout(() => removeValidClassesFromVerifyForm(form), 0)
          return
        }
        
        // Remove valid classes before submitting
        removeValidClassesFromVerifyForm(form)

        const verificationCodeInput = document.getElementById('verificationCode')
        const verificationCode = verificationCodeInput.value.replace(/\D/g, '') // Only numbers
        
        if (verificationCode.length !== 6) {
          if (window.showNotification) {
            window.showNotification('Voer een geldige 6-cijferige code in', 'error')
          }
          verificationCodeInput.value = ''
          return
        }

        const secret = document.getElementById('twoFactorSecret').value

        if (!secret) {
          if (window.showNotification) {
            window.showNotification('Geen 2FA secret gevonden. Genereer eerst een QR code.', 'error')
          }
          return
        }

        try {
          const response = await fetch('/dashboard/settings/two-factor/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ verificationCode: verificationCode, secret })
          })

          const result = await response.json()

          if (result.success) {
            if (window.showNotification) {
              window.showNotification(result.message || '2FA succesvol ingeschakeld', 'success')
            }
            // Update UI
            const securityItem = document.querySelector('#editTwoFactorBtn')?.closest('.security-item')
            if (securityItem) {
              const statusText = securityItem.querySelector('.sec-status')
              if (statusText) {
                statusText.textContent = 'Ingeschakeld'
                statusText.classList.add('sec-success')
              }
            }
            // Reload page to show enabled state
            setTimeout(() => location.reload(), 1500)
          } else {
            if (window.showNotification) {
              window.showNotification(result.message || 'Ongeldige verificatiecode', 'error')
            }
            document.getElementById('verificationCode').value = ''
          }
        } catch (error) {
          if (window.showNotification) {
            window.showNotification('Fout bij verifiëren 2FA', 'error')
          }
        }
      })
    }

    // Load QR code on page load if 2FA is not enabled
    ;(async () => {
      if (twoFactorSetup && !twoFactorSetup.classList.contains('d-none')) {
        // Check if 2FA is enabled by looking at the status text
        const statusText = document.querySelector('#editTwoFactorBtn')?.closest('.security-item')?.querySelector('.sec-status')
        const isEnabled = statusText?.textContent?.trim() === 'Ingeschakeld'
        if (!isEnabled) {
          await loadTwoFactorQRCode()
        }
      }
    })()
    // Security edit buttons
    const editPasswordBtn = document.getElementById('editPasswordBtn')
    const passwordEdit = document.getElementById('passwordEdit')
    if (editPasswordBtn && passwordEdit) {
      editPasswordBtn.addEventListener('click', () => {
        const isHidden = passwordEdit.style.display === 'none' || passwordEdit.style.display === ''
        passwordEdit.style.display = isHidden ? 'block' : 'none'
        
        // Reset button state when opening the edit section
        if (isHidden) {
          updateSaveButton()
        }
      })
    }

    // 2FA Edit button handler
    const editTwoFactorBtn = document.getElementById('editTwoFactorBtn')
    const twoFactorEdit = document.getElementById('twoFactorEdit')
    
    if (editTwoFactorBtn && twoFactorEdit) {
      editTwoFactorBtn.addEventListener('click', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        // Check if 2FA is enabled by looking at the status text
        // Find the security-item that contains the 2FA button
        const securityItem = twoFactorEdit.closest('.security-item') || editTwoFactorBtn.closest('.security-item')
        const statusText = securityItem?.querySelector('.sec-status')
        const isEnabled = statusText?.textContent?.includes('Ingeschakeld') || statusText?.textContent?.trim() === 'Ingeschakeld'
        
        // Toggle visibility - check both class and style
        const hasDNone = twoFactorEdit.classList.contains('d-none')
        const hasStyleNone = twoFactorEdit.style.display === 'none'
        const hasStyleEmpty = twoFactorEdit.style.display === ''
        const isHidden = hasDNone || hasStyleNone || hasStyleEmpty
        
        if (isHidden) {
          // Show the edit section
          twoFactorEdit.classList.remove('d-none')
          twoFactorEdit.style.display = 'block'
          
          // Only load QR code if 2FA is NOT enabled
          if (!isEnabled) {
          const secretInput = document.getElementById('twoFactorSecret')
          const qrContainer = document.getElementById('qrCodeContainer')
          
            if (secretInput && !secretInput.value && qrContainer) {
            await loadTwoFactorQRCode()
            }
          }
        } else {
          // Hide the edit section
          twoFactorEdit.classList.add('d-none')
          twoFactorEdit.style.display = 'none'
        }
      })
    }

    // Betaalmethode selectie
    const paymentMethodSelect = document.getElementById("paymentMethod")
    const creditcardFields = document.getElementById("creditcardFields")

    if (paymentMethodSelect && creditcardFields) {
      paymentMethodSelect.addEventListener("change", function () {
        if (this.value === "creditcard") {
          creditcardFields.classList.remove("d-none")
        } else {
          creditcardFields.classList.add("d-none")
        }
      })
    }

    // Formulier validatie
    const forms = document.querySelectorAll(".needs-validation")

    forms.forEach((form) => {
      form.addEventListener("submit", (event) => {
        if (!form.checkValidity()) {
          event.preventDefault()
          event.stopPropagation()
        }
        form.classList.add("was-validated")
      })
    })

    // Check if we have a saved profile image in localStorage
    const savedProfileImage = localStorage.getItem("profileImageData")
    const sidebarProfileImage = document.querySelector(".settings-avatar img")
    const avatarPlaceholder = document.querySelector(".avatar-placeholder")

    // If we have a saved image and there's a placeholder, replace it with the saved image
    if (savedProfileImage && avatarPlaceholder) {
      avatarPlaceholder.remove()

      // Create a new img element
      const newImg = document.createElement("img")
      newImg.src = savedProfileImage
      newImg.alt = "Profielfoto"
      newImg.className = "rounded-circle"

      // Add it to the avatar container
      document.querySelector(".settings-avatar").appendChild(newImg)
    }
    // If we have a saved image and there's already an image, update it
    else if (savedProfileImage && sidebarProfileImage) {
      sidebarProfileImage.src = savedProfileImage
    }


    // Automatisch opslaan via AJAX voor alle formuliervelden op profiel pagina
    // Zoek de form op de profiel tab - deze heeft action="/dashboard/settings/profile"
    const profileForm = document.querySelector('form[action="/dashboard/settings/profile"]')
    if (profileForm) {
      let saveInProgress = false
      let saveTimeout = null
      let lastSavedData = null

      // Functie om het hele profiel op te slaan via AJAX
      // Make it globally accessible for Google Places autocomplete
      const saveProfile = async (skipNotification = false) => {
        if (saveInProgress) {
          return
        }
        
        // Clear any pending debounced saves to prevent duplicates
        if (saveTimeout) {
          clearTimeout(saveTimeout)
          saveTimeout = null
        }

        // Verzamel form data - ensure all fields are captured correctly
        const addressField = document.getElementById('address')
        const postalCodeField = document.getElementById('postalCode')
        const cityField = document.getElementById('city')
        
        const data = {
          firstName: document.getElementById('firstName')?.value?.trim() || null,
          lastName: document.getElementById('lastName')?.value?.trim() || null,
          companyName: document.getElementById('companyName')?.value?.trim() || null,
          email: document.getElementById('email')?.value?.trim() || null,
          phone: document.getElementById('phone')?.value?.trim() || null,
          address: addressField?.value?.trim() || null,
          postalCode: postalCodeField?.value?.trim() || null,
          city: cityField?.value?.trim() || null,
          country: document.getElementById('country')?.value || null
        }
        

        // Check if there are actual meaningful changes (not just empty to empty)
        const hasChanges = data.firstName || data.lastName || data.companyName || data.email || 
                          data.phone || data.address || data.postalCode || data.city || data.country
        
        if (!hasChanges) {
          // Update lastSavedData to prevent false change detection later
          lastSavedData = JSON.stringify(data)
          return
        }
        
        // Check if data actually changed
        const dataString = JSON.stringify(data)
        if (dataString === lastSavedData) {
          return
        }

        // Validatie
        if (!data.companyName || !data.email) {
          // Don't show error for empty fields while user is typing
          return
        }

        // Email validatie
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(data.email)) {
          // Don't show error while user is typing
          return
        }

        saveInProgress = true

        try {

          const response = await fetch('/dashboard/settings/profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          })


          let result
          try {
            result = await response.json()
          } catch (parseError) {
            const text = await response.text()
            throw new Error('Invalid server response')
          }

          if (response.ok && result.success) {
            lastSavedData = dataString
            
            // Log what was actually saved according to server
            if (result.data) {
              // Data saved successfully
            }
            
            // Update user info in sidebar if it exists
            const userNameElements = document.querySelectorAll('.settings-profile h5')
            if (userNameElements.length > 0 && data.firstName && data.lastName) {
              userNameElements[0].textContent = `${data.firstName} ${data.lastName}`
            }
            
            const companyElements = document.querySelectorAll('.settings-profile p.text-muted')
            if (companyElements.length > 0 && data.companyName) {
              companyElements[0].textContent = data.companyName
            }

            // Show success notification - use a flag to prevent multiple notifications
            // Only show if there were actual changes saved
            if (!skipNotification && typeof window.showNotification === 'function' && !window.profileSaveNotified) {
              // Check if actual data was saved (not just empty values)
              const savedData = result.data
              const hasActualData = savedData && (
                savedData.first_name || savedData.last_name || savedData.company_name || 
                savedData.email || savedData.phone || savedData.street || 
                savedData.postal_code || savedData.city || savedData.country
              )
              
              if (hasActualData) {
                window.profileSaveNotified = true
                window.showNotification('Gegevens opgeslagen', 'success', 3000)
                // Reset flag after notification duration
                setTimeout(() => {
                  window.profileSaveNotified = false
                }, 3000)
              }
            }
          } else {
            const errorMsg = result?.message || result?.error || 'Fout bij opslaan van profiel'
            
            if (typeof window.showNotification === 'function') {
              window.showNotification(errorMsg, 'error', 5000)
            }
          }
        } catch (error) {
          
          if (typeof window.showNotification === 'function') {
            window.showNotification('Er is een fout opgetreden bij het opslaan', 'error', 5000)
          }
        } finally {
          saveInProgress = false
        }
      }
      
      // Make saveProfile globally accessible for Google Places handlers
      window.saveProfileNow = saveProfile

      // Prevent default form submission
      profileForm.addEventListener("submit", function (event) {
        event.preventDefault()
        return false
      })

      // Track if user is navigating away (clicking on tab links)
      // Use mouseenter/mousedown because blur fires after mousedown but we need early detection
      let isNavigatingAway = false
      let navigationTimeout = null
      
      const navLinks = document.querySelectorAll('.settings-nav a, a[href*="/settings/"]')
      navLinks.forEach(link => {
        // Set flag when mouse enters the link area (even before click)
        link.addEventListener('mouseenter', () => {
          // Clear any existing timeout
          if (navigationTimeout) {
            clearTimeout(navigationTimeout)
          }
          // Set flag immediately when mouse enters link
          isNavigatingAway = true
        })
        
        // Set flag on mousedown (before blur fires, but after mouseenter)
        link.addEventListener('mousedown', (e) => {
          isNavigatingAway = true
        })
        
        // Also set on click as backup
        link.addEventListener('click', () => {
          isNavigatingAway = true
        })
        
        // Reset flag if user moves away from link without clicking
        link.addEventListener('mouseleave', () => {
          // Only reset if navigation didn't happen (give it a moment to check)
          navigationTimeout = setTimeout(() => {
            // Check if we actually navigated by checking if page is still the same
            const currentUrl = window.location.pathname
            const linkHref = link.getAttribute('href')
            if (!currentUrl.includes(linkHref.split('/').pop())) {
              isNavigatingAway = false
            }
          }, 300)
        })
      })
      
      // Also listen for beforeunload/unload to reset flag
      window.addEventListener('beforeunload', () => {
        isNavigatingAway = true
      })

      // Initialize lastSavedData with current form values to avoid first-blur saves
      try {
        const addressField = document.getElementById('address')
        const postalCodeField = document.getElementById('postalCode')
        const cityField = document.getElementById('city')
        const initialProfileData = {
          firstName: document.getElementById('firstName')?.value?.trim() || null,
          lastName: document.getElementById('lastName')?.value?.trim() || null,
          companyName: document.getElementById('companyName')?.value?.trim() || null,
          email: document.getElementById('email')?.value?.trim() || null,
          phone: document.getElementById('phone')?.value?.trim() || null,
          address: addressField?.value?.trim() || null,
          postalCode: postalCodeField?.value?.trim() || null,
          city: cityField?.value?.trim() || null,
          country: document.getElementById('country')?.value || null
        }
        lastSavedData = JSON.stringify(initialProfileData)
      } catch (e) {
      }

      // Auto-save on blur/change for all fields (NOT on input while typing)
      const inputs = profileForm.querySelectorAll('input:not([type="file"]), select, textarea')
      
      inputs.forEach(input => {
        // DON'T save on input while typing - only save when user leaves field or selects from dropdown
        // This prevents saving incomplete data like "pannen" instead of "Pannenschuurlaan"
        
        // Track original value on focus
        input.addEventListener('focus', () => {
          input.dataset.initialValue = (input.value ?? '')
        })

        // Save on change (for selects and dropdowns)
        if (input.tagName === 'SELECT') {
          input.addEventListener('change', () => {
            if (isNavigatingAway) {
              return
            }
            clearTimeout(saveTimeout)
            saveProfile()
          })
        }

        // Save on blur (when user leaves field) - immediate save
        // Skip if Google Places autocomplete is in progress or user is navigating away
        input.addEventListener('blur', (e) => {
          // Skip if value didn't change at all
          const initialValue = input.dataset.initialValue ?? ''
          const currentValue = input.value ?? ''
          if (currentValue === initialValue) {
            return
          }
          if (window.skipBlurSave) {
            return
          }
          
          // Early return if navigating away
          if (isNavigatingAway) {
            return
          }
          
          // Check if the relatedTarget (element gaining focus) is a navigation link
          const relatedTarget = e.relatedTarget
          if (relatedTarget) {
            const linkElement = relatedTarget.tagName === 'A' ? relatedTarget : relatedTarget.closest('a')
            if (linkElement) {
              const href = linkElement.href || linkElement.getAttribute('href')
              if (href && (href.includes('/settings/') || linkElement.closest('.settings-nav'))) {
                return
              }
            }
          }
          
          // Check if any navigation link is currently being hovered
          const hoveredLink = document.querySelector('.settings-nav a:hover, a[href*="/settings/"]:hover')
          if (hoveredLink) {
            return
          }
          
          clearTimeout(saveTimeout)
          // Small delay to ensure Google Places autocomplete can complete if user clicked a suggestion
          setTimeout(() => {
            // Triple-check we're still not navigating and page hasn't changed
            if (!isNavigatingAway && document.body && profileForm.parentElement) {
              saveProfile()
            } else {
            }
          }, 200)
        })
      })
      
    }

    // Billing form auto-save
    const billingForm = document.querySelector('form[action="/dashboard/settings/billing"]')
    if (billingForm) {
      let saveInProgress = false
      let saveTimeout = null
      let lastSavedData = null

      // Validation functions for BTW/VAT and KVK numbers
      function validateVATNumber(vatNumber, country) {
        if (!vatNumber || vatNumber.trim() === '') {
          return { valid: true, message: '' } // Empty is valid (optional field)
        }

        const cleanVAT = vatNumber.replace(/\s+/g, '').toUpperCase()

        switch (country) {
          case 'NL': // Netherlands: NL123456789B01
            if (/^NL\d{9}B\d{2}$/.test(cleanVAT)) {
              return { valid: true, message: '' }
            }
            return { valid: false, message: 'Ongeldig BTW-nummer formaat. Gebruik: NL123456789B01' }

          case 'BE': // Belgium: BE0123456789
            if (/^BE\d{10}$/.test(cleanVAT)) {
              return { valid: true, message: '' }
            }
            return { valid: false, message: 'Ongeldig BTW-nummer formaat. Gebruik: BE0123456789' }

          case 'DE': // Germany: DE123456789
            if (/^DE\d{9}$/.test(cleanVAT)) {
              return { valid: true, message: '' }
            }
            return { valid: false, message: 'Ongeldig BTW-nummer formaat. Gebruik: DE123456789' }

          case 'FR': // France: FR12345678901
            if (/^FR[A-HJ-NP-Z0-9]{2}\d{9}$/.test(cleanVAT)) {
              return { valid: true, message: '' }
            }
            return { valid: false, message: 'Ongeldig BTW-nummer formaat. Gebruik: FR12345678901' }

          default:
            return { valid: true, message: '' }
        }
      }

      function validateKVKNumber(kvkNumber, country) {
        if (!kvkNumber || kvkNumber.trim() === '') {
          return { valid: true, message: '' } // Empty is valid (optional field)
        }

        const cleanKVK = kvkNumber.replace(/\s+/g, '').replace(/\./g, '').replace(/-/g, '')

        switch (country) {
          case 'NL': // Netherlands: 8 digits
            if (/^\d{8}$/.test(cleanKVK)) {
              return { valid: true, message: '' }
            }
            return { valid: false, message: 'Ongeldig KVK-nummer. Moet 8 cijfers zijn (bijv. 12345678)' }

          case 'BE': // Belgium: 10 digits
            if (/^\d{10}$/.test(cleanKVK)) {
              return { valid: true, message: '' }
            }
            return { valid: false, message: 'Ongeldig ondernemingsnummer. Moet 10 cijfers zijn' }

          case 'DE': // Germany: HRB followed by numbers
            if (/^HRB\d{1,6}$/.test(cleanKVK)) {
              return { valid: true, message: '' }
            }
            return { valid: false, message: 'Ongeldig Handelsregisternummer. Gebruik: HRB123456' }

          case 'FR': // France: 9 digits (SIREN)
            if (/^\d{9}$/.test(cleanKVK)) {
              return { valid: true, message: '' }
            }
            return { valid: false, message: 'Ongeldig SIREN-nummer. Moet 9 cijfers zijn' }

          default:
            return { valid: true, message: '' }
        }
      }

      // Update validation messages
      function updateValidationMessages() {
        const country = document.getElementById('billingCountry')?.value || 'NL'
        const vatNumber = document.getElementById('vatNumber')?.value || ''
        const kvkNumber = document.getElementById('chamberOfCommerce')?.value || ''
        const vatHelp = document.getElementById('vatNumberHelp')
        const cocHelp = document.getElementById('cocNumberHelp')

        const vatValidation = validateVATNumber(vatNumber, country)
        const kvkValidation = validateKVKNumber(kvkNumber, country)

        if (vatHelp) {
          if (vatNumber && !vatValidation.valid) {
            vatHelp.textContent = vatValidation.message
            vatHelp.style.color = '#dc2626'
            document.getElementById('vatNumber')?.classList.add('is-invalid')
            document.getElementById('vatNumber')?.classList.remove('is-valid')
          } else if (vatNumber && vatValidation.valid) {
            vatHelp.textContent = 'Geldig BTW-nummer'
            vatHelp.style.color = '#16a34a'
            document.getElementById('vatNumber')?.classList.add('is-valid')
            document.getElementById('vatNumber')?.classList.remove('is-invalid')
          } else {
            vatHelp.textContent = ''
            document.getElementById('vatNumber')?.classList.remove('is-valid', 'is-invalid')
          }
        }

        if (cocHelp) {
          if (kvkNumber && !kvkValidation.valid) {
            cocHelp.textContent = kvkValidation.message
            cocHelp.style.color = '#dc2626'
            document.getElementById('chamberOfCommerce')?.classList.add('is-invalid')
            document.getElementById('chamberOfCommerce')?.classList.remove('is-valid')
          } else if (kvkNumber && kvkValidation.valid) {
            cocHelp.textContent = 'Geldig KVK-nummer'
            cocHelp.style.color = '#16a34a'
            document.getElementById('chamberOfCommerce')?.classList.add('is-valid')
            document.getElementById('chamberOfCommerce')?.classList.remove('is-invalid')
          } else {
            cocHelp.textContent = ''
            document.getElementById('chamberOfCommerce')?.classList.remove('is-valid', 'is-invalid')
          }
        }
      }

      // Functie om factuurgegevens op te slaan via AJAX
      const saveBilling = async () => {
        if (saveInProgress) {
          return
        }

        // Verzamel form data
        const country = document.getElementById('billingCountry')?.value || 'NL'
          const data = {
          billingCompanyName: document.getElementById('billingCompanyName')?.value?.trim() || null,
          billingAddress: document.getElementById('billingAddress')?.value?.trim() || null,
          billingPostalCode: document.getElementById('billingPostalCode')?.value?.trim() || null,
          billingCity: document.getElementById('billingCity')?.value?.trim() || null,
          billingCountry: country,
          vatNumber: document.getElementById('vatNumber')?.value?.trim() || null,
          chamberOfCommerce: document.getElementById('chamberOfCommerce')?.value?.trim() || null
        }

        // Check if there are actual meaningful changes (not just empty to empty)
        const hasChanges = data.billingCompanyName || data.billingAddress || 
                          data.billingPostalCode || data.billingCity || data.billingCountry ||
                          data.vatNumber || data.chamberOfCommerce
        
        if (!hasChanges) {
          // Update lastSavedData to prevent false change detection later
          lastSavedData = JSON.stringify(data)
          return
        }
        
        // Check if data actually changed
        const dataString = JSON.stringify(data)
        if (dataString === lastSavedData) {
          return
        }

        // Validatie
        if (!data.billingCompanyName) {
          // Don't show error for empty fields while user is typing
          return
        }

        // Validate VAT and KVK numbers
        const vatValidation = validateVATNumber(data.vatNumber, country)
        const kvkValidation = validateKVKNumber(data.chamberOfCommerce, country)

        if (data.vatNumber && !vatValidation.valid) {
          updateValidationMessages()
          if (typeof window.showNotification === 'function') {
            window.showNotification(vatValidation.message, 'error', 5000)
          }
          return
        }

        if (data.chamberOfCommerce && !kvkValidation.valid) {
          updateValidationMessages()
          if (typeof window.showNotification === 'function') {
            window.showNotification(kvkValidation.message, 'error', 5000)
          }
          return
        }

        saveInProgress = true

        try {

          const response = await fetch('/dashboard/settings/billing', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          })


          let result
          try {
            result = await response.json()
          } catch (parseError) {
            const text = await response.text()
            throw new Error('Invalid server response')
          }

          if (response.ok && result.success) {
            lastSavedData = dataString
            updateValidationMessages()
            
            // Log what was actually saved according to server
            if (result.data) {
              // Data saved successfully
            }

            // Show success notification - only if actual data was saved
            if (typeof window.showNotification === 'function') {
              const savedData = result.data
              const hasActualData = savedData && (
                savedData.billing_company_name || savedData.billing_address ||
                savedData.billing_postal_code || savedData.billing_city || savedData.billing_country ||
                savedData.vat_number || savedData.coc_number
              )
              
              if (hasActualData) {
                window.showNotification('Gegevens bijgewerkt', 'success', 3000)
              }
            }
          } else {
            let errorMsg = result?.message || result?.error || 'Fout bij opslaan van factuurgegevens'
            
            // Provide more specific error message for validation errors
            if (result?.errorCode || result?.error) {
              if (result.error.includes('coc_number') || result.error.includes('chamber_of_commerce')) {
                errorMsg = 'Fout bij opslaan van KVK-nummer. Controleer het formaat.'
              } else if (result.error.includes('vat_number')) {
                errorMsg = 'Fout bij opslaan van BTW-nummer. Controleer het formaat.'
              }
            }
            
            if (typeof window.showNotification === 'function') {
              window.showNotification(errorMsg, 'error', 5000)
            }
          }
        } catch (error) {
          
          if (typeof window.showNotification === 'function') {
            window.showNotification('Er is een fout opgetreden bij het opslaan', 'error', 5000)
          }
        } finally {
          saveInProgress = false
        }
      }

      // Prevent default form submission
      billingForm.addEventListener("submit", function (event) {
        event.preventDefault()
        return false
      })

      // Initialize lastSavedData with current form values to avoid first-blur saves
      try {
        const initialBillingData = {
          billingCompanyName: document.getElementById('billingCompanyName')?.value?.trim() || null,
          billingAddress: document.getElementById('billingAddress')?.value?.trim() || null,
          billingPostalCode: document.getElementById('billingPostalCode')?.value?.trim() || null,
          billingCity: document.getElementById('billingCity')?.value?.trim() || null,
          billingCountry: document.getElementById('billingCountry')?.value || 'NL',
          vatNumber: document.getElementById('vatNumber')?.value?.trim() || null,
          chamberOfCommerce: document.getElementById('chamberOfCommerce')?.value?.trim() || null
        }
        lastSavedData = JSON.stringify(initialBillingData)
      } catch (e) {
      }

      // Track if user is navigating away (clicking on tab links)
      // Use mouseenter/mousedown because blur fires after mousedown but we need early detection
      let isNavigatingAway = false
      let navigationTimeout = null
      
      const navLinks = document.querySelectorAll('.settings-nav a, a[href*="/settings/"]')
      navLinks.forEach(link => {
        // Set flag when mouse enters the link area (even before click)
        link.addEventListener('mouseenter', () => {
          // Clear any existing timeout
          if (navigationTimeout) {
            clearTimeout(navigationTimeout)
          }
          // Set flag immediately when mouse enters link
          isNavigatingAway = true
        })
        
        // Set flag on mousedown (before blur fires, but after mouseenter)
        link.addEventListener('mousedown', (e) => {
          isNavigatingAway = true
        })
        
        // Also set on click as backup
        link.addEventListener('click', () => {
          isNavigatingAway = true
        })
        
        // Reset flag if user moves away from link without clicking
        link.addEventListener('mouseleave', () => {
          // Only reset if navigation didn't happen (give it a moment to check)
          navigationTimeout = setTimeout(() => {
            // Check if we actually navigated by checking if page is still the same
            const currentUrl = window.location.pathname
            const linkHref = link.getAttribute('href')
            if (!currentUrl.includes(linkHref.split('/').pop())) {
              isNavigatingAway = false
            }
          }, 300)
        })
      })
      
      // Also listen for beforeunload/unload to reset flag
      window.addEventListener('beforeunload', () => {
        isNavigatingAway = true
      })

      // Auto-save on blur/change for all fields (NOT on input while typing)
      const inputs = billingForm.querySelectorAll('input, select, textarea')
      
      inputs.forEach(input => {
        // Track original value on focus
        input.addEventListener('focus', () => {
          input.dataset.initialValue = (input.value ?? '')
        })

        // Only validate on input for VAT/KVK (but don't save yet)
        if (input.id === 'vatNumber' || input.id === 'chamberOfCommerce') {
          input.addEventListener('input', () => {
            updateValidationMessages()
          })
        }
        
        // Save on change (for selects and dropdowns)
        if (input.tagName === 'SELECT') {
          input.addEventListener('change', () => {
            if (isNavigatingAway) {
              return
            }
            if (input.id === 'billingCountry') {
              updateValidationMessages() // Re-validate when country changes
            }
            clearTimeout(saveTimeout)
            saveBilling()
          })
        }

        // Save on blur (when user leaves field) - this is the main save trigger
        // DON'T save while typing - only save when user leaves the field
        input.addEventListener('blur', (e) => {
          // Skip if value didn't change at all
          const initialValue = input.dataset.initialValue ?? ''
          const currentValue = input.value ?? ''
          if (currentValue === initialValue) {
            return
          }
          if (window.skipBlurSave) {
            return
          }
          
          // Early return if navigating away
          if (isNavigatingAway) {
            return
          }
          
          // Check if the relatedTarget (element gaining focus) is a navigation link
          const relatedTarget = e.relatedTarget
          if (relatedTarget) {
            const linkElement = relatedTarget.tagName === 'A' ? relatedTarget : relatedTarget.closest('a')
            if (linkElement) {
              const href = linkElement.href || linkElement.getAttribute('href')
              if (href && (href.includes('/settings/') || linkElement.closest('.settings-nav'))) {
                return
              }
            }
          }
          
          // Check if any navigation link is currently being hovered
          const hoveredLink = document.querySelector('.settings-nav a:hover, a[href*="/settings/"]:hover')
          if (hoveredLink) {
            return
          }
          
          if (input.id === 'vatNumber' || input.id === 'chamberOfCommerce') {
            updateValidationMessages()
          }
          clearTimeout(saveTimeout)
          // Small delay to ensure Google Places autocomplete can complete if user clicked a suggestion
          setTimeout(() => {
            // Triple-check we're still not navigating and page hasn't changed
            if (!isNavigatingAway && document.body && billingForm.parentElement) {
              saveBilling()
            } else {
            }
          }, 200)
        })
      })
      
    }

    // Notificatie geluid toggle
    let notificationSoundToggle = document.getElementById("notificationSoundEnabled")
    if (notificationSoundToggle) {
      // Stel de initiële status in op basis van localStorage
      const isMuted = localStorage.getItem("notificationSoundMuted") === "true"
      notificationSoundToggle.checked = !isMuted

      // Update de toggle label
      const toggleLabel = notificationSoundToggle.closest(".toggle-switch-wrapper")?.querySelector(".toggle-label")
      if (toggleLabel) {
        toggleLabel.textContent = isMuted ? "Uit" : "Aan"
      }

      // Voeg event listener toe voor wijzigingen
      notificationSoundToggle.addEventListener("change", function () {
        const muted = !this.checked
        window.toggleNotificationSound(muted)

        // Update de toggle label
        if (toggleLabel) {
          toggleLabel.textContent = muted ? "Uit" : "Aan"
        }

        // Toon een bevestigingsnotificatie (zonder geluid)
        const message = muted ? "Notificatiegeluiden zijn uitgeschakeld" : "Notificatiegeluiden zijn ingeschakeld"
        window.showNotification(message, "info", 3000, false)
      })
    }

    // Save settings button
    const saveSettingsBtn = document.getElementById("saveSettingsBtn")

    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener("click", () => {
        // Verzamel alle instellingen
        const settings = {}

        // Notificatiegeluid instelling
        const notificationSoundEnabled = document.getElementById("notificationSoundEnabled")
        if (notificationSoundEnabled) {
          const isMuted = !notificationSoundEnabled.checked
          localStorage.setItem("notificationSoundMuted", isMuted.toString())
          settings.notificationSoundEnabled = !isMuted
        }

        // Hier zouden we normaal gesproken een AJAX-verzoek sturen om de instellingen op te slaan
        // Voor nu tonen we gewoon een succesmelding
        window.showNotification("Instellingen succesvol opgeslagen!", "success")

        // Toon een bevestiging over de notificatiegeluid-instelling
        if (notificationSoundEnabled) {
          const status = notificationSoundEnabled.checked ? "ingeschakeld" : "uitgeschakeld"
          window.showNotification(`Notificatiegeluiden zijn ${status}`, "info", 3000, notificationSoundEnabled.checked)
        }
      })
    }

    // Notificatie geluid toggle - vervang de bestaande code voor deze toggle
    notificationSoundToggle = document.getElementById("notificationSoundEnabled")
    if (notificationSoundToggle) {
      // Stel de initiële status in op basis van localStorage
      const isMuted = localStorage.getItem("notificationSoundMuted") === "true"
      notificationSoundToggle.checked = !isMuted

      // Update de toggle label
      const toggleLabel = notificationSoundToggle.closest(".toggle-switch-wrapper")?.querySelector(".toggle-label")
      if (toggleLabel) {
        toggleLabel.textContent = isMuted ? "Uit" : "Aan"
      }

      // Voeg event listener toe voor wijzigingen
      notificationSoundToggle.addEventListener("change", function () {
        // We slaan de instelling nog niet op, dat gebeurt pas bij het klikken op "Opslaan"
        // We updaten alleen de UI
        const muted = !this.checked

        // Update de toggle label
        if (toggleLabel) {
          toggleLabel.textContent = muted ? "Uit" : "Aan"
        }
      })
    }

    // Helper functie voor notificaties
    window.showNotification = (message, type, duration = 3000, sound = true) => {
      // Maak een notificatie
      const notification = document.createElement("div")
      notification.className = `notification ${type}`
      
      // Bepaal het juiste icoon op basis van het type
      let icon = "info-circle"
      if (type === "success") icon = "check-circle"
      if (type === "error") icon = "exclamation-circle"
      if (type === "warning") icon = "exclamation-triangle"
      
      // Vul de notificatie
      notification.innerHTML = `
        <div class="notification-content">
          <i class="fas fa-${icon}"></i>
          <span>${message}</span>
        </div>
        <button class="notification-close">
          <i class="fas fa-times"></i>
        </button>
        <div class="notification-progress"></div>
      `
      
      // Zoek de container
      let container = document.querySelector(".notification-container")
      if (!container) {
        container = document.createElement("div")
        container.className = "notification-container"
        document.body.appendChild(container)
      }
      
      // Voeg de notificatie toe aan de container
      container.appendChild(notification)
      
      // Voeg event listener toe voor het sluiten
      const closeBtn = notification.querySelector(".notification-close")
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          notification.classList.add("closing")
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification)
            }
          }, 300)
        })
      }
      
      // Voeg progress bar animatie toe
      if (duration > 0) {
        const progressBar = notification.querySelector(".notification-progress")
        if (progressBar) {
          progressBar.style.animation = `progressShrink ${duration}ms linear forwards`
          
          // Sluit de notificatie automatisch na de opgegeven tijd
          setTimeout(() => {
            notification.classList.add("closing")
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification)
              }
            }, 300)
          }, duration)
        }
      }
      
      // Speel geluid af als dit is ingeschakeld
      if (sound && !isNotificationSoundMuted()) {
        playNotificationSound(type)
      }
      
      return notification
    }

    // Initialize Google Maps Address Autocomplete only if API key is available
    // Note: Function is defined below, callback will handle initialization
  }

  // Google Maps Address Autocomplete initialization - using new PlaceAutocompleteElement  
  // Define it so it's available when called
  window.initializeAddressAutocomplete = async function initializeAddressAutocomplete() {
    // Prevent multiple initializations
    if (window.autocompleteInitialized) {
      return
    }

    // Check if API key is available
    if (!window.GOOGLE_MAPS_API_KEY || window.GOOGLE_MAPS_API_KEY === '') {
      return
    }

    // Wait for Google Maps API to load
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
      // Retry after a short delay
      setTimeout(window.initializeAddressAutocomplete, 100)
      return
    }

    // Check if any address fields exist (profile or billing)
    const addressInput = document.getElementById('address')
    const billingAddressInput = document.getElementById('billingAddress')
    
    // If neither address field exists, skip initialization
    if (!addressInput && !billingAddressInput) {
      return
    }

    try {
      // Check if places is already loaded, otherwise import it
      if (typeof google.maps.places === 'undefined') {
      await google.maps.importLibrary('places')
      }

      
      // Mark as initialized
      window.autocompleteInitialized = true

      // For now, use the old Autocomplete API which is more reliable
      // The new PlaceAutocompleteElement has compatibility issues
      if (typeof google.maps.places.Autocomplete !== 'undefined') {
        
        // Initialize profile address autocomplete if field exists
        if (addressInput) {
        try {
          // Use the reliable old Autocomplete API
          const autocomplete = new google.maps.places.Autocomplete(addressInput, {
            componentRestrictions: { country: ['nl', 'be', 'de', 'fr'] },
            fields: ['address_components', 'formatted_address'],
            types: ['address']
          })

          // Add error listener to catch API errors
          google.maps.event.addListener(autocomplete, 'error', function(error) {
            if (error === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            } else if (error === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
              alert('Google Maps API error: Please check API key configuration. Both Maps JavaScript API and Places API must be enabled.')
            }
          })

        // Handle place selection
        autocomplete.addListener('place_changed', function() {
          const place = autocomplete.getPlace()
          
          if (!place.address_components) {
            return
          }

          // Get related input fields
          const postalCodeInput = document.getElementById('postalCode')
          const cityInput = document.getElementById('city')
          const countryInput = document.getElementById('country')

          // Parse address components
          let streetNumber = ''
          let route = ''
          let postalCode = ''
          let city = ''
          let country = 'NL'

          place.address_components.forEach(component => {
            const types = component.types

            if (types.includes('street_number')) {
              streetNumber = component.long_name
            }
            if (types.includes('route')) {
              route = component.long_name
            }
            if (types.includes('postal_code')) {
              postalCode = component.long_name
            }
            if (types.includes('locality') || types.includes('administrative_area_level_2')) {
              city = component.long_name
            }
            if (types.includes('country')) {
              const countryCode = component.short_name.toUpperCase()
              // Map country codes
              if (countryCode === 'NL') country = 'NL'
              else if (countryCode === 'BE') country = 'BE'
              else if (countryCode === 'DE') country = 'DE'
              else if (countryCode === 'FR') country = 'FR'
            }
          })

          // Update address field with full address
          if (streetNumber && route) {
            addressInput.value = `${route} ${streetNumber}`
          } else if (route) {
            addressInput.value = route
          } else {
            addressInput.value = place.formatted_address
          }

          // Update postal code, city, and country fields
          if (postalCodeInput && postalCode) {
            postalCodeInput.value = postalCode
          }
          
          if (cityInput && city) {
            cityInput.value = city
          }
          
          if (countryInput && country) {
            countryInput.value = country
          }

          
          // Trigger save after Google Places autocomplete fills the fields
          // Use setTimeout to ensure all fields are updated before saving
          setTimeout(() => {
            // Directly call saveProfile if it exists
            if (typeof window.saveProfileNow === 'function') {
              // Temporarily disable blur listeners to prevent duplicate saves
              window.skipBlurSave = true
              window.saveProfileNow()
              setTimeout(() => {
                window.skipBlurSave = false
              }, 500)
            }
          }, 400)
        })

          } catch (addressError) {
          }
        }

        // Initialize autocomplete for profile postal code field if it exists
        const postalCodeInput = document.getElementById('postalCode')
        if (postalCodeInput && typeof google.maps.places.Autocomplete !== 'undefined') {
          try {
            const postalCodeAutocomplete = new google.maps.places.Autocomplete(postalCodeInput, {
              componentRestrictions: { country: ['nl', 'be', 'de', 'fr'] },
              fields: ['address_components', 'formatted_address'],
              types: ['postal_code']
            })

            postalCodeAutocomplete.addListener('place_changed', function() {
              const place = postalCodeAutocomplete.getPlace()
              
              if (!place.address_components) {
                return
              }

              const cityInput = document.getElementById('city')
              const countryInput = document.getElementById('country')
              let city = ''
              let country = 'NL'

              place.address_components.forEach(component => {
                const types = component.types

                if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                  city = component.long_name
                }
                if (types.includes('country')) {
                  const countryCode = component.short_name.toUpperCase()
                  if (countryCode === 'NL') country = 'NL'
                  else if (countryCode === 'BE') country = 'BE'
                  else if (countryCode === 'DE') country = 'DE'
                  else if (countryCode === 'FR') country = 'FR'
                }
                if (types.includes('postal_code')) {
                  postalCodeInput.value = component.long_name
                }
              })

              if (cityInput && city) {
                cityInput.value = city
              }
              
              if (countryInput && country) {
                countryInput.value = country
              }

              
              // Trigger save after postal code autocomplete
              setTimeout(() => {
                if (typeof window.saveProfileNow === 'function') {
                  window.skipBlurSave = true
                  window.saveProfileNow()
                  setTimeout(() => {
                    window.skipBlurSave = false
                  }, 500)
                }
              }, 400)
            })

          } catch (postalError) {
          }
        }

        // Initialize autocomplete for city field immediately
        const cityInput = document.getElementById('city')
        if (cityInput && typeof google.maps.places.Autocomplete !== 'undefined') {
          try {
            const cityAutocomplete = new google.maps.places.Autocomplete(cityInput, {
              componentRestrictions: { country: ['nl', 'be', 'de', 'fr'] },
              fields: ['address_components', 'formatted_address'],
              types: ['(cities)']
            })

            cityAutocomplete.addListener('place_changed', function() {
              const place = cityAutocomplete.getPlace()
              
              if (!place.address_components) {
                return
              }

              const postalCodeInput = document.getElementById('postalCode')
              const countryInput = document.getElementById('country')
              let postalCode = ''
              let country = 'NL'

              place.address_components.forEach(component => {
                const types = component.types

                if (types.includes('postal_code')) {
                  postalCode = component.long_name
                }
                if (types.includes('country')) {
                  const countryCode = component.short_name.toUpperCase()
                  if (countryCode === 'NL') country = 'NL'
                  else if (countryCode === 'BE') country = 'BE'
                  else if (countryCode === 'DE') country = 'DE'
                  else if (countryCode === 'FR') country = 'FR'
                }
                if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                  cityInput.value = component.long_name
                }
              })

              if (postalCodeInput && postalCode) {
                postalCodeInput.value = postalCode
              }
              
              if (countryInput && country) {
                countryInput.value = country
              }

              
              // Trigger save after city autocomplete
              setTimeout(() => {
                if (typeof window.saveProfileNow === 'function') {
                  window.skipBlurSave = true
                  window.saveProfileNow()
                  setTimeout(() => {
                    window.skipBlurSave = false
                  }, 500)
                }
              }, 400)
            })

          } catch (cityError) {
          }
        }

        // Initialize billing address autocomplete
        const billingAddressInput = document.getElementById('billingAddress')
        if (billingAddressInput && typeof google.maps.places.Autocomplete !== 'undefined') {
          try {
            const billingAutocomplete = new google.maps.places.Autocomplete(billingAddressInput, {
              componentRestrictions: { country: ['nl', 'be', 'de', 'fr'] },
              fields: ['address_components', 'formatted_address'],
              types: ['address']
            })

            billingAutocomplete.addListener('place_changed', function() {
              const place = billingAutocomplete.getPlace()
              
              if (!place.address_components) {
                return
              }

              const billingPostalCodeInput = document.getElementById('billingPostalCode')
              const billingCityInput = document.getElementById('billingCity')
              const billingCountryInput = document.getElementById('billingCountry')

              let streetNumber = ''
              let route = ''
              let postalCode = ''
              let city = ''
              let country = 'NL'

              place.address_components.forEach(component => {
                const types = component.types

                if (types.includes('street_number')) {
                  streetNumber = component.long_name
                }
                if (types.includes('route')) {
                  route = component.long_name
                }
                if (types.includes('postal_code')) {
                  postalCode = component.long_name
                }
                if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                  city = component.long_name
                }
                if (types.includes('country')) {
                  const countryCode = component.short_name.toUpperCase()
                  if (countryCode === 'NL') country = 'NL'
                  else if (countryCode === 'BE') country = 'BE'
                  else if (countryCode === 'DE') country = 'DE'
                  else if (countryCode === 'FR') country = 'FR'
                }
              })

              if (streetNumber && route) {
                billingAddressInput.value = `${route} ${streetNumber}`
              } else if (route) {
                billingAddressInput.value = route
              } else {
                billingAddressInput.value = place.formatted_address
              }

              if (billingPostalCodeInput && postalCode) {
                billingPostalCodeInput.value = postalCode
              }
              
              if (billingCityInput && city) {
                billingCityInput.value = city
              }
              
              if (billingCountryInput && country) {
                billingCountryInput.value = country
              }

              
              // Trigger save after billing address autocomplete
              setTimeout(() => {
                const billingForm = document.querySelector('form[action="/dashboard/settings/billing"]')
                if (billingForm) {
                  if (billingPostalCodeInput) billingPostalCodeInput.dispatchEvent(new Event('input', { bubbles: true }))
                  if (billingCityInput) billingCityInput.dispatchEvent(new Event('input', { bubbles: true }))
                  if (billingCountryInput) billingCountryInput.dispatchEvent(new Event('change', { bubbles: true }))
                  setTimeout(() => {
                    if (billingPostalCodeInput) billingPostalCodeInput.dispatchEvent(new Event('blur', { bubbles: true }))
                    if (billingCityInput) billingCityInput.dispatchEvent(new Event('blur', { bubbles: true }))
                  }, 100)
                }
              }, 200)
            })

          } catch (billingAddressError) {
          }
        }

        // Initialize billing postal code autocomplete
        const billingPostalCodeInput = document.getElementById('billingPostalCode')
        if (billingPostalCodeInput && typeof google.maps.places.Autocomplete !== 'undefined') {
          try {
            const billingPostalCodeAutocomplete = new google.maps.places.Autocomplete(billingPostalCodeInput, {
              componentRestrictions: { country: ['nl', 'be', 'de', 'fr'] },
              fields: ['address_components', 'formatted_address'],
              types: ['postal_code']
            })

            billingPostalCodeAutocomplete.addListener('place_changed', function() {
              const place = billingPostalCodeAutocomplete.getPlace()
              
              if (!place.address_components) {
                return
              }

              const billingCityInput = document.getElementById('billingCity')
              const billingCountryInput = document.getElementById('billingCountry')
              let city = ''
              let country = 'NL'

              place.address_components.forEach(component => {
                const types = component.types

                if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                  city = component.long_name
                }
                if (types.includes('country')) {
                  const countryCode = component.short_name.toUpperCase()
                  if (countryCode === 'NL') country = 'NL'
                  else if (countryCode === 'BE') country = 'BE'
                  else if (countryCode === 'DE') country = 'DE'
                  else if (countryCode === 'FR') country = 'FR'
                }
                if (types.includes('postal_code')) {
                  billingPostalCodeInput.value = component.long_name
                }
              })

              if (billingCityInput && city) {
                billingCityInput.value = city
              }
              
              if (billingCountryInput && country) {
                billingCountryInput.value = country
              }

              
              // Trigger save after billing postal code autocomplete
              setTimeout(() => {
                const billingForm = document.querySelector('form[action="/dashboard/settings/billing"]')
                if (billingForm) {
                  if (billingCityInput) billingCityInput.dispatchEvent(new Event('input', { bubbles: true }))
                  if (billingCountryInput) billingCountryInput.dispatchEvent(new Event('change', { bubbles: true }))
                  setTimeout(() => {
                    if (billingCityInput) billingCityInput.dispatchEvent(new Event('blur', { bubbles: true }))
                  }, 100)
                }
              }, 200)
            })

          } catch (billingPostalError) {
          }
        }

        // Initialize billing city autocomplete
        const billingCityInput = document.getElementById('billingCity')
        if (billingCityInput && typeof google.maps.places.Autocomplete !== 'undefined') {
          try {
            const billingCityAutocomplete = new google.maps.places.Autocomplete(billingCityInput, {
              componentRestrictions: { country: ['nl', 'be', 'de', 'fr'] },
              fields: ['address_components', 'formatted_address'],
              types: ['(cities)']
            })

            billingCityAutocomplete.addListener('place_changed', function() {
              const place = billingCityAutocomplete.getPlace()
              
              if (!place.address_components) {
                return
              }

              const billingPostalCodeInput = document.getElementById('billingPostalCode')
              const billingCountryInput = document.getElementById('billingCountry')
              let postalCode = ''
              let country = 'NL'

              place.address_components.forEach(component => {
                const types = component.types

                if (types.includes('postal_code')) {
                  postalCode = component.long_name
                }
                if (types.includes('country')) {
                  const countryCode = component.short_name.toUpperCase()
                  if (countryCode === 'NL') country = 'NL'
                  else if (countryCode === 'BE') country = 'BE'
                  else if (countryCode === 'DE') country = 'DE'
                  else if (countryCode === 'FR') country = 'FR'
                }
                if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                  billingCityInput.value = component.long_name
                }
              })

              if (billingPostalCodeInput && postalCode) {
                billingPostalCodeInput.value = postalCode
              }
              
              if (billingCountryInput && country) {
                billingCountryInput.value = country
              }

              
              // Trigger save after billing city autocomplete
              setTimeout(() => {
                const billingForm = document.querySelector('form[action="/dashboard/settings/billing"]')
                if (billingForm) {
                  if (billingPostalCodeInput) billingPostalCodeInput.dispatchEvent(new Event('input', { bubbles: true }))
                  if (billingCountryInput) billingCountryInput.dispatchEvent(new Event('change', { bubbles: true }))
                  setTimeout(() => {
                    if (billingPostalCodeInput) billingPostalCodeInput.dispatchEvent(new Event('blur', { bubbles: true }))
                  }, 100)
                }
              }, 200)
            })

          } catch (billingCityError) {
          }
        }
      } else {
      }
    } catch (error) {
    }
  }

  // Check for success message in URL parameters (e.g., after redirect from server)
  window.addEventListener("load", () => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get("success")
    const message = urlParams.get("message")
    
    if (success === "true" && message) {
      window.showNotification(decodeURIComponent(message), "success")
      
      // Clean up URL parameters
      const url = new URL(window.location)
      url.searchParams.delete("success")
      url.searchParams.delete("message")
      window.history.replaceState({}, "", url)
    } else if (success === "false" && message) {
      window.showNotification(decodeURIComponent(message), "error")
      
      // Clean up URL parameters
      const url = new URL(window.location)
      url.searchParams.delete("success")
      url.searchParams.delete("message")
      window.history.replaceState({}, "", url)
    }
  })
  
  // Avatar upload from settings sidebar
  const settingsAvatarUpload = document.getElementById('settingsAvatarUpload')
  if (settingsAvatarUpload) {
    settingsAvatarUpload.addEventListener('change', async function(e) {
      const file = e.target.files[0]
      if (!file) return
      
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        window.showNotification('Bestand is te groot. Maximaal 2MB toegestaan.', 'error')
        return
      }
      
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        window.showNotification('Ongeldig bestandstype. Alleen JPG en PNG toegestaan.', 'error')
        return
      }
      
      // Create FormData
      const formData = new FormData()
      formData.append('profilePicture', file)
      
      try {
        // Upload via AJAX
        const response = await fetch('/api/upload-profile-picture', {
          method: 'POST',
          body: formData
        })
        
        const result = await response.json()
        
        if (result.success) {
          // Update avatar in sidebar
          const avatarImg = document.querySelector('.settings-avatar img')
          const avatarPlaceholder = document.querySelector('.settings-avatar .avatar-placeholder')
          
          if (avatarPlaceholder) {
            avatarPlaceholder.remove()
            const newImg = document.createElement('img')
            newImg.src = result.imageUrl + '?t=' + Date.now()
            newImg.alt = 'Profile'
            newImg.className = 'rounded-circle'
            document.querySelector('.settings-avatar').appendChild(newImg)
          } else if (avatarImg) {
            avatarImg.src = result.imageUrl + '?t=' + Date.now()
          }
          
          // Update header avatar
          const headerAvatar = document.querySelector('.user-avatar .avatar-placeholder')
          const headerImg = document.querySelector('.user-avatar img')
          if (headerAvatar) {
            headerAvatar.outerHTML = `<img src="${result.imageUrl}?t=${Date.now()}" alt="Profile" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`
          } else if (headerImg) {
            headerImg.src = result.imageUrl + '?t=' + Date.now()
          }
          
          window.showNotification('Profielfoto succesvol bijgewerkt!', 'success')
        } else {
          window.showNotification(result.message || 'Fout bij uploaden van profielfoto', 'error')
        }
      } catch (error) {
        window.showNotification('Er is een fout opgetreden bij het uploaden', 'error')
      }
    })
  }
})  // Close DOMContentLoaded

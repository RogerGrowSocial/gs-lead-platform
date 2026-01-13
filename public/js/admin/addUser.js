// Wacht tot het document volledig is geladen
document.addEventListener("DOMContentLoaded", () => {
  console.log("addUser.js geladen")

  // Zoek de knop om een gebruiker toe te voegen
  const addUserBtn = document.getElementById("addUserBtn")
  console.log("addUserBtn gevonden:", addUserBtn)

  // Voeg een event listener toe aan de knop
  if (addUserBtn) {
    // Verwijder bestaande event listeners om dubbele uitvoering te voorkomen
    const newBtn = addUserBtn.cloneNode(true)
    addUserBtn.parentNode.replaceChild(newBtn, addUserBtn)

    newBtn.addEventListener("click", (e) => {
      console.log("addUserBtn geklikt")
      e.preventDefault()
      e.stopPropagation() // Stop event bubbling
      showAddUserModal()
    })
  }

  // Voeg de modale stijlen toe aan de pagina
  addModalStyles()
})

// Functie om een tijdelijk wachtwoord te genereren
function generateTemporaryPassword() {
  const length = 12
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-+=<>?"
  let password = ""

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length)
    password += charset[randomIndex]
  }

  return password
}

// Functie om een notificatie te tonen (lokale versie, gebruikt window.showNotification indien beschikbaar)
function createNotification(message, type = "info", duration = 5000) {
  // Gebruik de globale functie als deze beschikbaar is
  if (typeof window.showNotification === "function") {
    return window.showNotification(message, type, duration)
  }

  // Fallback naar de originele notificatie implementatie
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
  
  return notification
}

// Functie om een nieuwe gebruiker toe te voegen
function submitNewUser(userData, modal) {
  console.log("submitNewUser aangeroepen met:", userData)

  // Toon een laadanimatie
  const submitBtn = document.querySelector("#submitAddUser")
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = "Bezig met opslaan..."
  }

  // Verstuur de gegevens naar de API
  fetch("/admin/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...userData,
      first_name: userData.first_name || userData.firstName,
      last_name: userData.last_name || userData.lastName,
      password: generateTemporaryPassword(), // Genereer een tijdelijk wachtwoord
      send_password_reset: true, // Geeft aan dat er een wachtwoord-reset e-mail moet worden verstuurd
    }),
  })
    .then((response) => {
      console.log("API response status:", response.status)
      return response.json()
    })
    .then((data) => {
      console.log("API response data:", data)

      // Reset de submit knop
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.textContent = "Opslaan"
      }

      if (data.success) {
        // Toon een succesmelding met de notificatie functie
        createNotification(
          data.message ||
            "Gebruiker succesvol aangemaakt! Er is een e-mail verstuurd naar de gebruiker om een wachtwoord in te stellen.",
          "success",
          8000,
        )

        // Sluit het modal
        if (modal) {
          closeModal(modal)
        }

        // Vernieuw de pagina na een korte vertraging zodat de gebruiker de notificatie kan zien
        setTimeout(() => {
          // Stel een vlag in om aan te geven dat we niet opnieuw een welkomstbericht willen zien
          sessionStorage.setItem("skipWelcomeNotification", "true")

          // Vernieuw de pagina
          window.location.reload()
        }, 1500)
      } else {
        // Controleer op specifieke foutmeldingen
        let errorMessage = data.message || "Er is een fout opgetreden."

        // Controleer of het een dubbele gebruiker betreft
        if (
          errorMessage.toLowerCase().includes("duplicate") ||
          errorMessage.toLowerCase().includes("already exists") ||
          errorMessage.toLowerCase().includes("bestaat al") ||
          errorMessage.toLowerCase().includes("unique constraint") ||
          errorMessage.toLowerCase().includes("unique violation")
        ) {
          errorMessage = "Deze gebruiker bestaat al. Het e-mailadres is al in gebruik."
        }

        // Toon een foutmelding met de notificatie functie
        createNotification("Fout: " + errorMessage, "error")
      }
    })
    .catch((error) => {
      console.error("Fout bij aanmaken gebruiker:", error)

      // Reset de submit knop
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.textContent = "Opslaan"
      }

      // Controleer of het een dubbele gebruiker betreft
      let errorMessage = "Er is een fout opgetreden. Controleer de console voor meer informatie."

      if (
        error.message &&
        (error.message.toLowerCase().includes("duplicate") ||
          error.message.toLowerCase().includes("already exists") ||
          error.message.toLowerCase().includes("bestaat al") ||
          error.message.toLowerCase().includes("unique constraint") ||
          error.message.toLowerCase().includes("unique violation"))
      ) {
        errorMessage = "Deze gebruiker bestaat al. Het e-mailadres is al in gebruik."
      }

      // Toon een foutmelding met de notificatie functie
      createNotification("Fout: " + errorMessage, "error")
    })
}

// Functie om het modale venster te sluiten en de body scroll te herstellen
function closeModal(modal) {
  modal.style.display = "none"
  document.body.style.overflow = "auto" // Herstel de scroll
}

// Functie om het modale venster voor het toevoegen van een gebruiker te tonen
function showAddUserModal() {
  console.log("showAddUserModal aangeroepen")

  // Controleer of er al een modal bestaat
  let modal = document.getElementById("addUserModal")

  // Als het modal nog niet bestaat, maak het dan aan
  if (!modal) {
    modal = document.createElement("div")
    modal.id = "addUserModal"
    modal.className = "modal"
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Nieuwe gebruiker toevoegen</h2>
          <span class="close">&times;</span>
        </div>
        <div class="modal-body">
          <form id="simpleAddUserForm" class="needs-validation">
            <div class="form-section">
              <h3>Bedrijfsinformatie</h3>
              <div class="form-group">
                <label for="company_name">Bedrijfsnaam</label>
                <input type="text" id="company_name" name="company_name" class="form-control" required>
              </div>
              <div class="form-group">
                <label for="company_website">Website</label>
                <input type="url" id="company_website" name="company_website" class="form-control" placeholder="https://www.voorbeeld.nl">
              </div>
            </div>

            <div class="form-section">
              <h3>Persoonlijke informatie</h3>
              <div class="form-grid">
                <div class="form-grid-item">
                  <label for="first_name">Voornaam</label>
                  <input type="text" id="first_name" name="first_name" class="form-control" required>
                </div>
                <div class="form-grid-item">
                  <label for="last_name">Achternaam</label>
                  <input type="text" id="last_name" name="last_name" class="form-control" required>
                </div>
                <div class="form-grid-item">
                  <label for="email">E-mailadres</label>
                  <input type="email" id="email" name="email" class="form-control" required>
                </div>
                <div class="form-grid-item">
                  <label for="phone">Telefoonnummer</label>
                  <input type="tel" id="phone" name="phone" class="form-control">
                </div>
              </div>
            </div>

            <div class="form-section">
              <h3>Account instellingen</h3>
              <div class="form-group">
                <label for="is_admin">Rol</label>
                <select id="is_admin" name="is_admin" class="form-control" required>
                  <option value="0">Gebruiker</option>
                  <option value="1">Administrator</option>
                </select>
              </div>
              <div class="form-group">
                <div class="checkbox-container">
                  <input type="checkbox" id="send_welcome_email" name="send_welcome_email" checked>
                  <label for="send_welcome_email" class="checkbox-label">
                    Stuur welkomst e-mail met instructies
                  </label>
                </div>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary" id="cancelAddUser">Annuleren</button>
          <button type="button" class="btn-primary" id="submitAddUser">Opslaan</button>
        </div>
      </div>
    `

    // Voeg het modal toe aan de pagina
    document.body.appendChild(modal)

    // Voeg event listeners toe aan het modal
    const closeBtn = modal.querySelector(".close")
    const cancelBtn = modal.querySelector("#cancelAddUser")
    const submitBtn = modal.querySelector("#submitAddUser")
    const form = modal.querySelector("#simpleAddUserForm")

    // Sluit het modal wanneer op het kruisje wordt geklikt
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        closeModal(modal)
      })
    }

    // Sluit het modal wanneer op de annuleren knop wordt geklikt
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        closeModal(modal)
      })
    }

    // Verstuur het formulier wanneer op de opslaan knop wordt geklikt
    if (submitBtn && form) {
      submitBtn.addEventListener("click", (e) => {
        e.preventDefault()
        console.log("Formulier verzonden")

        // Verzamel de gegevens
        const formData = new FormData(form)
        const userData = {}

        formData.forEach((value, key) => {
          userData[key] = value
        })

        // Converteer is_admin naar een nummer
        userData.is_admin = Number.parseInt(userData.is_admin)

        console.log("Gebruikersgegevens:", userData)

        // Verstuur de gegevens
        submitNewUser(userData, modal)
      })
    }

    // Sluit het modal wanneer buiten het modal wordt geklikt
    window.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal)
      }
    })
  }

  // Voorkom scrollen van de achtergrond
  document.body.style.overflow = "hidden"

  // Toon het modal
  modal.style.display = "block"
}

// Functie om de modale stijlen toe te voegen aan de pagina
function addModalStyles() {
  console.log("addModalStyles aangeroepen")

  // Controleer of de stijlen al zijn toegevoegd
  if (!document.getElementById("addUserModalStyles")) {
    // Maak een nieuw style element aan
    const style = document.createElement("style")
    style.id = "addUserModalStyles"

    // Voeg de CSS toe
    style.innerHTML = `
      /* Modal stijlen */
      .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0, 0, 0, 0.5);
      }

      .modal-content {
        position: relative;
        background-color: #fff;
        margin: 5% auto;
        padding: 0;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        width: 80%;
        max-width: 700px;
        animation: modalFadeIn 0.3s ease-out;
      }

      @keyframes modalFadeIn {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        border-bottom: 1px solid #e0e0e0;
      }

      .modal-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: #333;
      }

      .close {
        color: #aaa;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
        transition: color 0.2s;
      }

      .close:hover,
      .close:focus {
        color: #333;
        text-decoration: none;
      }

      .modal-body {
        padding: 24px;
        max-height: 60vh;
        overflow-y: auto;
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        padding: 16px 24px;
        border-top: 1px solid #e0e0e0;
        gap: 12px;
      }

      /* Formulier stijlen */
      .form-section {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #f0f0f0;
      }

      .form-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }

      .form-section h3 {
        margin-top: 0;
        margin-bottom: 16px;
        font-size: 1.2rem;
        color: #555;
      }

      .form-group {
        margin-bottom: 16px;
      }

      /* 2x2 Grid voor persoonlijke informatie */
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-gap: 16px;
      }

      .form-grid-item {
        margin-bottom: 16px;
      }

      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #555;
      }

      .form-control {
        display: block;
        width: 100%;
        padding: 8px 12px;
        font-size: 1rem;
        line-height: 1.5;
        color: #495057;
        background-color: #fff;
        background-clip: padding-box;
        border: 1px solid #ced4da;
        border-radius: 4px;
        transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        box-sizing: border-box;
      }

      .form-control:focus {
        border-color: #80bdff;
        outline: 0;
        box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
      }

      /* Verbeterde checkbox stijlen */
      .checkbox-container {
        display: flex;
        align-items: center;
        margin-top: 8px;
      }

      .checkbox-container input[type="checkbox"] {
        margin-right: 8px;
        width: 18px;
        height: 18px;
      }

      .checkbox-label {
        display: inline;
        margin-bottom: 0;
        font-weight: normal;
      }

      /* Knoppen stijlen */
      .btn-primary, .btn-secondary {
        padding: 8px 16px;
        font-size: 1rem;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-primary {
        background-color: #f26522;
        color: white;
        border: none;
      }

      .btn-primary:hover {
        background-color: #e55511;
      }

      .btn-secondary {
        background-color: #f5f5f5;
        color: #333;
        border: 1px solid #e0e0e0;
      }

      .btn-secondary:hover {
        background-color: #e8e8e8;
      }

      /* Responsive stijlen */
      @media (max-width: 768px) {
        .modal-content {
          width: 95%;
          margin: 10% auto;
        }

        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `

    // Voeg de stijlen toe aan de head van het document
    document.head.appendChild(style)
    console.log("Modal stijlen toegevoegd")
  }
}

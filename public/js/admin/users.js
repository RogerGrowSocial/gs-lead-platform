document.addEventListener("DOMContentLoaded", () => {
  
  // users.js (vlak na imports, vóór álle DOMContentLoaded-listeners)
  window.openEditModal = function(userId) {
    const modal = document.getElementById("userEditModal");
    if (!modal) {
      console.error("Modal element niet gevonden");
      window.showNotification("Kan het bewerkingsvenster niet openen", "error");
      return;
    }
    // (optioneel) titel updaten
    const modalTitle = modal.querySelector(".modal-header h2");
    if (modalTitle) modalTitle.textContent = "Gebruiker bewerken";
  
    fetch(`/admin/api/users/${userId}`, { credentials: 'include' })  // gebruik admin-endpoint
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        // zet alleen de velden die wél in je form zitten
        const idFld    = document.getElementById("userId");
        const compFld  = document.getElementById("companyName");
        const firstFld = document.getElementById("firstName");
        const lastFld  = document.getElementById("lastName");
        const emailFld = document.getElementById("email");
        const phoneFld = document.getElementById("phone");
        const roleFld  = document.getElementById("role");
        const statFld  = document.getElementById("status");
  
        if (idFld)    idFld.value    = data.id;
        if (compFld)  compFld.value  = data.company_name    || "";
        if (firstFld) firstFld.value = data.first_name      || "";
        if (lastFld)  lastFld.value  = data.last_name       || "";
        if (emailFld) emailFld.value = data.email           || "";
        if (phoneFld) phoneFld.value = data.phone           || "";
        if (roleFld)  roleFld.value  = data.is_admin ? "1" : "0";
        if (statFld)  statFld.value  = data.status          || "active";
  
        modal.style.display = "block";
      })
      .catch(err => {
        console.error(err);
        window.showNotification("Fout bij laden gebruikersgegevens.", "error");
      });
  };
  
  
  // Debug function to help identify DOM structure
  function debugElement(element, label = "Element") {
    console.log(`${label}:`, element)
    console.log(`${label} data-id:`, element.getAttribute("data-id"))
    console.log(`${label} HTML:`, element.outerHTML)
    console.log(`${label} parent:`, element.parentNode)
  }

  // Nieuwe functie voor het tonen van een mooie confirm dialoog
  function showConfirmDialog(message, onConfirm, onCancel) {
    // Controleer of de confirm modal al bestaat
    if (document.getElementById("confirmDialog")) {
      document.getElementById("confirmDialog").remove()
    }

    // Maak het modal element
    const modal = document.createElement("div")
    modal.id = "confirmDialog"
    modal.className = "modal confirm-dialog-modal"
    modal.style.display = "block"

    // Vul het modal met HTML
    modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Bevestiging</h2>
        <span class="modal-close">&times;</span>
      </div>
      <div class="modal-body">
        <div class="confirm-message">
          <i class="fas fa-question-circle"></i>
          <p>${message}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button id="cancelConfirm" class="btn btn-outline">Annuleren</button>
        <button id="confirmAction" class="btn btn-primary">Bevestigen</button>
      </div>
    </div>
  `

    // Voeg de modal toe aan het einde van de body
    document.body.appendChild(modal)

    // Voeg CSS toe voor de modal
    addConfirmDialogStyles()

    // Event listeners voor de knoppen
    const closeBtn = modal.querySelector(".modal-close")
    const cancelBtn = document.getElementById("cancelConfirm")
    const confirmBtn = document.getElementById("confirmAction")

    // Sluit de modal en roep onCancel aan
    const handleCancel = () => {
      modal.style.display = "none"
      if (typeof onCancel === "function") {
        onCancel()
      }
      // Verwijder de modal na een korte vertraging
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal)
        }
      }, 300)
    }

    // Sluit de modal en roep onConfirm aan
    const handleConfirm = () => {
      modal.style.display = "none"
      if (typeof onConfirm === "function") {
        onConfirm()
      }
      // Verwijder de modal na een korte vertraging
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal)
        }
      }, 300)
    }

    // Voeg event listeners toe
    if (closeBtn) closeBtn.addEventListener("click", handleCancel)
    if (cancelBtn) cancelBtn.addEventListener("click", handleCancel)
    if (confirmBtn) confirmBtn.addEventListener("click", handleConfirm)

    // Sluit de modal als er buiten wordt geklikt
    window.addEventListener("click", (event) => {
      if (event.target === modal) {
        handleCancel()
      }
    })
  }

  // Functie om CSS toe te voegen voor de confirm dialog modal
  function addConfirmDialogStyles() {
    // Controleer of de stijlen al zijn toegevoegd
    if (document.getElementById("confirmDialogStyles")) return

    // Maak een style element
    const style = document.createElement("style")
    style.id = "confirmDialogStyles"

    // Voeg CSS toe
    style.textContent = `
    /* Confirm Dialog Modal Styles */
    .confirm-dialog-modal .modal-content {
      max-width: 450px;
    }
    
    .confirm-message {
      display: flex;
      align-items: flex-start;
      margin-bottom: 20px;
      padding: 15px;
      border-radius: 8px;
      background-color: #f8f9fa;
    }
    
    .confirm-message i {
      color: #3182ce;
      font-size: 24px;
      margin-right: 15px;
      margin-top: 2px;
    }
    
    .confirm-message p {
      margin: 0;
      color: #4a5568;
    }
    
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    
    .btn-primary {
      background-color: #3182ce;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .btn-primary:hover {
      background-color: #2c5282;
    }
    
    .btn-outline {
      background-color: transparent;
      color: #4a5568;
      border: 1px solid #e2e8f0;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .btn-outline:hover {
      background-color: #f7fafc;
    }
    
    /* Animatie voor de modal */
    .confirm-dialog-modal {
      animation: fadeIn 0.3s ease-out;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `

    // Voeg de stijlen toe aan de head
    document.head.appendChild(style)
  }

  // Dynamisch toevoegen van de delete confirmation modal aan de DOM
  function createDeleteConfirmModal() {
    // Controleer of de modal al bestaat
    if (document.getElementById("deleteConfirmModal")) return

    // Maak het modal element
    const modal = document.createElement("div")
    modal.id = "deleteConfirmModal"
    modal.className = "modal delete-confirm-modal"
    modal.style.display = "none"

    // Vul het modal met HTML
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Gebruikers verwijderen</h2>
          <span class="modal-close">&times;</span>
        </div>
        <div class="modal-body">
          <div class="delete-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Weet je zeker dat je de volgende gebruiker(s) wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.</p>
          </div>
          <div class="delete-users-list">
            <!-- Hier worden de gebruikers dynamisch toegevoegd -->
          </div>
          <div class="delete-note">
            <p><strong>Let op:</strong> Alle gegevens die aan deze gebruiker(s) zijn gekoppeld worden ook verwijderd.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button id="cancelDelete" class="btn btn-outline">Annuleren</button>
          <button id="confirmDelete" class="btn btn-danger">Verwijderen</button>
        </div>
      </div>
    `

    // Voeg de modal toe aan het einde van de body
    document.body.appendChild(modal)

    // Voeg CSS toe voor de modal
    addDeleteModalStyles()
  }

  // Functie om CSS toe te voegen voor de delete confirmation modal
  function addDeleteModalStyles() {
    // Controleer of de stijlen al zijn toegevoegd
    if (document.getElementById("deleteConfirmModalStyles")) return

    // Maak een style element
    const style = document.createElement("style")
    style.id = "deleteConfirmModalStyles"

    // Voeg CSS toe
    style.textContent = `
      /* Delete Confirmation Modal Styles */
      .delete-confirm-modal .modal-content {
        max-width: 500px;
      }
      
      .delete-warning {
        display: flex;
        align-items: flex-start;
        margin-bottom: 20px;
        background-color: #fff5f5;
        padding: 15px;
        border-radius: 8px;
      }
      
      .delete-warning i {
        color: #e53e3e;
        font-size: 24px;
        margin-right: 15px;
        margin-top: 2px;
      }
      
      .delete-warning p {
        margin: 0;
        color: #4a5568;
      }
      
      .delete-users-list {
        max-height: 300px;
        overflow-y: auto;
        margin-bottom: 20px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      }
      
      .delete-user-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 15px;
        border-bottom: 1px solid #e2e8f0;
      }
      
      .delete-user-item:last-child {
        border-bottom: none;
      }
      
      .delete-user-info {
        flex: 1;
      }
      
      .delete-user-name {
        font-weight: 600;
        color: #4a5568;
        margin-bottom: 3px;
      }
      
      .delete-user-email {
        font-size: 0.85rem;
        color: #718096;
      }
      
      .delete-user-role {
        margin-left: 15px;
      }
      
      .delete-note {
        background-color: #f8f9fa;
        padding: 12px 15px;
        border-radius: 8px;
        font-size: 0.9rem;
      }
      
      .delete-note p {
        margin: 0;
        color: #718096;
      }
      
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding-top: 20px;
        border-top: 1px solid #e2e8f0;
      }
      
      .btn-danger {
        background-color: #e53e3e;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .btn-danger:hover {
        background-color: #c53030;
      }
      
      .btn-outline {
        background-color: transparent;
        color: #4a5568;
        border: 1px solid #e2e8f0;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .btn-outline:hover {
        background-color: #f7fafc;
      }
      
      /* Animatie voor de modal */
      .delete-confirm-modal {
        animation: fadeIn 0.3s ease-out;
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* Responsive aanpassingen */
      @media (max-width: 576px) {
        .delete-confirm-modal .modal-content {
          width: 95%;
          margin: 20px auto;
        }
        
        .delete-user-item {
          flex-direction: column;
          align-items: flex-start;
        }
        
        .delete-user-role {
          margin-left: 0;
          margin-top: 8px;
        }
      }
    `

    // Voeg de stijlen toe aan de head
    document.head.appendChild(style)
  }

  // Roep deze functie aan om de modal te creëren
  createDeleteConfirmModal()

  // Direct event listeners toevoegen aan alle delete knoppen
  function addDeleteButtonListeners() {
    console.log("Toevoegen van event listeners aan delete knoppen")

    // Selecteer alle delete knoppen in de dropdown menu's
    const deleteButtons = document.querySelectorAll(".dropdown-item[data-action='delete']")
    console.log(`${deleteButtons.length} delete knoppen gevonden`)

    deleteButtons.forEach((button) => {
      // Verwijder bestaande event listeners om dubbele uitvoering te voorkomen
      const newButton = button.cloneNode(true)
      button.parentNode.replaceChild(newButton, button)

      // Voeg nieuwe event listener toe
      newButton.addEventListener("click", function (e) {
        e.preventDefault()
        e.stopPropagation() // Stop event bubbling

        console.log("Delete knop geklikt")
        debugElement(this, "Delete button")

        // Zoek de gebruiker ID op verschillende manieren
        let userId = this.getAttribute("data-id")

        // Check if this is the bulk actions delete button
        if (this.closest("#bulkActionsMenu")) {
          console.log("This is the bulk actions delete button, not a single user delete button")
          // For bulk actions, we need selected checkboxes
          const selectedIds = Array.from(document.querySelectorAll(".user-checkbox:checked")).map((checkbox) =>
            checkbox.getAttribute("data-id"),
          )

          if (selectedIds.length === 0) {
            window.showNotification("Selecteer eerst gebruikers om te verwijderen", "warning")
            return
          }

          console.log("Geselecteerde gebruiker IDs:", selectedIds)

          // Maak direct gebruikersobjecten van de geselecteerde IDs
          // Dit voorkomt problemen met API-aanroepen die kunnen mislukken
          const selectedUsers = selectedIds.map((id) => {
            // Probeer de gebruikersnaam uit de tabel te halen
            const checkbox = document.querySelector(`.user-checkbox[data-id="${id}"]`)
            const row = checkbox ? checkbox.closest("tr") || checkbox.closest(".users-row") : null

            let companyName = "Onbekend"
            let email = `Gebruiker ${id}`

            // Probeer de bedrijfsnaam en e-mail uit de rij te halen als die bestaat
            if (row) {
              const companyNameEl = row.querySelector(".company-name") || row.querySelector(".user-name")
              const emailEl = row.querySelector(".user-email")

              if (companyNameEl) companyName = companyNameEl.textContent.trim()
              if (emailEl) email = emailEl.textContent.trim()
            }

            // Maak een gebruikersobject met de ID en gevonden gegevens
            return {
              id: id,
              company_name: companyName,
              email: email,
              // Voeg andere standaardwaarden toe die nodig zijn
              is_admin: false,
            }
          })

          console.log("Gebruikersobjecten voor verwijdering:", selectedUsers)

          // Toon de bevestigingsdialoog met de gemaakte gebruikersobjecten
          showDeleteConfirmation(selectedUsers)

          return
        }

        // Als de knop zelf geen data-id heeft, zoek in de parent elementen
        if (!userId) {
          // Probeer de dropdown container
          const dropdown = this.closest(".dropdown")
          if (dropdown) {
            debugElement(dropdown, "Dropdown container")
            userId = dropdown.getAttribute("data-id")

            // Als de dropdown geen ID heeft, probeer de dropdown-toggle
            if (!userId) {
              const dropdownToggle = dropdown.querySelector(".dropdown-toggle")
              if (dropdownToggle) {
                debugElement(dropdownToggle, "Dropdown toggle")
                userId = dropdownToggle.getAttribute("data-id")
              }
            }
          }

          // Als nog steeds geen ID, probeer de parent row
          if (!userId) {
            const row = this.closest("tr") || this.closest(".users-row")
            if (row) {
              debugElement(row, "Row")
              userId = row.getAttribute("data-id")
            }
          }

          // Als nog steeds geen ID, probeer de href van de link
          if (!userId && this.hasAttribute("href")) {
            const href = this.getAttribute("href")
            console.log("Href attribute:", href)
            const match = href.match(/\/users\/(\d+)\/delete/)
            if (match && match[1]) {
              userId = match[1]
              console.log("Extracted ID from href:", userId)
            }
          }

          // Als nog steeds geen ID, probeer data-user-id attribuut
          if (!userId && this.hasAttribute("data-user-id")) {
            userId = this.getAttribute("data-user-id")
            console.log("Found ID in data-user-id:", userId)
          }

          // Als nog steeds geen ID, probeer een parent met data-user-id
          if (!userId) {
            const parentWithId = this.closest("[data-user-id]")
            if (parentWithId) {
              userId = parentWithId.getAttribute("data-user-id")
              console.log("Found ID in parent with data-user-id:", userId)
            }
          }

          // Als nog steeds geen ID, probeer een parent met id attribuut
          if (!userId) {
            const parentWithId = this.closest("[id]")
            if (parentWithId) {
              const idAttr = parentWithId.getAttribute("id")
              console.log("Parent ID attribute:", idAttr)
              const match = idAttr.match(/user-(\d+)/)
              if (match && match[1]) {
                userId = match[1]
                console.log("Extracted ID from parent id attribute:", userId)
              }
            }
          }
        }

        // Als nog steeds geen ID, probeer de tekst van de knop of een naburige element
        if (!userId) {
          // Zoek naar een element met een gebruikers-ID in de tekst
          const userIdElements = this.closest("tr")?.querySelectorAll("td") || []
          for (const element of userIdElements) {
            const text = element.textContent.trim()
            const match = text.match(/^(\d+)$/)
            if (match) {
              userId = match[1]
              console.log("Found ID in table cell:", userId)
              break
            }
          }
        }

        if (!userId) {
          console.error("Kon geen gebruiker ID vinden voor verwijderen")
          window.showNotification("Kon geen gebruiker ID vinden voor verwijderen", "warning")
          return
        }

        console.log(`Verwijderen van gebruiker met ID: ${userId}`)

        // Fetch user details for confirmation
        fetch(`/api/users/${userId}`)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
          })
          .then((data) => {
            console.log("Gebruikersgegevens opgehaald:", data)
            showDeleteConfirmation([data])
          })
          .catch((error) => {
            console.error("Error fetching user details:", error)
            showConfirmDialog(`Weet je zeker dat je gebruiker ${userId} wilt verwijderen?`, () => {
              deleteUser(userId)
            })
          })
      })
    })

    // Selecteer alle delete-user knoppen (individuele delete knoppen)
    const deleteUserButtons = document.querySelectorAll(".delete-user")
    console.log(`${deleteUserButtons.length} delete-user knoppen gevonden`)

    deleteUserButtons.forEach((button) => {
      // Verwijder bestaande event listeners om dubbele uitvoering te voorkomen
      const newButton = button.cloneNode(true)
      button.parentNode.replaceChild(newButton, button)

      // Voeg nieuwe event listener toe
      newButton.addEventListener("click", function (e) {
        e.preventDefault()
        e.stopPropagation() // Stop event bubbling

        console.log("Delete-user knop geklikt")
        debugElement(this, "Delete-user button")

        const userId = this.getAttribute("data-id")

        if (!userId) {
          console.error("Kon geen gebruiker ID vinden voor verwijderen")
          window.showNotification("Kon geen gebruiker ID vinden voor verwijderen", "warning")
          return
        }

        console.log(`Verwijderen van gebruiker met ID: ${userId}`)

        // Fetch user details for confirmation
        fetch(`/api/users/${userId}`)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
          })
          .then((data) => {
            console.log("Gebruikersgegevens opgehaald:", data)
            showDeleteConfirmation([data])
          })
          .catch((error) => {
            console.error("Error fetching user details:", error)
            showConfirmDialog(`Weet je zeker dat je gebruiker ${userId} wilt verwijderen?`, () => {
              deleteUser(userId)
            })
          })
      })
    })
  }

  // Roep de functie aan om de event listeners toe te voegen
  addDeleteButtonListeners()

  // Elements
  const userSearch = document.getElementById("userSearch") || document.getElementById("searchUsers")
  const editButtons = document.querySelectorAll(".edit-btn, .edit-user")
  const viewButtons = document.querySelectorAll(".view-btn, .view-user")
  const addUserBtn = document.getElementById("addUserBtn")
  const modal = document.getElementById("userEditModal") || document.getElementById("userModal")
  const closeBtn = modal?.querySelector(".close-btn") || modal?.querySelector(".modal-close")
  const cancelBtn = document.getElementById("cancelEdit") || document.getElementById("cancelBtn")
  const editForm = document.getElementById("editUserForm") || document.getElementById("userForm")
  
  // Check if we're using server-side pagination (new user-item layout)
  const userItems = document.querySelectorAll('.user-item');
  const tableRows = document.querySelectorAll(".users-table tbody tr, .users-table-body .users-row, .users-row");
  const isServerSidePagination = userItems.length > 0;
  
  const sortButtons = document.querySelectorAll(".th-content")
  const paginationButtons = document.querySelectorAll(".pagination-page")

  // Global variables for filtering (only for old table layout)
  const allUsers = isServerSidePagination ? Array.from(userItems) : Array.from(tableRows);
  let filteredUsers = [...allUsers]
  
  // Global variables for pagination (only for old table layout)
  let currentPage = 1
  let itemsPerPage = 10
  let totalPages = 1

  // Only initialize client-side filtering/pagination if NOT using server-side pagination
  if (!isServerSidePagination) {
  // Initialize filters
  initFilters()
  
  // Initialize pagination
  initPagination()
  }

  // Search functionality (only for old table layout)
  if (userSearch && !isServerSidePagination) {
    userSearch.addEventListener("input", () => {
      applyFilters()
    })
  }

    // Edit user functionality via delegation
    const usersTable = document.querySelector(".users-table")
    if (usersTable) {
      usersTable.addEventListener("click", e => {
        const btn = e.target.closest(".edit-user")
        if (!btn) return
        e.preventDefault()
        window.openEditModal(btn.dataset.id)
      })
    }
  

  // View user functionality
  viewButtons.forEach((button) => {
    // Verwijder bestaande event listeners om dubbele uitvoering te voorkomen
    const newButton = button.cloneNode(true)
    button.parentNode.replaceChild(newButton, button)

    newButton.addEventListener("click", function (e) {
      e.preventDefault()
      e.stopPropagation() // Stop event bubbling

      console.log("View-user knop geklikt")
      const userId = this.getAttribute("data-id")

      if (!userId) {
        console.error("Kon geen gebruiker ID vinden voor bekijken")
        window.showNotification("Kon geen gebruiker ID vinden voor bekijken", "warning")
        return
      }

      console.log(`Bekijken van gebruiker met ID: ${userId}`)
      viewUser(userId)
    })
  })

  // Add user functionality
  if (addUserBtn) {
    // Verwijder bestaande event listeners om dubbele uitvoering te voorkomen
    const newBtn = addUserBtn.cloneNode(true)
    addUserBtn.parentNode.replaceChild(newBtn, addUserBtn)

    newBtn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation() // Stop event bubbling
      // We don't need to do anything here as addUser.js will handle this
    })
  }

  // Close modal functionality
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (modal) modal.style.display = "none"
    })
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (modal) modal.style.display = "none"
    })
  }

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none"
    }
  })

  // Event listener voor het opslaan van gebruikersgegevens
  const userForm = document.getElementById('userForm');
  if (userForm) {
    userForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const userId = document.getElementById('userId').value;
    const userData = {
      id: userId,
      company_name: document.getElementById('companyName').value,
      first_name: document.getElementById('firstName').value,
      last_name: document.getElementById('lastName').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      is_admin: document.getElementById('role').value === '1',
      status: document.getElementById('status').value
    };
    
    console.log('Formuliergegevens verzameld:', userData);
    
    // Valideer dat we een geldig ID hebben
    if (!userId) {
      window.showNotification('Geen geldig gebruikers-ID gevonden', 'error');
      return;
    }
    
    // Stuur de gegevens naar de server
    updateUser(userData);
  });
  }

  async function updateUser(userData) {
    try {
      if (!userData.id) {
        throw new Error('Geen geldig gebruikers-ID gevonden')
      }

      console.log("Versturen van gebruikersgegevens:", userData)
      
      const response = await fetch(`/admin/api/users/${userData.id}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          company_name: userData.company_name,
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          phone: userData.phone,
          is_admin: userData.is_admin ? 1 : 0,
          status: userData.status,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Server response error:", errorText)
        throw new Error(`Server gaf status ${response.status}`)
      }

      const result = await response.json()
      console.log("Update response:", result)

      if (!result.success) {
        throw new Error(result.message || 'Update niet succesvol')
      }

      // Sluit modal
      const modal = document.getElementById("userEditModal")
      if (modal) modal.style.display = "none"

      // Toon succes notificatie
      window.showNotification(
        result.message || "Gebruiker succesvol bijgewerkt!", 
        "success"
      )

      // Update de gebruikerslijst
      updateUsersList()

    } catch (error) {
      console.error("Fout bij het bijwerken van gebruiker:", error)
      window.showNotification(
        error.message || "Er is een fout opgetreden bij het bijwerken van de gebruiker", 
        "error"
      )
    }
  }

  // Function to create user
  function createUser(userData) {
    fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyName: userData.companyName,
        email: userData.email,
        balance: userData.balance,
        status: userData.status,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          window.showNotification("Nieuwe gebruiker succesvol aangemaakt!", "success")
          if (modal) modal.style.display = "none"
          // Refresh the page to show updated data
          location.reload()
        } else {
          window.showNotification(`Er is een fout opgetreden: ${data.error || "Onbekende fout"}`, "error")
        }
      })
      .catch((error) => {
        console.error("Error creating user:", error)
        window.showNotification("Er is een fout opgetreden bij het aanmaken van de gebruiker.", "error")
      })
  }

  // Function to delete user - UPDATED with transaction-based approach
  function deleteUser(userId) {
    // Toon een loading indicator
    const loadingNotification = window.showNotification('Bezig met verwijderen...', 'info', 0);
    
    fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => {
      // Verwijder de loading notificatie
      if (loadingNotification && loadingNotification.parentNode) {
        loadingNotification.parentNode.removeChild(loadingNotification);
      }
      
      if (!response.ok) {
        return response.json().then(err => {
          // Handle specific error cases for outstanding payments and SEPA mandates
          if (err.outstandingPayments || err.pendingMandates) {
            let errorMessage = err.error;
            if (err.outstandingPayments > 0) {
              errorMessage += `\n\nOpenstaande betalingen: ${err.outstandingPayments} (€${err.totalAmount?.toFixed(2) || '0.00'})`;
            }
            if (err.pendingMandates > 0) {
              errorMessage += `\n\nOpenstaande SEPA mandaten: ${err.pendingMandates}`;
            }
            errorMessage += '\n\nLos eerst de openstaande betalingen en SEPA mandaten op voordat je de gebruiker kunt verwijderen.';
            window.showNotification(errorMessage, "error");
            return;
          } else {
            throw new Error(err.error || 'Er is een fout opgetreden bij het verwijderen van de gebruiker');
          }
        });
      }
      return response.json();
    })
    .then(data => {
      if (data && data.success) {
        // Toon succesmelding
        window.showNotification(data.message || 'Gebruiker succesvol verwijderd', 'success');
        
        // Wacht even zodat de gebruiker de succesmelding kan zien
        setTimeout(() => {
          // Herlaad de pagina
          updateUsersList();
        }, 1000);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      // Toon foutmelding
      window.showNotification(`Er is een fout opgetreden: ${error.message}`, 'error');
    });
  }

  // ===== FILTER FUNCTIONALITEIT =====

  // Initialize filters
  function initFilters() {
    // Status filter
    const statusFilter = document.getElementById("statusFilter")
    if (statusFilter) {
      statusFilter.addEventListener("change", applyFilters)
    }

    // Role filter
    const roleFilter = document.getElementById("roleFilter")
    if (roleFilter) {
      roleFilter.addEventListener("change", applyFilters)
    }

    // Payment method filter
    const paymentFilter = document.getElementById("paymentFilter")
    if (paymentFilter) {
      paymentFilter.addEventListener("change", applyFilters)
    }

    // Reset filters button
    const resetFiltersBtn = document.getElementById("resetFilters")
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener("click", resetFilters)
    }
  }

  // Apply all filters
  function applyFilters() {
    // Skip if using server-side pagination - filters will reload page
    if (isServerSidePagination) {
      // Server-side filtering: reload page with filter parameters
      const url = new URL(window.location.href);
      const searchInput = document.getElementById('searchUsers');
      const statusFilter = document.getElementById('statusFilter');
      const roleFilter = document.getElementById('roleFilter');
      const paymentFilter = document.getElementById('paymentFilter');
      
      if (searchInput && searchInput.value) {
        url.searchParams.set('search', searchInput.value);
      } else {
        url.searchParams.delete('search');
      }
      
      if (statusFilter && statusFilter.value !== 'all') {
        url.searchParams.set('status', statusFilter.value);
      } else {
        url.searchParams.delete('status');
      }
      
      if (roleFilter && roleFilter.value !== 'all') {
        url.searchParams.set('role', roleFilter.value);
      } else {
        url.searchParams.delete('role');
      }
      
      if (paymentFilter && paymentFilter.value !== 'all') {
        url.searchParams.set('payment', paymentFilter.value);
      } else {
        url.searchParams.delete('payment');
      }
      
      // Reset to page 1 when filtering
      url.searchParams.set('page', '1');
      
      window.location.href = url.toString();
      return;
    }
    
    console.log('🔍 Applying filters...');
    console.log('Total users found:', allUsers.length);
    
    // Reset to first page when applying filters
    currentPage = 1;
    
    // Start with all users
    filteredUsers = [...allUsers]

    // Apply search filter
    const searchTerm = (userSearch?.value || "").toLowerCase()
    if (searchTerm) {
      console.log('🔍 Searching for:', searchTerm);
      filteredUsers = filteredUsers.filter((userRow) => {
        const rowText = userRow.textContent.toLowerCase()
        const matches = rowText.includes(searchTerm)
        if (matches) {
          console.log('  ✅ Match found in row:', userRow.textContent.substring(0, 100) + '...');
        }
        return matches
      })
      console.log('🔍 Search results:', filteredUsers.length, 'matches');
    }

    // Apply status filter
    const statusFilter = document.getElementById("statusFilter")
    if (statusFilter && statusFilter.value !== "all") {
      console.log('📊 Filtering by status:', statusFilter.value);
      filteredUsers = filteredUsers.filter((userRow) => {
        // Look for status badge in different possible locations
        const statusBadge = userRow.querySelector(".status-badge:not(.payment-badge):not(.outstanding-payments):not(.pending-mandates):not(.no-outstanding)")
        if (!statusBadge) {
          console.log('  ⚠️ No status badge found in row');
          return true // Skip if no status badge found
        }

        const statusText = statusBadge.textContent.toLowerCase()
        const statusClass = Array.from(statusBadge.classList).find((cls) =>
          ["active", "inactive", "pending"].includes(cls),
        )

        console.log('  🔍 Status badge found:', statusText, 'class:', statusClass);

        switch (statusFilter.value) {
          case "active":
            return statusClass === "active" || statusText.includes("actief")
          case "inactive":
            return statusClass === "inactive" || statusText.includes("inactief")
          case "pending":
            return statusClass === "pending" || statusText.includes("afwachting")
          default:
            return true
        }
      })
      console.log('📊 Status filter results:', filteredUsers.length, 'users');
    }

    // Apply role filter
    const roleFilter = document.getElementById("roleFilter")
    if (roleFilter && roleFilter.value !== "all") {
      filteredUsers = filteredUsers.filter((userRow) => {
        const roleBadge = userRow.querySelector(".role-badge")
        if (!roleBadge) return true // Skip if no role badge found

        const roleText = roleBadge.textContent.toLowerCase()
        const isAdmin = roleBadge.classList.contains("admin") || roleText.includes("admin")

        return (roleFilter.value === "admin" && isAdmin) || (roleFilter.value === "user" && !isAdmin)
      })
    }

    // Apply payment method filter
    const paymentFilter = document.getElementById("paymentFilter")
    if (paymentFilter && paymentFilter.value !== "all") {
      filteredUsers = filteredUsers.filter((userRow) => {
        const paymentBadge = userRow.querySelector(".payment-badge")
        if (!paymentBadge) return true // Skip if no payment badge found

        const hasPayment = paymentBadge.classList.contains("accepted") || 
                          paymentBadge.classList.contains("has-payment") ||
                          paymentBadge.textContent.toLowerCase().includes("ingesteld")

        return (paymentFilter.value === "has_payment" && hasPayment) || 
               (paymentFilter.value === "no_payment" && !hasPayment)
      })
    }

    // Update the table display
    updateTableDisplay()

    // Update counters
    updateCounters()
    
    console.log('✅ Filters applied. Showing', filteredUsers.length, 'users');
  }

  // Reset all filters
  function resetFilters() {
    console.log('🔄 Resetting all filters...');
    
    // Reset search input
    if (userSearch) userSearch.value = ""

    // Reset status filter
    const statusFilter = document.getElementById("statusFilter")
    if (statusFilter) statusFilter.value = "all"

    // Reset role filter
    const roleFilter = document.getElementById("roleFilter")
    if (roleFilter) roleFilter.value = "all"

    // Reset payment filter
    const paymentFilter = document.getElementById("paymentFilter")
    if (paymentFilter) paymentFilter.value = "all"

    // Reset pagination
    currentPage = 1;

    // Reset to show all users
    filteredUsers = [...allUsers]

    // Update the table display
    updateTableDisplay()

    // Update counters
    updateCounters()
  }

  // Update table display based on filtered users and pagination
  function updateTableDisplay() {
    // Skip if using server-side pagination
    if (isServerSidePagination) {
      return;
    }
    
    console.log('📊 Updating table display...');
    console.log('Total filtered users:', filteredUsers.length);
    console.log('Current page:', currentPage);
    console.log('Items per page:', itemsPerPage);
    
    // Calculate pagination range
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    console.log('Showing users', startIndex + 1, 'to', Math.min(endIndex, filteredUsers.length));
    
    // Hide all rows first
    allUsers.forEach((row) => {
      row.style.display = "none"
    })

    // Show only paginated rows
    filteredUsers.forEach((row, index) => {
      if (index >= startIndex && index < endIndex) {
        row.style.display = ""
      }
    })
    
    // Update pagination after table display
    updatePagination()
  }

  // Update counters
  function updateCounters() {
    // Update total count
    const totalCount = document.getElementById("totalCount")
    if (totalCount) {
      totalCount.textContent = `Totaal: ${filteredUsers.length} gebruikers`
    }

    // Update pagination info
    const paginationInfo = document.querySelector(".pagination-info")
    if (paginationInfo) {
      paginationInfo.textContent = `Weergave 1-${filteredUsers.length} van ${filteredUsers.length} items`
    }
  }

  // ===== BULK ACTIES =====

  // Bulk actions dropdown
  const bulkActionsBtn = document.getElementById("bulkActionsBtn")
  const bulkActionsMenu = document.getElementById("bulkActionsMenu")

  if (bulkActionsBtn && bulkActionsMenu) {
    // Toggle dropdown when clicking the button
    bulkActionsBtn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      bulkActionsMenu.classList.toggle("show")
    })

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#bulkActionsBtn") && !e.target.closest("#bulkActionsMenu")) {
        if (bulkActionsMenu.classList.contains("show")) {
          bulkActionsMenu.classList.remove("show")
        }
      }
    })

    // Handle bulk action clicks
    const bulkActionItems = bulkActionsMenu.querySelectorAll(".dropdown-item")
    bulkActionItems.forEach((item) => {
      item.addEventListener("click", function (e) {
        e.preventDefault()
        e.stopPropagation()

        const action = this.getAttribute("data-action")
        const selectedIds = Array.from(document.querySelectorAll(".user-checkbox:checked")).map((checkbox) =>
          checkbox.getAttribute("data-id"),
        )

        if (selectedIds.length === 0) {
          window.showNotification("Selecteer eerst gebruikers om een bulk actie uit te voeren", "warning")
          return
        }

        if (action === "delete") {
          // Fetch user details for all selected users
          Promise.all(
            selectedIds.map((id) =>
              fetch(`/api/users/${id}`)
                .then((res) => {
                  if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`)
                  }
                  return res.json()
                })
                .catch((error) => {
                  console.error(`Fout bij ophalen gebruiker ${id}:`, error)
                  // Return a minimal user object if we can't fetch details
                  return { id: id, email: `Gebruiker ${id}`, company_name: "Onbekend" }
                }),
            ),
          )
            .then((users) => {
              showDeleteConfirmation(users)
            })
            .catch((error) => {
              console.error("Fout bij ophalen gebruikersgegevens:", error)
              showConfirmDialog(`Weet je zeker dat je ${selectedIds.length} gebruiker(s) wilt verwijderen?`, () => {
                performBulkAction("delete", selectedIds)
              })
            })
        } else {
          // For non-delete actions, ask for confirmation
          const actionText = action === "activate" ? "activeren" : "deactiveren"
          showConfirmDialog(`Weet je zeker dat je ${selectedIds.length} gebruiker(s) wilt ${actionText}?`, () => {
            performBulkAction(action, selectedIds)
          })
        }

        // Hide dropdown after action
        bulkActionsMenu.classList.remove("show")
      })
    })
  }

  // Function to perform bulk actions - UPDATED with transaction-based approach
  function performBulkAction(action, ids) {
    console.log(`Uitvoeren bulk actie: ${action} voor IDs:`, ids)
    let url, method, data

    switch (action) {
      case "activate":
        url = "/admin/api/users/bulk/status"
        method = "POST"
        data = { status: "active", ids }
        break
      case "deactivate":
        url = "/admin/api/users/bulk/status"
        method = "POST"
        data = { status: "inactive", ids }
        break
      case "delete":
        url = "/api/profiles/bulk/delete"
        method = "POST"
        data = {
          ids,
          cascade: true
        }
        break
      default:
        return
    }

    // Show loading indicator
    document.body.style.cursor = "wait"
    if (bulkActionsBtn) bulkActionsBtn.disabled = true

    // Verwijder eventuele bestaande notificaties
    const notifications = document.querySelectorAll('.notification')
    notifications.forEach(notification => notification.remove())

    fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify(data),
    })
      .then((response) => {
        return response.json().then(data => {
          if (!response.ok) {
            // Return error data instead of throwing
            return { error: true, ...data }
          }
          return data
        })
      })
      .then((data) => {
        document.body.style.cursor = "default"
        if (bulkActionsBtn) bulkActionsBtn.disabled = false

        if (data.error) {
          // Handle specific error cases for outstanding payments in bulk operations
          if (data.blockedUsers && data.blockedUsers.length > 0) {
            let errorMessage = data.error;
            errorMessage += '\n\nGebruikers met openstaande betalingen:\n';
            data.blockedUsers.forEach(user => {
              errorMessage += `- Gebruiker ${user.userId}: `;
              if (user.outstandingPayments > 0) {
                const amount = parseFloat(user.totalAmount) || 0;
                errorMessage += `${user.outstandingPayments} betalingen (€${amount.toFixed(2)})`;
              }
              if (user.pendingMandates > 0) {
                errorMessage += `${user.pendingMandates} SEPA mandaten`;
              }
              errorMessage += '\n';
            });
            errorMessage += '\nLos eerst de openstaande betalingen op voordat je de gebruikers kunt verwijderen.';
            window.showNotification(errorMessage, "error");
          } else {
            window.showNotification("Fout: " + (data.error || "Er is een fout opgetreden"), "error");
          }
        } else if (data.success) {
          window.showNotification(data.message || "Actie succesvol uitgevoerd", "success")
          updateUsersList()
        } else {
          window.showNotification("Fout: " + (data.error || "Er is een fout opgetreden"), "error");
        }
      })
      .catch((error) => {
        document.body.style.cursor = "default"
        if (bulkActionsBtn) bulkActionsBtn.disabled = false

        console.error("Fout bij uitvoeren bulk actie:", error)
        window.showNotification(
          "Er is een fout opgetreden bij het uitvoeren van de actie. Controleer de console voor meer details.",
          "error",
        )
      })
  }

  // Select all checkbox
  const selectAllCheckbox = document.getElementById("selectAll")
  const userCheckboxes = document.querySelectorAll(".user-checkbox")
  const selectedCountElement = document.getElementById("selectedCount")

  if (selectAllCheckbox && userCheckboxes.length > 0) {
    // Improved select all functionality
    selectAllCheckbox.addEventListener("change", function () {
      const isChecked = this.checked

      // Only select checkboxes in visible rows
      userCheckboxes.forEach((checkbox) => {
        const row = checkbox.closest("tr") || checkbox.closest(".users-row")
        if (row && row.style.display !== "none") {
          checkbox.checked = isChecked
        }
      })

      updateSelectedCount()
      updateBulkActionsButton()
    })

    // Individual checkbox change handler
    userCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        updateSelectedCount()
        updateBulkActionsButton()

        // Update select all checkbox state
        const visibleCheckboxes = Array.from(userCheckboxes).filter((cb) => {
          const row = cb.closest("tr") || cb.closest(".users-row")
          return row && row.style.display !== "none"
        })

        const allChecked = visibleCheckboxes.every((cb) => cb.checked)
        const someChecked = visibleCheckboxes.some((cb) => cb.checked)

        if (selectAllCheckbox) {
          selectAllCheckbox.checked = allChecked
          selectAllCheckbox.indeterminate = someChecked && !allChecked
        }
      })
    })
  }

  // Update the selected count display
  function updateSelectedCount() {
    if (selectedCountElement) {
      const selectedCount = document.querySelectorAll(".user-checkbox:checked").length
      selectedCountElement.textContent = `${selectedCount} geselecteerd`
    }
  }

  // Enable/disable bulk actions button based on selection
  function updateBulkActionsButton() {
    if (bulkActionsBtn) {
      const selectedCount = document.querySelectorAll(".user-checkbox:checked").length
      bulkActionsBtn.disabled = selectedCount === 0
    }
  }

  // Initialize the state
  updateSelectedCount()
  updateBulkActionsButton()
  
  // ===== PAGINATION FUNCTIONALITY =====
  
  // Initialize pagination (only for client-side pagination)
  function initPagination() {
    // Skip if using server-side pagination
    if (isServerSidePagination) {
      console.log('📄 Skipping client-side pagination (using server-side)');
      return;
    }
    
    console.log('📄 Initializing client-side pagination...');
    
    // Items per page selector
    const itemsPerPageSelect = document.getElementById("itemsPerPage");
    if (itemsPerPageSelect) {
      itemsPerPageSelect.addEventListener("change", (e) => {
        itemsPerPage = parseInt(e.target.value);
        currentPage = 1; // Reset to first page
        console.log('📄 Items per page changed to:', itemsPerPage);
        updatePagination();
        updateTableDisplay();
      });
    }
    
    // Pagination buttons
    const prevBtn = document.querySelector(".pagination-btn:first-child");
    const nextBtn = document.querySelector(".pagination-btn:last-child");
    
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          console.log('📄 Previous page:', currentPage);
          updatePagination();
          updateTableDisplay();
        }
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
          currentPage++;
          console.log('📄 Next page:', currentPage);
          updatePagination();
          updateTableDisplay();
        }
      });
    }
    
    // Initial pagination update
    updatePagination();
  }
  
  // Update pagination controls (only for client-side pagination)
  function updatePagination() {
    // Skip if using server-side pagination
    if (isServerSidePagination) {
      return;
    }
    
    console.log('📄 Updating pagination...');
    console.log('Total filtered users:', filteredUsers.length);
    console.log('Items per page:', itemsPerPage);
    
    // Calculate total pages
    totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    console.log('Total pages:', totalPages);
    
    // Update pagination info
    const paginationInfo = document.querySelector(".pagination-info");
    if (paginationInfo) {
      const startItem = (currentPage - 1) * itemsPerPage + 1;
      const endItem = Math.min(currentPage * itemsPerPage, filteredUsers.length);
      paginationInfo.textContent = `Weergave ${startItem}-${endItem} van ${filteredUsers.length} items`;
    }
    
    // Update pagination buttons
    const prevBtn = document.querySelector(".pagination-btn:first-child");
    const nextBtn = document.querySelector(".pagination-btn:last-child");
    
    if (prevBtn) {
      prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages;
    }
    
    // Update pagination pages
    updatePaginationPages();
  }
  
  // Update pagination page buttons
  function updatePaginationPages() {
    const paginationPages = document.querySelector(".pagination-pages");
    if (!paginationPages) return;
    
    // Clear existing pages
    paginationPages.innerHTML = "";
    
    // Calculate which pages to show
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Add page buttons
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement("button");
      pageBtn.className = `pagination-page ${i === currentPage ? 'active' : ''}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener("click", () => {
        currentPage = i;
        console.log('📄 Page clicked:', currentPage);
        updatePagination();
        updateTableDisplay();
      });
      paginationPages.appendChild(pageBtn);
    }
  }

  // Status change handlers - removed duplicate handlers, using the ones in initEventListeners

  // Role change handlers
  const changeRoleBtns = document.querySelectorAll(".change-role")

  if (changeRoleBtns.length > 0) {
    changeRoleBtns.forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.preventDefault()
        const userId = this.getAttribute("data-id")
        const row =
          document.querySelector(`.users-row[data-id="${userId}"]`) || document.querySelector(`tr[data-id="${userId}"]`)
        const roleBadge = row?.querySelector(".role-badge")
        const isCurrentlyAdmin = roleBadge && roleBadge.classList.contains("admin")

        const newRole = isCurrentlyAdmin ? 0 : 1
        const confirmMessage = isCurrentlyAdmin
          ? "Weet je zeker dat je deze gebruiker wilt degraderen naar een gewone gebruiker?"
          : "Weet je zeker dat je deze gebruiker wilt promoveren naar admin?"

        showConfirmDialog(confirmMessage, () => {
          fetch(`/admin/api/users/${userId}/role`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: 'include', // Include cookies for authentication
            body: JSON.stringify({ is_admin: newRole }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                window.showNotification(data.message || "Gebruikersrol bijgewerkt!", "success")
                window.location.reload()
              } else {
                window.showNotification("Fout: " + (data.message || "Er is een fout opgetreden"), "error")
              }
            })
            .catch((error) => {
              console.error("Fout:", error)
              window.showNotification("Er is een fout opgetreden", "error")
            })
        })
      })
    })
  }

  // Reset password handler
  const resetPasswordBtns = document.querySelectorAll(".reset-password")

  if (resetPasswordBtns.length > 0) {
    resetPasswordBtns.forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.preventDefault()
        const userId = this.getAttribute("data-id")

        showConfirmDialog("Weet je zeker dat je een wachtwoord reset wilt versturen naar deze gebruiker?", () => {
          fetch(`/admin/api/users/${userId}/reset-password`, {
            method: "POST",
            credentials: 'include', // Include cookies for authentication
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                window.showNotification(data.message || "Wachtwoord reset link verstuurd!", "success")
              } else {
                window.showNotification("Fout: " + (data.message || "Er is een fout opgetreden"), "error")
              }
            })
            .catch((error) => {
              console.error("Fout:", error)
              window.showNotification("Er is een fout opgetreden", "error")
            })
        })
      })
    })
  }

  // Functie om het verwijderbevestigingsvenster te tonen
  function showDeleteConfirmation(users) {
    console.log("showDeleteConfirmation aangeroepen met gebruikers:", users)

    // Make sure users is an array and has valid IDs
    if (!Array.isArray(users)) {
      users = [users]
    }

    // Zorg ervoor dat alle gebruikers een geldig ID hebben
    users = users.filter((user) => user && user.id)

    // Debug logging
    console.log("Na filtering:", users.length, "geldige gebruikers")
    if (users.length > 0) {
      console.log("Eerste gebruiker:", JSON.stringify(users[0]))
    }

    if (users.length === 0) {
      console.error("Geen geldige gebruikers om te verwijderen")
      window.showNotification("Geen geldige gebruikers om te verwijderen", "warning")
      return
    }

    // Zorg ervoor dat de modal bestaat
    createDeleteConfirmModal()

    // Haal referenties op naar de modale dialoog
    const deleteModal = document.getElementById("deleteConfirmModal")
    if (!deleteModal) {
      console.error("Delete confirmation modal niet gevonden!")
      // Fallback naar standaard bevestiging
      showConfirmDialog(`Weet je zeker dat je ${users.length} gebruiker(s) wilt verwijderen?`, () => {
        const userIds = users.map((user) => user.id)
        if (userIds.length === 1) {
          deleteUser(userIds[0])
        } else {
          performBulkAction("delete", userIds)
        }
      })
      return
    }

    // Maak de HTML voor de gebruikerslijst
    const userListContainer = deleteModal.querySelector(".delete-users-list")
    if (userListContainer) {
      let userListHTML = ""
      users.forEach((user) => {
        const roleBadge = user.is_admin
          ? '<span class="role-badge admin">Admin</span>'
          : '<span class="role-badge user">Gebruiker</span>'

        userListHTML += `
          <div class="delete-user-item">
            <div class="delete-user-info">
              <div class="delete-user-name">${user.company_name || "Onbekend"}</div>
              <div class="delete-user-email">${user.email || `Gebruiker ${user.id}`}</div>
            </div>
            <div class="delete-user-role">
              ${roleBadge}
            </div>
          </div>
        `
      })

      userListContainer.innerHTML = userListHTML
    }

    // Haal referenties op naar de knoppen
    const closeBtn = deleteModal.querySelector(".modal-close")
    const cancelBtn = document.getElementById("cancelDelete")
    const confirmBtn = document.getElementById("confirmDelete")

    // Verwijder bestaande event listeners om dubbele uitvoering te voorkomen
    if (closeBtn) {
      const newCloseBtn = closeBtn.cloneNode(true)
      closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn)
    }

    if (cancelBtn) {
      const newCancelBtn = cancelBtn.cloneNode(true)
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn)
    }

    if (confirmBtn) {
      const newConfirmBtn = confirmBtn.cloneNode(true)
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn)
    }

    // Toon de modale dialoog
    deleteModal.style.display = "block"

    // Event listeners voor het sluiten van de modale dialoog
    const updatedCloseBtn = deleteModal.querySelector(".modal-close")
    if (updatedCloseBtn) {
      updatedCloseBtn.addEventListener("click", () => {
        deleteModal.style.display = "none"
      })
    }

    const updatedCancelBtn = document.getElementById("cancelDelete")
    if (updatedCancelBtn) {
      updatedCancelBtn.addEventListener("click", () => {
        deleteModal.style.display = "none"
      })
    }

    // Event listener voor het bevestigen van het verwijderen
    const updatedConfirmBtn = document.getElementById("confirmDelete")
    if (updatedConfirmBtn) {
      updatedConfirmBtn.addEventListener("click", () => {
        const userIds = users.map((user) => user.id).filter((id) => id) // Filter out any undefined IDs
        console.log("Bevestigd verwijderen van gebruikers:", userIds)

        if (userIds.length === 0) {
          window.showNotification("Geen geldige gebruikers om te verwijderen", "warning")
          deleteModal.style.display = "none"
          return
        }

        if (userIds.length === 1) {
          // Enkele gebruiker verwijderen
          deleteUser(userIds[0])
        } else {
          // Bulk verwijderen
          performBulkAction("delete", userIds)
        }

        deleteModal.style.display = "none"
      })
    }

    // Sluit de modale dialoog als er buiten wordt geklikt
    const clickOutsideHandler = (event) => {
      if (event.target === deleteModal) {
        deleteModal.style.display = "none"
        // Verwijder deze event listener na gebruik
        window.removeEventListener("click", clickOutsideHandler)
      }
    }

    window.addEventListener("click", clickOutsideHandler)
  }

  // Functie om de view modal te sluiten
  window.closeViewModal = function() {
    const modal = document.getElementById("userViewModal")
    if (modal) {
      modal.style.display = "none"
    }
  }

  // Server-side pagination: reload page with new query parameters
  function loadPage(page, itemsPerPage) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page);
    url.searchParams.set('itemsPerPage', itemsPerPage);
    window.location.href = url.toString();
  }

  // Initialize server-side pagination
  function initServerPagination() {
    // Items per page selector
    const itemsPerPageSelect = document.getElementById('itemsPerPage');
    if (itemsPerPageSelect) {
      itemsPerPageSelect.addEventListener('change', function(e) {
        const itemsPerPage = parseInt(e.target.value);
        loadPage(1, itemsPerPage); // Reset to page 1 when changing items per page
      });
    }

    // Previous button
    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        const urlParams = new URLSearchParams(window.location.search);
        const currentPage = parseInt(urlParams.get('page')) || 1;
        const itemsPerPage = parseInt(urlParams.get('itemsPerPage')) || 10;
        if (currentPage > 1) {
          loadPage(currentPage - 1, itemsPerPage);
        }
      });
    }

    // Next button
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        const urlParams = new URLSearchParams(window.location.search);
        const currentPage = parseInt(urlParams.get('page')) || 1;
        const itemsPerPage = parseInt(urlParams.get('itemsPerPage')) || 10;
        loadPage(currentPage + 1, itemsPerPage);
      });
    }

    // Page number buttons
    const pageButtons = document.querySelectorAll('.pagination-number');
    pageButtons.forEach(btn => {
      btn.addEventListener('click', function() {
        const page = parseInt(this.getAttribute('data-page'));
        const urlParams = new URLSearchParams(window.location.search);
        const itemsPerPage = parseInt(urlParams.get('itemsPerPage')) || 10;
        loadPage(page, itemsPerPage);
      });
    });
  }

  // Initialize server-side pagination on page load
  initServerPagination();

  // Functie om de gebruikerslijst dynamisch bij te werken
  async function updateUsersList() {
    try {
      // Gebruik het bestaande endpoint dat de gebruikerslijst teruggeeft
      const response = await fetch('/admin/users')
      if (!response.ok) throw new Error('Fout bij ophalen gebruikers')
      
      // Parse de HTML response
      const html = await response.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      
      // Haal de gebruikerslijst op uit de HTML
      const usersTableBody = document.querySelector('.users-table-body')
      const newUsersTableBody = doc.querySelector('.users-table-body')
      
      if (usersTableBody && newUsersTableBody) {
        // Bewaar de huidige scrollpositie
        const scrollPosition = window.scrollY
        
        // Update de HTML
        usersTableBody.innerHTML = newUsersTableBody.innerHTML
        
        // Herstel de scrollpositie
        window.scrollTo(0, scrollPosition)
        
        // Herinitialiseer event listeners
        initEventListeners()
        
        // Reset pagination and update
        currentPage = 1;
        const newTableRows = document.querySelectorAll(".users-table tbody tr, .users-table-body .users-row, .users-row");
        allUsers.length = 0;
        allUsers.push(...Array.from(newTableRows));
        filteredUsers = [...allUsers];
        
        // Update counters and pagination
        updateCounters()
        updatePagination()
        updateTableDisplay()
      }
    } catch (error) {
      console.error('Fout bij bijwerken gebruikerslijst:', error)
      // Verwijder eventuele bestaande notificaties
      const notifications = document.querySelectorAll('.notification')
      notifications.forEach(notification => notification.remove())
      window.showNotification('Er is een fout opgetreden bij het bijwerken van de gebruikerslijst', 'error')
    }
  }

  // Functie om event listeners te initialiseren
  function initEventListeners() {
    // Edit user buttons
    document.querySelectorAll('.edit-user').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault()
        const userId = this.getAttribute('data-id')
        window.openEditModal(userId)
      })
    })

    // View user buttons
    document.querySelectorAll('.view-user').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault()
        const userId = this.getAttribute('data-id')
        viewUser(userId)
      })
    })

    // Delete user buttons
    document.querySelectorAll('.delete-user').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault()
        const userId = this.getAttribute('data-id')
        showDeleteConfirmation([{ id: userId }])
      })
    })

    // Activate/Deactivate user buttons
    document.querySelectorAll('.activate-user, .deactivate-user').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault()
        const userId = this.getAttribute('data-id')
        const action = this.classList.contains('activate-user') ? 'activate' : 'deactivate'
        const status = action === 'activate' ? 'active' : 'inactive'
        
        fetch(`/admin/api/users/${userId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include', // Include cookies for authentication
          body: JSON.stringify({ status })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            window.showNotification(data.message || `Gebruiker succesvol ${action === 'activate' ? 'geactiveerd' : 'gedeactiveerd'}!`, 'success')
            updateUsersList()
          } else {
            // Handle specific error cases for outstanding payments
            if (data.outstandingPayments || data.pendingMandates) {
              let errorMessage = data.error;
              if (data.outstandingPayments > 0) {
                const amount = parseFloat(data.totalAmount) || 0;
                errorMessage += `\n\nOpenstaande betalingen: ${data.outstandingPayments} (€${amount.toFixed(2)})`;
              }
              if (data.pendingMandates > 0) {
                errorMessage += `\n\nOpenstaande SEPA mandaten: ${data.pendingMandates}`;
              }
              errorMessage += '\n\nLos eerst de openstaande betalingen op voordat je de status kunt wijzigen.';
              window.showNotification(errorMessage, 'error');
            } else {
              window.showNotification(data.error || `Er is een fout opgetreden bij het ${action === 'activate' ? 'activeren' : 'deactiveren'} van de gebruiker`, 'error');
            }
          }
        })
        .catch(error => {
          console.error('Fout:', error)
          window.showNotification(`Er is een fout opgetreden bij het ${action === 'activate' ? 'activeren' : 'deactiveren'} van de gebruiker`, 'error')
        })
      })
    })
  }
})

// =====================================================
// VIEW USER FUNCTIONALITY
// =====================================================

// View user function
async function viewUser(userId) {
  console.log(`🔍 Viewing user with ID: ${userId}`);
  
  try {
    // Show loading state
    const modal = document.getElementById('userViewModal');
    if (!modal) {
      console.error('View user modal not found');
      return;
    }
    
    // Show modal immediately with loading state
    modal.style.display = 'block';
    modal.classList.add('show');
    
    // Lock body scroll
    lockBodyScroll();
    
    // Set loading content
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.innerHTML = `
        <div class="modal-header">
          <h2>Gebruiker bekijken</h2>
          <span class="modal-close">&times;</span>
        </div>
        <div class="modal-body">
          <div class="loading-spinner">Laden...</div>
        </div>
      `;
    }
    
    // Fetch user data
    const response = await fetch(`/admin/api/users/${userId}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const user = data.user || data;
    
    if (!user) {
      throw new Error('Geen gebruikersgegevens gevonden');
    }
    
    // Populate modal with user data
    if (modalContent) {
      modalContent.innerHTML = `
        <div class="modal-header">
          <h2>Gebruiker bekijken</h2>
          <span class="modal-close">&times;</span>
        </div>
        <div class="modal-body">
          <div class="user-details">
            <div class="detail-row">
              <label>Naam:</label>
              <span>${user.first_name || ''} ${user.last_name || ''}</span>
            </div>
            <div class="detail-row">
              <label>Email:</label>
              <span>${user.email || ''}</span>
            </div>
            <div class="detail-row">
              <label>Bedrijf:</label>
              <span>${user.company_name || 'Niet opgegeven'}</span>
            </div>
            <div class="detail-row">
              <label>Telefoon:</label>
              <span>${user.phone || 'Niet opgegeven'}</span>
            </div>
            <div class="detail-row">
              <label>Status:</label>
              <span class="status-badge status-${user.status || 'active'}">${user.status || 'active'}</span>
            </div>
            <div class="detail-row">
              <label>Rol:</label>
              <span>${user.is_admin ? 'Admin' : 'Gebruiker'}</span>
            </div>
            <div class="detail-row">
              <label>Geregistreerd:</label>
              <span>${user.created_at ? new Date(user.created_at).toLocaleDateString('nl-NL') : 'Onbekend'}</span>
            </div>
            <div class="detail-row">
              <label>Laatste login:</label>
              <span>${user.last_login ? new Date(user.last_login).toLocaleDateString('nl-NL') : 'Nog nooit ingelogd'}</span>
            </div>
            ${user.outstandingPayments && user.outstandingPayments.count > 0 ? `
            <div class="detail-row">
              <label>Openstaande betalingen:</label>
              <span class="warning">${user.outstandingPayments.count} betalingen (€${user.outstandingPayments.total || 0})</span>
            </div>
            ` : ''}
            ${user.pendingMandates && user.pendingMandates > 0 ? `
            <div class="detail-row">
              <label>Wachtende SEPA mandaten:</label>
              <span class="warning">${user.pendingMandates}</span>
            </div>
            ` : ''}
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-close">Sluiten</button>
        </div>
      `;
    }
    
    // Add event listeners for close buttons
    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        closeViewModal();
      });
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeViewModal();
      }
    });
    
  } catch (error) {
    console.error('Error viewing user:', error);
    
    // Show error in modal
    const modal = document.getElementById('userViewModal');
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.innerHTML = `
        <div class="modal-header">
          <h2>Fout</h2>
          <span class="modal-close">&times;</span>
        </div>
        <div class="modal-body">
          <p class="error">Er is een fout opgetreden bij het ophalen van de gebruikersgegevens.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-close">Sluiten</button>
        </div>
      `;
    }
    
    // Add event listeners for close buttons
    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        closeViewModal();
      });
    });
  }
}

// Close view modal function
function closeViewModal() {
  const modal = document.getElementById('userViewModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('show');
    
    // Unlock body scroll
    unlockBodyScroll();
  }
}

// Body scroll management functions
let scrollY = 0;

function lockBodyScroll() {
  scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockBodyScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, scrollY);
}

// Make viewUser function globally available
window.viewUser = viewUser;

// ============================================
// USER DETAIL PAGE - MODAL FUNCTIONS
// ============================================

// Modal Functions
function openBlockModal() {
  const modal = document.getElementById('blockModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeBlockModal() {
  const modal = document.getElementById('blockModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeBlockModal();
  }
});

// Handle approve form submission
function handleApprove(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  fetch(form.action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      approved: true
    }),
    credentials: 'include'
  })
  .then(response => {
    if (response.ok) {
      window.location.reload();
    } else {
      alert('Fout bij goedkeuren gebruiker');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Fout bij goedkeuren gebruiker');
  });
  
  return false;
}

// Handle block form submission
function handleBlock(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const reason = formData.get('reason') || '';
  
  if (!confirm('Weet je zeker dat je deze gebruiker wilt blokkeren?')) {
    return false;
  }
  
  fetch(form.action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      blocked: true,
      reason: reason
    }),
    credentials: 'include'
  })
  .then(response => {
    if (response.ok) {
      window.location.reload();
    } else {
      alert('Fout bij blokkeren gebruiker');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Fout bij blokkeren gebruiker');
  });
  
  return false;
}

// Risk Analyse Modal Functions
let currentRiskAssessmentUserId = null;

function openRiskAssessmentModal(userId) {
  currentRiskAssessmentUserId = userId;
  const modal = document.getElementById('riskAssessmentModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeRiskAssessmentModal() {
  const modal = document.getElementById('riskAssessmentModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
  currentRiskAssessmentUserId = null;
}

function confirmRiskAssessment() {
  if (!currentRiskAssessmentUserId) {
    return;
  }

  // Hide buttons and show loading state
  const modalBody = document.querySelector('.risk-assessment-modal-body');
  const originalContent = modalBody.innerHTML;
  
  // Show loading state with progress steps
  modalBody.innerHTML = `
    <div class="risk-assessment-loading">
      <div class="risk-assessment-progress">
        <div class="risk-assessment-progress-step" id="step1">
          <div class="risk-assessment-progress-icon">
            <i class="fas fa-search"></i>
          </div>
          <div class="risk-assessment-progress-content">
            <div class="risk-assessment-progress-title">Zoeken naar bedrijfsinformatie...</div>
            <div class="risk-assessment-progress-description">Website, reviews en social media worden opgezocht</div>
          </div>
          <div class="risk-assessment-progress-status">
            <i class="fas fa-spinner fa-spin"></i>
          </div>
        </div>
        <div class="risk-assessment-progress-step" id="step2">
          <div class="risk-assessment-progress-icon">
            <i class="fas fa-brain"></i>
          </div>
          <div class="risk-assessment-progress-content">
            <div class="risk-assessment-progress-title">Analyseren met AI...</div>
            <div class="risk-assessment-progress-description">Risicobeoordeling wordt uitgevoerd</div>
          </div>
          <div class="risk-assessment-progress-status">
            <i class="fas fa-circle" style="opacity: 0.3;"></i>
          </div>
        </div>
        <div class="risk-assessment-progress-step" id="step3">
          <div class="risk-assessment-progress-icon">
            <i class="fas fa-save"></i>
          </div>
          <div class="risk-assessment-progress-content">
            <div class="risk-assessment-progress-title">Resultaten opslaan...</div>
            <div class="risk-assessment-progress-description">Beoordeling wordt opgeslagen</div>
          </div>
          <div class="risk-assessment-progress-status">
            <i class="fas fa-circle" style="opacity: 0.3;"></i>
          </div>
        </div>
      </div>
    </div>
  `;

  // Simulate progress updates (we can't get real-time updates without SSE/WebSockets)
  let currentStep = 1;
  const steps = ['step1', 'step2', 'step3'];
  
  const updateStep = (stepIndex, status) => {
    const step = document.getElementById(steps[stepIndex]);
    if (!step) return;
    
    const statusIcon = step.querySelector('.risk-assessment-progress-status i');
    if (status === 'active') {
      statusIcon.className = 'fas fa-spinner fa-spin';
      step.classList.add('active');
    } else if (status === 'completed') {
      statusIcon.className = 'fas fa-check';
      step.classList.add('completed');
      step.classList.remove('active');
    }
  };

  // Start with step 1
  updateStep(0, 'active');

  fetch(`/admin/api/users/${currentRiskAssessmentUserId}/assess-risk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  })
  .then(response => {
    // Step 1 completed, move to step 2
    updateStep(0, 'completed');
    updateStep(1, 'active');
    
    if (!response.ok) {
      return response.json().then(data => {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      });
    }
    return response.json();
  })
  .then(data => {
    // Step 2 completed, move to step 3
    updateStep(1, 'completed');
    updateStep(2, 'active');
    
    // Small delay to show step 3
    setTimeout(() => {
      updateStep(2, 'completed');
      
      if (data.success) {
        // Show success message briefly before reloading
        setTimeout(() => {
          closeRiskAssessmentModal();
          window.location.reload();
        }, 500);
      } else {
        // Show error message
        const modalBody = document.querySelector('.risk-assessment-modal-body');
        const errorText = data.error || data.details || 'Onbekende fout opgetreden';
        modalBody.innerHTML = `
        <div class="risk-assessment-error">
          <div class="risk-assessment-error-icon">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <h3 class="risk-assessment-error-title">Fout bij Analyse</h3>
          <p class="risk-assessment-error-text">${errorText}</p>
          ${data.details && data.details !== errorText ? `<p class="risk-assessment-error-details" style="font-size: 0.9em; color: #666; margin-top: 0.5rem;">Details: ${data.details}</p>` : ''}
          <button class="risk-assessment-modal-btn risk-assessment-modal-btn-cancel" onclick="closeRiskAssessmentModal()" style="width: 100%; margin-top: 1rem;">
            Sluiten
          </button>
        </div>
      `;
      }
    }, 1000);
  })
  .catch(error => {
    console.error('Error:', error);
    const modalBody = document.querySelector('.risk-assessment-modal-body');
    const errorMessage = error.message || 'Er is een fout opgetreden bij het uitvoeren van de analyse.';
    modalBody.innerHTML = `
      <div class="risk-assessment-error">
        <div class="risk-assessment-error-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <h3 class="risk-assessment-error-title">Fout bij Analyse</h3>
        <p class="risk-assessment-error-text">${errorMessage}</p>
        <button class="risk-assessment-modal-btn risk-assessment-modal-btn-cancel" onclick="closeRiskAssessmentModal()" style="width: 100%; margin-top: 1rem;">
          Sluiten
        </button>
      </div>
    `;
  });
}

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeRiskAssessmentModal();
  }
});

// Initialize trust score gauge charts
function initializeTrustScoreGauges() {
  const gauges = document.querySelectorAll('.trust-score-gauge-progress');
  
  gauges.forEach(gauge => {
    const score = parseFloat(gauge.getAttribute('data-score')) || 0;
    const radius = 48; // Updated for new viewBox="0 0 120 120" design
    const circumference = 2 * Math.PI * radius;
    
    // Set up the circle for animation
    gauge.setAttribute('stroke-dasharray', circumference);
    
    // Start from 0 (fully hidden)
    const startOffset = circumference * (0 / 100 - 1); // = -circumference
    gauge.setAttribute('stroke-dashoffset', startOffset);
    
    // Add CSS transition
    gauge.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Trigger animation after a brief delay
    setTimeout(() => {
      // Calculate CORRECT offset for clockwise fill
      const normalizedScore = Math.max(0, Math.min(100, score));
      const endOffset = circumference * (normalizedScore / 100 - 1);
      gauge.setAttribute('stroke-dashoffset', endOffset);
      
      // Animate the number too
      animateNumber(gauge, normalizedScore);
    }, 100);
  });
}

// Helper function to animate the number
function animateNumber(gauge, targetScore) {
  // Find the score number element
  const scoreElement = gauge.closest('.trust-score-gauge-wrapper')
    ?.querySelector('.trust-score-gauge-number');
  
  if (!scoreElement) return;
  
  const duration = 1500; // 1.5 seconds
  const start = 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Cubic bezier easing (same as CSS)
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    const current = Math.round(start + (targetScore - start) * eased);
    scoreElement.textContent = current;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

// Make replay function globally available
window.replayGaugeAnimation = function() {
  // Reset all gauges first
  const gauges = document.querySelectorAll('.trust-score-gauge-progress');
  gauges.forEach(gauge => {
    const radius = 48;
    const circumference = 2 * Math.PI * radius;
    const startOffset = circumference * (0 / 100 - 1);
    gauge.setAttribute('stroke-dashoffset', startOffset);
    
    // Reset number display
    const scoreElement = gauge.closest('.trust-score-gauge-wrapper')
      ?.querySelector('.trust-score-gauge-number');
    if (scoreElement) {
      scoreElement.textContent = '0';
    }
  });
  
  // Re-run the initialization to restart animation
  setTimeout(() => {
    initializeTrustScoreGauges();
  }, 50);
};

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTrustScoreGauges);
} else {
  initializeTrustScoreGauges();
}

// Tab functionality
function initUserTabs() {
  const tabButtons = document.querySelectorAll('.user-tab-btn');
  const tabContents = document.querySelectorAll('.user-tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Remove active class from all buttons
      tabButtons.forEach(btn => btn.classList.remove('user-tab-active'));
      // Add active class to clicked button
      button.classList.add('user-tab-active');
      
      // Hide all tab contents
      tabContents.forEach(content => {
        content.style.display = 'none';
      });
      
      // Show selected tab content
      const selectedContent = document.getElementById(`tab-${tabName}`);
      if (selectedContent) {
        selectedContent.style.display = 'block';
      }
    });
  });
}

// Make user info card and quick stats card evenly tall
function equalizeCardHeights() {
  const userInfoCard = document.querySelector('.user-detail-main-new .user-card:first-child');
  const quickStatsCard = document.querySelector('.user-detail-sidebar-new .user-card:first-child');
  
  if (userInfoCard && quickStatsCard) {
    // Reset heights first
    userInfoCard.style.height = 'auto';
    quickStatsCard.style.height = 'auto';
    
    // Get the maximum height
    const userInfoHeight = userInfoCard.offsetHeight;
    const quickStatsHeight = quickStatsCard.offsetHeight;
    const maxHeight = Math.max(userInfoHeight, quickStatsHeight);
    
    // Set both to the maximum height
    userInfoCard.style.height = maxHeight + 'px';
    quickStatsCard.style.height = maxHeight + 'px';
  }
}

// Initialize tabs on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initUserTabs();
    // Wait a bit for layout to settle, then equalize heights
    setTimeout(equalizeCardHeights, 100);
    // Also equalize on window resize
    window.addEventListener('resize', equalizeCardHeights);
  });
} else {
  initUserTabs();
  setTimeout(equalizeCardHeights, 100);
  window.addEventListener('resize', equalizeCardHeights);
}

// Make functions globally available
window.openBlockModal = openBlockModal;
window.closeBlockModal = closeBlockModal;
window.handleApprove = handleApprove;
window.handleBlock = handleBlock;
window.openRiskAssessmentModal = openRiskAssessmentModal;
window.closeRiskAssessmentModal = closeRiskAssessmentModal;
window.confirmRiskAssessment = confirmRiskAssessment;

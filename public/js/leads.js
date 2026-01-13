// Define the hideLeadDetailsPopup function globally at the top of the file
function hideLeadDetailsPopup() {
  const popup = document.getElementById("leadDetailsPopup");
  if (popup) {
    popup.classList.remove("active");
    log("Popup closed successfully");
  } else {
    console.error("Popup element not found");
  }
}

// Update the saveLeadsToStorage function to ensure it properly saves all lead data
function saveLeadsToStorage(leads) {
  try {
    // Make sure we're saving complete lead objects with all necessary properties
    const completeLeads = leads.map((lead) => {
      return {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        date: lead.date,
        status: lead.status,
        message: lead.message,
        amount: Number.parseInt(lead.amount || 0, 10),
        created_at: lead.created_at || new Date().toISOString(),
      }
    })

    localStorage.setItem("savedLeads", JSON.stringify(completeLeads))
    log("Leads opgeslagen in localStorage:", completeLeads.length)
return true;
  } catch (error) {
    console.error("Fout bij opslaan van leads in localStorage:", error)
return false;
  }
}

// Functie om leads op te halen uit localStorage
function getLeadsFromStorage() {
  try {
    const savedLeads = localStorage.getItem("savedLeads")
    if (savedLeads) {
      const leads = JSON.parse(savedLeads)
      log("Leads opgehaald uit localStorage:", leads.length)

      // Validate the leads data
      if (Array.isArray(leads) && leads.length > 0) {
return leads;
      } else {
        logWarn("Opgehaalde leads zijn geen array of leeg")
      }
    } else {
      log("Geen leads gevonden in localStorage")
    }
return null;
  } catch (error) {
    console.error("Fout bij ophalen van leads uit localStorage:", error)
    // Clear potentially corrupted data
    localStorage.removeItem("savedLeads")
return null;
  }
}

// Improve the collectLeadsFromTable function to ensure it captures all necessary data
function collectLeadsFromTable() {
  const leads = []
  const rows = document.querySelectorAll("#allLeadsTable tbody tr.lead-row")

  rows.forEach((row) => {
    // Get all data attributes from the row
    const lead = {
      id: row.getAttribute("data-lead-id"),
      name: row.getAttribute("data-lead-name"),
      email: row.getAttribute("data-lead-email"),
      phone: row.getAttribute("data-lead-phone"),
      date: row.getAttribute("data-lead-date"),
      status: row.getAttribute("data-lead-status"),
      message: row.getAttribute("data-lead-message"),
      amount: Number.parseInt(row.getAttribute("data-lead-amount") || "0", 10),
      // Add any other attributes that might be needed
    }

    // Ensure all required properties exist
if (!lead.status) lead.status = "new"; // Default status
if (!lead.amount) lead.amount = 0; // Default amount

    leads.push(lead)
  })

return leads;
}

// Improve the updateTableWithSavedLeads function to ensure it correctly applies saved statuses
function updateTableWithSavedLeads() {
  const savedLeads = getLeadsFromStorage()
  if (!savedLeads || savedLeads.length === 0) {
    log("Geen opgeslagen leads gevonden")
return false;
  }

  // Map leads by ID for easy lookup
  const leadMap = {}
  savedLeads.forEach((lead) => {
leadMap[lead.id] = lead;
  })

  // Update each row with saved data
  const rows = document.querySelectorAll("#allLeadsTable tbody tr.lead-row")
  rows.forEach((row) => {
    const leadId = row.getAttribute("data-lead-id")
    const savedLead = leadMap[leadId]

    if (savedLead) {
      // Update row attributes with the saved data
      row.setAttribute("data-lead-status", savedLead.status)
      row.setAttribute("data-lead-amount", savedLead.amount || 0)

      // Also update any other attributes that might be needed
      if (savedLead.name) row.setAttribute("data-lead-name", savedLead.name)
      if (savedLead.email) row.setAttribute("data-lead-email", savedLead.email)
      if (savedLead.phone) row.setAttribute("data-lead-phone", savedLead.phone)
      if (savedLead.date) row.setAttribute("data-lead-date", savedLead.date)
      if (savedLead.message) row.setAttribute("data-lead-message", savedLead.message)

      // Update status badge
      const badgeCell = row.querySelector("td:last-child")
      if (badgeCell) {
        switch (savedLead.status) {
          case "new":
            badgeCell.innerHTML = '<span class="badge badge-warning">Nieuw</span>';
            break;
          case "accepted":
            badgeCell.innerHTML = '<span class="badge badge-success">Geaccepteerd</span>';
            break;
          case "rejected":
            badgeCell.innerHTML = '<span class="badge badge-danger">Afgewezen</span>';
            break;
          default:
            badgeCell.innerHTML = `<span class="badge badge-secondary">${savedLead.status}</span>`;
            break;
        }
      }
    }
  })

  // Update other tabs as well
  updateFilteredTables()

  // Update statistics and revenue
  updateLeadStatistics()
  updateEstimatedRevenue()

  log("Tabel bijgewerkt met opgeslagen leads")
return true;
}

// Improve the updateFilteredTables function to ensure it correctly updates all tabs
function updateFilteredTables() {
  const tables = ["newLeadsTable", "acceptedLeadsTable", "rejectedLeadsTable"]

  tables.forEach((tableId) => {
    const table = document.getElementById(tableId)
    if (!table) return

    const tbody = table.querySelector("tbody")
    if (!tbody) return

    // Clear the table
    tbody.innerHTML = ""

    // Get all leads from main table with matching status
    const status =
      tableId === "newLeadsTable"
        ? "new"
        : tableId === "acceptedLeadsTable"
          ? "accepted"
          : tableId === "rejectedLeadsTable"
            ? "rejected"
: null;

    if (!status) return

    // Get matching rows from main table
    const mainTable = document.getElementById("allLeadsTable")
    if (!mainTable) return

    const matchingRows = mainTable.querySelectorAll(`tbody tr.lead-row[data-lead-status="${status}"]`)
    log(`Found ${matchingRows.length} rows with status ${status} for ${tableId}`)

    // Clone and add to filtered table
    matchingRows.forEach((row) => {
      const clone = row.cloneNode(true)
      tbody.appendChild(clone)

      // Re-add click event listener - navigate to detail page
      clone.addEventListener("click", function (e) {
        // Don't navigate if clicking on the view button (it has its own link)
        if (e.target.closest('.view-lead')) {
          return; // Let the link handle navigation
        }
        
        const leadId = this.getAttribute("data-lead-id");
        if (leadId) {
          // Navigate to the new lead details page
          window.location.href = `/dashboard/leads/${leadId}`;
        }
      })
    })

    // Update the tab badge count
    const tabId = tableId.replace("Table", "-tab")
    const tabBadge = document.querySelector(`#${tabId} .badge`)
    if (tabBadge) {
tabBadge.textContent = matchingRows.length;
    }
  })

  // Update statistics after updating filtered tables
  updateLeadStatistics()
}

// Conditional logging (quiet by default). Enable with window.GS_DEBUG = true or localStorage.GS_DEBUG='true'
const isDev = !!(window.GS_DEBUG || (typeof localStorage !== 'undefined' && localStorage.getItem('GS_DEBUG') === 'true'));
const log = isDev ? console.log.bind(console) : function(){};
const logError = console.error.bind(console); // Always log errors
const logWarn = isDev ? console.warn.bind(console) : function(){};

// Debounce function for performance optimization
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Onmiddellijk uitgevoerde functie om ervoor te zorgen dat de schuifregelaar werkt
;(() => {
  log("Schuifregelaar script wordt geladen...")


  // Globale variabele om de originele tabeldata op te slaan
  const originalTableData = {}

  // Functie om de schuifregelaar functionaliteit te initialiseren
  function initSlider() {
    log("Initialiseren van de schuifregelaar...")

    // Controleer of we in een iframe zitten
const isInIframe = window !== window.parent;

    if (isInIframe) {
      log("We zitten in een iframe, initialisatie wordt overgeslagen")
      return
    }

    // Selecteer de benodigde elementen
    const slider = document.getElementById("leadLimitSlider")
    if (!slider) {
      log("Slider element niet gevonden, initialisatie overgeslagen")
      return
    }

    // Direct de progress bar updaten met de huidige waarde uit de HTML
    // Dit voorkomt dat het bolletje springt van 0 naar de juiste waarde
    const sliderContainer = slider.closest('.modern-slider-container') || slider.parentElement
    if (sliderContainer) {
      const progressBar = sliderContainer.querySelector(".modern-slider-progress")
      if (progressBar && slider.value) {
        const value = Number.parseInt(slider.value, 10)
        const max = Number.parseInt(slider.max, 10)
        const percentage = (value / max) * 100
        progressBar.style.cssText = `width: ${percentage}% !important`
        log("Progress bar direct geïnitialiseerd:", `${percentage}%`)
      }
    }

    const currentValue = document.getElementById("currentValue")
    const currentValueText = document.getElementById("currentValueText")
    const saveButton = document.getElementById("saveLeadLimit")
    const limitText = document.getElementById("leadLimitText")
    const manualInput = document.getElementById("leadLimitInput")

    // Log de gevonden elementen voor debugging
    log("Slider element:", slider)
    log("Current value element:", currentValue)
    log("Save button:", saveButton)

    // Controleer of alle benodigde elementen bestaan
    if (!currentValue || !currentValueText || !saveButton) {
      // Silent return - elementen niet aanwezig op deze pagina (normaal)
      return
    }

    // Zorg ervoor dat de container en progressiebalk correct zijn ingesteld
    setupSliderContainer()
    
    // Update de progress bar direct met de huidige waarde uit de HTML
    // Dit voorkomt dat het bolletje springt van 0 naar de juiste waarde
    updateProgressBar()

    // Functie om de slider container en progressiebalk op te zetten
    function setupSliderContainer() {
      // Zoek de container of maak deze aan
let sliderContainer = slider.parentElement;

      // Controleer of de container de juiste klasse heeft
      if (!sliderContainer.classList.contains("modern-slider-container")) {
        log("Container heeft niet de juiste klasse, wrapping slider...")

        // Maak een nieuwe container
        const newContainer = document.createElement("div")
        newContainer.className = "modern-slider-container"

        // Plaats de slider in de nieuwe container
        slider.parentNode.insertBefore(newContainer, slider)
        newContainer.appendChild(slider)

sliderContainer = newContainer;
      }

      // Verwijder bestaande progressiebalk als deze bestaat
      const existingProgressBar = sliderContainer.querySelector(".modern-slider-progress")
      if (existingProgressBar) {
        sliderContainer.removeChild(existingProgressBar)
      }

      // Maak een nieuwe progressiebalk
      const progressBar = document.createElement("div")
      progressBar.className = "modern-slider-progress"
      sliderContainer.appendChild(progressBar)

      log("Slider container en progressiebalk zijn opgezet")
    }

    // Update the updateProgressBar function to ensure it uses the exact slider value

    // Functie om de progressiebalk bij te werken
    function updateProgressBar() {
      const progressBar = document.querySelector(".modern-slider-progress")
      if (progressBar && slider) {
        const value = Number.parseInt(slider.value, 10)
        const max = Number.parseInt(slider.max, 10)
const percentage = (value / max) * 100;

        // Zet de breedte direct met !important
        progressBar.style.cssText = `width: ${percentage}% !important`
        log("Progressiebalk bijgewerkt:", `${percentage}%`)
      }
    }

    // Functie om de tekst onder de slider bij te werken
    function updateLimitText(value) {
      if (limitText) {
        if (value === 0) {
          limitText.textContent = "Geen limiet ingesteld"
          // Voeg extra ruimte toe met inline style voor maximale prioriteit
          limitText.style.cssText = "margin-bottom: 60px !important; padding-bottom: 20px !important;"
        } else if (value === 100) {
          limitText.textContent = "Geen limiet"
          // Voeg extra ruimte toe met inline style voor maximale prioriteit
          limitText.style.cssText = "margin-bottom: 60px !important; padding-bottom: 20px !important;"
        } else {
          limitText.textContent = `Maximaal ${value} leads per maand`
          // Voeg extra ruimte toe met inline style voor maximale prioriteit
          limitText.style.cssText = "margin-bottom: 60px !important; padding-bottom: 20px !important;"
        }
      }
    }

    // Functie om de cirkel waarde bij te werken
    function updateCircleValue(value) {
      if (currentValue) {
currentValue.textContent = value === 100 ? "∞" : value;
      }

      if (currentValueText) {
        if (value === 0) {
          currentValueText.textContent = "aanvragen per maand"
        } else if (value === 1) {
          currentValueText.textContent = "aanvraag per maand"
        } else if (value === 100) {
          currentValueText.textContent = "geen limiet aan aanvragen"
        } else {
          currentValueText.textContent = "aanvragen per maand"
        }
      }

      // Verander de kleur van de cirkel op basis van de waarde
      const limitCircle = document.querySelector(".limit-value-circle")
      if (limitCircle) {
        if (value < 25) {
          limitCircle.style.cssText = "background: linear-gradient(135deg, #ea580d, #f97316) !important"
        } else if (value < 50) {
          limitCircle.style.cssText = "background: linear-gradient(135deg, #f97316, #fb923c) !important"
        } else if (value < 75) {
          limitCircle.style.cssText = "background: linear-gradient(135deg, #fb923c, #fdba74) !important"
        } else {
          limitCircle.style.cssText = "background: linear-gradient(135deg, #fdba74, #fed7aa) !important"
        }
      }
    }

    // Functie om de opslaan knop bij te werken
    function updateSaveButton(value) {
      const saveButton = document.getElementById("saveLeadLimit")
      
      if (!saveButton) {
        log("saveButton element niet gevonden!")
        return
      }

      // Haal de originele waarde op uit localStorage
      const originalValue = parseInt(localStorage.getItem("originalLeadLimit") || "0")
const hasChanged = value !== originalValue;
        
      log(`updateSaveButton: value=${value}, originalValue=${originalValue}, hasChanged=${hasChanged}`)
        
      if (hasChanged) {
        // Knop actief maken - klikbaar en oranje
saveButton.disabled = false;
        saveButton.style.backgroundColor = "#ea5d0d"
        saveButton.style.borderColor = "#ea5d0d"
        saveButton.style.color = "#ffffff"
        saveButton.style.cursor = "pointer"
        saveButton.textContent = "Opslaan"
        log("✅ Opslaan knop GEACTIVEERD - limiet gewijzigd")
      } else {
        // Knop deactiveren - niet klikbaar en grijs
saveButton.disabled = true;
        saveButton.style.backgroundColor = "#6c757d"
        saveButton.style.borderColor = "#6c757d"
        saveButton.style.color = "#ffffff"
        saveButton.style.cursor = "not-allowed"
        saveButton.textContent = "Opslaan"
        log("❌ Opslaan knop GEDEACTIVEERD - geen wijziging")
      }
      
      log(`Knop status: disabled=${saveButton.disabled}, backgroundColor=${saveButton.style.backgroundColor}`)
    }

    // Functie om alle UI-elementen bij te werken (zonder huidige limiet)
    function updateUI(value) {
      // Ensure value is an integer
      value = Number.parseInt(value, 10)
      log("UI wordt bijgewerkt met waarde:", value)

      updateProgressBar()
      if (limitText) updateLimitText(value)
      updateCircleValue(value)
      updateSaveButton(value)
      // updateLimitStatusCard(value) - NIET tijdens slepen, alleen na opslaan

      // Update ook het handmatige invoerveld als het bestaat
      if (manualInput) {
manualInput.value = value;
      }
    }

    // Functie om de huidige limiet bij te werken (alleen na opslaan)
    function updateCurrentLimit(value) {
      updateLimitStatusCard(value)
    }

    // Test functie om de knop te activeren (voor debugging)
    window.testSaveButton = function() {
      log("Testing save button...")
      const slider = document.getElementById("leadLimitSlider")
      if (slider) {
slider.value = 50;
        updateUI(50)
        log("Slider set to 50, button should be active now")
      }
    }

    // Test functie om de huidige limiet te testen
    window.testCurrentLimit = function(value = 25) {
      log(`Testing current limit display with value: ${value}`)
      updateLimitStatusCard(value)
    }

    // Test functie om de knop te testen
    window.testButton = function() {
      log("🧪 Testing button functionality...")
      const slider = document.getElementById("leadLimitSlider")
      const saveButton = document.getElementById("saveLeadLimit")
      
      if (slider && saveButton) {
        log(`Current slider value: ${slider.value}`)
        log(`Current button disabled: ${saveButton.disabled}`)
        log(`Current button color: ${saveButton.style.backgroundColor}`)
        
        // Test: verander slider naar 50
slider.value = 50;
        updateUI(50)
        
        setTimeout(() => {
          log(`After change - button disabled: ${saveButton.disabled}`)
          log(`After change - button color: ${saveButton.style.backgroundColor}`)
        }, 100)
      }
    }

    // Test functie om skeleton loader te testen
    window.testSkeleton = function() {
      log("🦴 Testing skeleton loader...")
      showLimitSkeleton()
      
      setTimeout(() => {
        log("🦴 Hiding skeleton loader...")
        updateLimitStatusCard(42)
      }, 2000)
    }


    // Initialiseer de UI met de beginwaarde
    updateUI(slider.value)
    
    // Sla de beginwaarde op als originele waarde (wordt later overschreven door loadLeadSettings)
    localStorage.setItem("originalLeadLimit", slider.value)

    // Update the slider event listener to ensure it uses the exact value
    slider.addEventListener("input", function () {
      const value = Number.parseInt(this.value, 10)
      log("Slider waarde veranderd naar:", value)
      updateUI(value)
    })

    // Event listener voor het handmatige invoerveld
    if (manualInput) {
      manualInput.addEventListener("input", function () {
        const value = Number.parseInt(this.value)
        if (!isNaN(value) && value >= 0 && value <= 100) {
          log("Handmatige invoer veranderd naar:", value)
slider.value = value;
          updateUI(value)
        }
      })
    }

    // Functie om de bevestigingspopup te maken
    function createConfirmationPopup() {
      // Controleer of de popup al bestaat
      if (document.getElementById("confirmationPopup")) {
        return document.getElementById("confirmationPopup")
      }

      // Maak de overlay
      const overlay = document.createElement("div")
      overlay.className = "confirmation-popup-overlay"
      overlay.id = "confirmationPopup"

      // Maak de popup
      const popup = document.createElement("div")
      popup.className = "confirmation-popup"

      // Maak de header
      const header = document.createElement("div")
      header.className = "confirmation-popup-header"
      header.innerHTML = "<h3>Bevestig je aanvragenlimiet</h3>"

      // Maak de body
      const body = document.createElement("div")
      body.className = "confirmation-popup-body"
      body.innerHTML = `
<p>Je staat op het punt om je maandelijkse aanvragenlimiet bij te werken. Controleer de details hieronder:</p>
<div class="confirmation-details">
<div class="confirmation-detail-row">
<span class="confirmation-detail-label">Aantal aanvragen:</span>
<span class="confirmation-detail-value" id="confirmLeadCount">0</span>
</div>
<div class="confirmation-detail-row">
<span class="confirmation-detail-label">Prijs per aanvraag:</span>
<span class="confirmation-detail-value">€50,00</span>
</div>
<div class="confirmation-detail-row confirmation-total">
<span class="confirmation-detail-label">Totale kosten per maand:</span>
<span class="confirmation-detail-value" id="confirmTotalCost">€0,00</span>
</div>
</div>
<p>Wil je doorgaan met deze instelling?</p>
      `

      // Maak de footer
      const footer = document.createElement("div")
      footer.className = "confirmation-popup-footer"

      // Maak de annuleren knop
      const cancelButton = document.createElement("button")
      cancelButton.className = "confirmation-btn confirmation-btn-cancel"
      cancelButton.textContent = "Annuleren"
      cancelButton.addEventListener("click", () => {
        hideConfirmationPopup()
      })

      // Maak de bevestigen knop
      const confirmButton = document.createElement("button")
      confirmButton.className = "confirmation-btn confirmation-btn-confirm"
      confirmButton.textContent = "Bevestigen"
      confirmButton.addEventListener("click", () => {
        hideConfirmationPopup()
        saveLeadLimit(Number.parseInt(slider.value))
      })

      // Voeg de knoppen toe aan de footer
      footer.appendChild(cancelButton)
      footer.appendChild(confirmButton)

      // Voeg alles samen
      popup.appendChild(header)
      popup.appendChild(body)
      popup.appendChild(footer)
      overlay.appendChild(popup)

      // Voeg de popup toe aan de body
      document.body.appendChild(overlay)

      // Voeg een event listener toe om de popup te sluiten als er buiten wordt geklikt
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          hideConfirmationPopup()
        }
      })

return overlay;
    }

    // Functie om de bevestigingspopup te tonen
    function showConfirmationPopup(leadCount) {
      const popup = createConfirmationPopup()

      // Update de waarden in de popup
      const leadCountElement = document.getElementById("confirmLeadCount")
      const totalCostElement = document.getElementById("confirmTotalCost")

      if (leadCountElement && totalCostElement) {
        // Bepaal de juiste tekst voor het aantal aanvragen
        let leadCountText = ""
        if (leadCount === 100) {
          leadCountText = "Onbeperkt"
          totalCostElement.textContent = "Op aanvraag"
        } else {
          // Ensure we use the exact slider value, not a calculated one
          leadCountText = leadCount.toString()
          // Bereken de totale kosten (aantal leads * 50 euro)
const totalCost = leadCount * 50;
          // Format de totale kosten als een bedrag met euro teken en komma als decimaal scheidingsteken
          totalCostElement.textContent = `€${totalCost.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }

leadCountElement.textContent = leadCountText;
      }

      // Toon de popup
      setTimeout(() => {
        popup.classList.add("active")
      }, 10)
    }

    // Functie om de bevestigingspopup te verbergen
    function hideConfirmationPopup() {
      const popup = document.getElementById("confirmationPopup")
      if (popup) {
        popup.classList.remove("active")
        setTimeout(() => {
          popup.remove()
        }, 300)
      }
    }

    // Event listener voor de opslaan knop - gebruik document.addEventListener voor betere compatibiliteit
    document.addEventListener("click", function(event) {
      if (event.target && event.target.id === "saveLeadLimit") {
        log("🔘 Opslaan knop geklikt!")
        log(`Button disabled: ${event.target.disabled}`)
        log(`Button backgroundColor: ${event.target.style.backgroundColor}`)
        
        // Check if button is disabled
        if (event.target.disabled) {
          log("❌ Opslaan knop is GEDISABLED, actie wordt genegeerd")
          return
        }

        // Get the exact value from the slider
        const slider = document.getElementById("leadLimitSlider")
        if (!slider) {
          log("❌ Slider niet gevonden!")
          return
        }
        
        const value = Number.parseInt(slider.value, 10)
        log("✅ Limiet wordt opgeslagen:", value)

        // Toon de bevestigingspopup met de exacte waarde
        showConfirmationPopup(value)
      }
    })
  }

  // Initialiseer de pauze functionaliteit
  function initPauseRequests() {
    log("Initialiseren van de pauze functionaliteit...")

    // Selecteer de benodigde elementen
    const pauseCheckbox = document.getElementById("pauseLeads")
    
    // Log de gevonden elementen voor debugging
    log("Pause checkbox:", pauseCheckbox)

    // Controleer of de checkbox bestaat
    if (!pauseCheckbox) {
      console.error("Pause checkbox niet gevonden!")
      return
    }

    // Event listener voor de pauze checkbox
    pauseCheckbox.addEventListener("change", function () {
      const isPausing = this.checked;
      
      log("Pause checkbox changed:", isPausing)
      
      // Toon confirmation modal
      showPauseConfirmationModal(isPausing);
    })
  }

  // Initialiseer de lead details popup functionaliteit
  // Improve the initLeadDetailsPopup function to ensure it correctly handles lead status changes
  function initLeadDetailsPopup() {
    log("Initialiseren van de lead details popup...")

    // Select all lead rows
    const leadRows = document.querySelectorAll(".lead-row")
    const popup = document.getElementById("leadDetailsPopup")
    const closeBtn = document.getElementById("closeLeadPopup")
    const closeBtnFooter = document.getElementById("closeLeadPopupBtn")
    const contactBtn = document.getElementById("contactLeadBtn")
    const saveStatusBtn = document.getElementById("saveStatusBtn")
    const statusSelect = document.getElementById("leadStatusSelect")
    const amountContainer = document.getElementById("amountContainer")
    const amountInput = document.getElementById("leadAmountInput")

    // Log the found elements for debugging
    log("Lead rijen:", leadRows.length)
    log("Popup:", popup)
    log("Amount container:", amountContainer)
    log("Amount input:", amountInput)

    // Check if all required elements exist
    if (!popup || leadRows.length === 0 || !amountContainer || !amountInput) {
      console.error("Niet alle benodigde elementen voor lead details popup zijn gevonden!")
      return
    }

    // Event listener for the status dropdown to show/hide the amount field
    if (statusSelect) {
      statusSelect.addEventListener("change", function () {
        log("Status gewijzigd naar:", this.value)
        if (this.value === "accepted") {
          amountContainer.style.display = "block"
        } else {
          amountContainer.style.display = "none"
          // Reset amount to 0 when not accepted
          amountInput.value = "0"
        }
      })
    }

    // Function to show the popup with lead details
    window.showLeadDetailsPopup = (lead) => {
      // Fill the popup with lead details
document.getElementById("leadName").textContent = lead.name;
document.getElementById("leadEmail").textContent = lead.email;
document.getElementById("leadPhone").textContent = lead.phone;
document.getElementById("leadDate").textContent = lead.date;
      document.getElementById("leadMessage").textContent = lead.message || "Geen bericht beschikbaar"

      // Set the initials in the avatar
      const nameParts = lead.name.split(" ")
      let initials = ""
      if (nameParts.length >= 2) {
        initials = nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)
      } else {
        initials = nameParts[0].charAt(0)
      }
      document.getElementById("leadInitials").textContent = initials.toUpperCase()

      // Set the correct status badge
      const statusBadge = document.getElementById("leadStatusBadge")
      statusBadge.textContent =
        lead.status === "new"
          ? "Nieuw"
          : lead.status === "accepted"
            ? "Geaccepteerd"
            : lead.status === "rejected"
              ? "Afgewezen"
: lead.status;

      statusBadge.className = "badge"
      if (lead.status === "new") {
        statusBadge.classList.add("badge-warning")
      } else if (lead.status === "accepted") {
        statusBadge.classList.add("badge-success")
      } else if (lead.status === "rejected") {
        statusBadge.classList.add("badge-danger")
      } else {
        statusBadge.classList.add("badge-secondary")
      }

      // Set the correct status in the dropdown
      if (statusSelect) {
statusSelect.value = lead.status;

        // Trigger the change event to show/hide amount field
        const event = new Event("change")
        statusSelect.dispatchEvent(event)
      }

      // Show or hide the amount field based on the status
      if (amountContainer && amountInput) {
        if (lead.status === "accepted") {
          amountContainer.style.display = "block"
amountInput.value = lead.amount || 0;
        } else {
          amountContainer.style.display = "none"
amountInput.value = 0;
        }
      }

      // Save the lead ID as a data attribute for the buttons
      contactBtn.setAttribute("data-lead-id", lead.id)
      contactBtn.setAttribute("data-lead-email", lead.email)
      contactBtn.setAttribute("data-lead-phone", lead.phone)

      // Save the lead ID for the save status button
      saveStatusBtn.setAttribute("data-lead-id", lead.id)
      saveStatusBtn.setAttribute("data-lead-current-status", lead.status)
      saveStatusBtn.setAttribute("data-lead-amount", lead.amount || 0)

      // Show the popup
      popup.classList.add("active")
    }

    // Add event listeners to all lead rows - navigate to detail page instead of opening modal
    leadRows.forEach((row) => {
      row.addEventListener("click", function (e) {
        // Don't navigate if clicking on the view button (it has its own link)
        if (e.target.closest('.view-lead')) {
          return; // Let the link handle navigation
        }
        
        const leadId = this.getAttribute("data-lead-id");
        if (leadId) {
          // Navigate to the new lead details page
          window.location.href = `/dashboard/leads/${leadId}`;
        }
      })
    })

    // Event listeners for the close buttons
    if (closeBtn) {
      closeBtn.addEventListener("click", hideLeadDetailsPopup)
    }

    if (closeBtnFooter) {
      closeBtnFooter.addEventListener("click", hideLeadDetailsPopup)
    }

    // Event listener for clicking outside the popup content
    popup.addEventListener("click", (event) => {
      if (event.target === popup || event.target.classList.contains("lead-details-popup-overlay")) {
        hideLeadDetailsPopup()
      }
    })

    // Event listener for the contact button
    if (contactBtn) {
      contactBtn.addEventListener("click", function () {
        const leadId = this.getAttribute("data-lead-id")
        const leadEmail = this.getAttribute("data-lead-email")
        const leadPhone = this.getAttribute("data-lead-phone")

        log("Contact opnemen met lead:", leadId)
        log("Email:", leadEmail)
        log("Telefoon:", leadPhone)

        // Show a notification
        displayNotification(`Contact opnemen met lead ${leadId}`, "success")
      })
    }

    // Event listener for the save status button
    if (saveStatusBtn && statusSelect) {
      saveStatusBtn.onclick = function () {
        const leadId = this.getAttribute("data-lead-id")
        const currentStatus = this.getAttribute("data-lead-current-status")
const newStatus = statusSelect.value;
let amount = 0;

        // Get the amount if the status is accepted
        if (newStatus === "accepted" && amountInput) {
amount = Number.parseInt(amountInput.value, 10) || 0;
          log(`Bedrag ingevuld voor lead ${leadId}: ${amount}`)
        }

        log("Status wijzigen voor lead:", leadId)
        log("Huidige status:", currentStatus)
        log("Nieuwe status:", newStatus)
        log("Bedrag:", amount)

        // Only update if the status or amount has actually changed
if (
          currentStatus !== newStatus ||
          (newStatus === "accepted" && amount !== Number.parseInt(this.getAttribute("data-lead-amount"), 10))
        ) {
          // Update the lead status and amount
          updateLeadStatus(leadId, newStatus, amount)

          // Save all leads to localStorage
          const leads = collectLeadsFromTable()
          saveLeadsToStorage(leads)

          // Update filtered tables
          updateFilteredTables()
        } else {
          displayNotification("Status is niet gewijzigd", "info")

          // Close the popup
          hideLeadDetailsPopup()
        }

return false; // Prevent any default action
      }
    }
  }

  // Functie om de originele tabeldata op te slaan
  function saveOriginalTableData() {
    log("Opslaan van originele tabeldata...")

    const tables = ["allLeadsTable", "newLeadsTable", "acceptedLeadsTable", "rejectedLeadsTable"]

    tables.forEach((tableId) => {
      const table = document.getElementById(tableId)
      if (!table) return

      const tbody = table.querySelector("tbody")
      if (!tbody) return

      // Sla de HTML van de tabel op
originalTableData[tableId] = tbody.innerHTML;

      log(`Originele data opgeslagen voor ${tableId}`)
    })
  }

  // Verbeterde zoek- en filterfunctionaliteit
  function initSearchAndFilter() {
    log("Initialiseren van zoek- en filterfunctionaliteit...")

    // Sla de originele tabeldata op bij initialisatie
    const allLeadsTable = document.getElementById("allLeadsTable")
    if (allLeadsTable) {
      const rows = Array.from(allLeadsTable.querySelectorAll("tbody tr.lead-row"))
      originalTableData.allLeads = rows.map(row => {
        // Converteer de Nederlandse datum naar een Date object
        const dutchDate = row.getAttribute("data-lead-date")
        const [day, month, year] = dutchDate.split("-").map(num => parseInt(num, 10))
const dateObject = new Date(year, month - 1, day) // month is 0-based in JavaScript;

        return {
          element: row.cloneNode(true),
          id: row.getAttribute("data-lead-id"),
          name: row.getAttribute("data-lead-name") || "",
nameLower: (row.getAttribute("data-lead-name") || "").toLowerCase(), // Voor case-insensitive sortering;
          email: row.getAttribute("data-lead-email")?.toLowerCase() || "",
          phone: row.getAttribute("data-lead-phone")?.toLowerCase() || "",
          date: dateObject,
          dateString: dutchDate,
          status: row.getAttribute("data-lead-status"),
          message: row.getAttribute("data-lead-message"),
          amount: row.getAttribute("data-lead-amount")
        }
      })
    }

    // Event listeners voor filters
    const searchInput = document.getElementById("searchInput")
    const sortOption = document.getElementById("sortOption")
    const nameSort = document.getElementById("nameSort")
    const typeFilter = document.getElementById("typeFilter")
    const resetFiltersBtn = document.getElementById("resetFiltersBtn")

    if (searchInput) searchInput.addEventListener("input", filterTable)
    if (sortOption) sortOption.addEventListener("change", filterTable)
    if (nameSort) nameSort.addEventListener("change", filterTable)
    if (typeFilter) typeFilter.addEventListener("change", filterTable)
    if (resetFiltersBtn) resetFiltersBtn.addEventListener("click", resetFilters)
  }

  function filterTable() {
    if (!originalTableData.allLeads) {
      console.error("Geen originele data beschikbaar")
      return
    }

    const searchValue = document.getElementById("searchInput")?.value.toLowerCase() || ""
    const sortValue = document.getElementById("sortOption")?.value || "date-desc"
    const nameSortValue = document.getElementById("nameSort")?.value || "none"
    const typeValue = document.getElementById("typeFilter")?.value || "all"

    log("Filtering met waardes:", { searchValue, sortValue, nameSortValue, typeValue })

    // Begin met alle leads
    let filteredLeads = [...originalTableData.allLeads]

    // Pas zoekfilter toe
    if (searchValue) {
filteredLeads = filteredLeads.filter(lead =>
        lead.nameLower.includes(searchValue) ||
        lead.email.includes(searchValue) ||
        lead.phone.includes(searchValue)
      )
    }

    // Pas statusfilter toe
    if (typeValue !== "all") {
      filteredLeads = filteredLeads.filter(lead => lead.status === typeValue)
    }

    // Pas sortering toe
    if (nameSortValue !== "none") {
      // Sorteer op naam als naamsortering is geselecteerd
      filteredLeads.sort((a, b) => {
        const compareResult = a.nameLower.localeCompare(b.nameLower)
return nameSortValue === "asc" ? compareResult : -compareResult;
      })
    } else {
      // Anders sorteer op datum
      filteredLeads.sort((a, b) => {
        const timeA = a.date.getTime()
        const timeB = b.date.getTime()
return sortValue === "date-desc" ? timeB - timeA : timeA - timeB;
      })
    }

    // Update alle tabellen
    updateTables(filteredLeads)
  }

  function updateTables(filteredLeads) {
    // Update hoofdtabel
    const allLeadsTable = document.getElementById("allLeadsTable")
    if (allLeadsTable) {
      const tbody = allLeadsTable.querySelector("tbody")
      if (tbody) {
        tbody.innerHTML = ""
        filteredLeads.forEach(lead => {
          const clone = lead.element.cloneNode(true)
          addLeadClickHandler(clone)
          tbody.appendChild(clone)
        })
      }
    }

    // Update gefilterde tabellen
    const statusTables = {
      "newLeadsTable": "new",
      "acceptedLeadsTable": "accepted",
      "rejectedLeadsTable": "rejected"
    }

    Object.entries(statusTables).forEach(([tableId, status]) => {
      const table = document.getElementById(tableId)
      if (table) {
        const tbody = table.querySelector("tbody")
        if (tbody) {
          tbody.innerHTML = ""
          const statusFilteredLeads = filteredLeads.filter(lead => lead.status === status)
          statusFilteredLeads.forEach(lead => {
            const clone = lead.element.cloneNode(true)
            addLeadClickHandler(clone)
            tbody.appendChild(clone)
          })

          // Update badge count
          const tabId = tableId.replace("Table", "-tab")
          const badge = document.querySelector(`#${tabId} .badge`)
          if (badge) {
badge.textContent = statusFilteredLeads.length;
          }
        }
      }
    })

    // Update statistieken
    updateLeadStatistics()
  }

  function addLeadClickHandler(row) {
    row.addEventListener("click", function() {
      const lead = {
        id: this.getAttribute("data-lead-id"),
        name: this.getAttribute("data-lead-name"),
        email: this.getAttribute("data-lead-email"),
        phone: this.getAttribute("data-lead-phone"),
        date: this.getAttribute("data-lead-date"),
        status: this.getAttribute("data-lead-status"),
        message: this.getAttribute("data-lead-message"),
        amount: this.getAttribute("data-lead-amount") || 0
      }
      window.showLeadDetailsPopup(lead)
    })
  }

  function resetFilters() {
    // Reset alle filter inputs
    const searchInput = document.getElementById("searchInput")
    const sortOption = document.getElementById("sortOption")
    const nameSort = document.getElementById("nameSort")
    const typeFilter = document.getElementById("typeFilter")

    if (searchInput) searchInput.value = ""
    if (sortOption) sortOption.value = "date-desc"
    if (nameSort) nameSort.value = "none"
    if (typeFilter) typeFilter.value = "all"

    // Herstel originele data
    if (originalTableData.allLeads) {
      updateTables(originalTableData.allLeads)
    }

    // Toon notificatie
    displayNotification("Filters zijn gereset", "info")
  }

  // Initialiseer de paginering
  function initPagination() {
    log("Initialiseren van de paginering...")

    // Selecteer alle tabellen
    const tables = ["allLeadsTable", "newLeadsTable", "acceptedLeadsTable", "rejectedLeadsTable"]

    tables.forEach((tableId) => {
      const table = document.getElementById(tableId)
      if (!table) return

      const rows = table.querySelectorAll("tbody tr")
      updatePagination(tableId, Array.from(rows))
    })
  }

  // Functie om de paginering bij te werken
  function updatePagination(tableId, visibleRows) {
    const paginationId = tableId.replace("Table", "Pagination")
    const paginationContainer = document.getElementById(paginationId)
    if (!paginationContainer) return

const rowsPerPage = 6;
    const totalPages = Math.ceil(visibleRows.length / rowsPerPage)

    // Maak de paginering HTML
    let paginationHTML = `
<nav aria-label="Paginering">
<ul class="pagination justify-content-center">
<li class="page-item disabled">
<a class="page-link" href="#" tabindex="-1" aria-disabled="true">Vorige</a>
</li>
    `

    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
<li class="page-item ${i === 1 ? "active" : ""}">
<a class="page-link" href="#" data-page="${i}">${i}</a>
</li>
      `
    }

    paginationHTML += `
<li class="page-item ${totalPages <= 1 ? "disabled" : ""}">
<a class="page-link" href="#">Volgende</a>
</li>
</ul>
</nav>
    `

    // Update de paginering container
paginationContainer.innerHTML = paginationHTML;

    // Voeg event listeners toe aan de paginering links
    const pageLinks = paginationContainer.querySelectorAll(".page-link")
    pageLinks.forEach((link) => {
      link.addEventListener("click", function (e) {
        e.preventDefault()

        const page = this.getAttribute("data-page")
        if (page) {
          // Ga naar de geselecteerde pagina
          goToPage(tableId, Number.parseInt(page), visibleRows)

          // Update de active class
          paginationContainer.querySelectorAll(".page-item").forEach((item) => {
            item.classList.remove("active")
          })
          this.parentElement.classList.add("active")

          // Update de vorige/volgende knoppen
          const prevButton = paginationContainer.querySelector(".page-item:first-child")
          const nextButton = paginationContainer.querySelector(".page-item:last-child")

          if (Number.parseInt(page) === 1) {
            prevButton.classList.add("disabled")
          } else {
            prevButton.classList.remove("disabled")
          }

          if (Number.parseInt(page) === totalPages) {
            nextButton.classList.add("disabled")
          } else {
            nextButton.classList.remove("disabled")
          }
        } else {
          // Vorige of Volgende knop
          const activePageItem = paginationContainer.querySelector(".page-item.active")
          const currentPage = Number.parseInt(activePageItem.querySelector(".page-link").getAttribute("data-page"))

          if (this.textContent === "Vorige" && currentPage > 1) {
            // Ga naar de vorige pagina
            const prevPageLink = paginationContainer.querySelector(`.page-link[data-page="${currentPage - 1}"]`)
            prevPageLink.click()
          } else if (this.textContent === "Volgende" && currentPage < totalPages) {
            // Ga naar de volgende pagina
            const nextPageLink = paginationContainer.querySelector(`.page-link[data-page="${currentPage + 1}"]`)
            nextPageLink.click()
          }
        }
      })
    })

    // Ga standaard naar pagina 1
    goToPage(tableId, 1, visibleRows)
  }

  // Functie om naar een specifieke pagina te gaan
  function goToPage(tableId, page, visibleRows) {
    const table = document.getElementById(tableId)
    if (!table) return

const rowsPerPage = 6;
const startIndex = (page - 1) * rowsPerPage;
const endIndex = startIndex + rowsPerPage;

    // Verberg alle rijen
    visibleRows.forEach((row, index) => {
      if (index >= startIndex && index < endIndex) {
        row.style.display = ""
      } else {
        row.style.display = "none"
      }
    })
  }

  // Add a function to ensure all initialization happens in the correct order
  // Initialize lead management (guard against duplicate calls)
  let isInitialized = false;
  function initializeLeadManagement() {
    if (isInitialized) return;
    isInitialized = true;
    log("Initializing lead management system")

    // First load saved leads
    updateTableWithSavedLeads()

    // Then update filtered tables
    updateFilteredTables()

    // Update statistics
    updateLeadStatistics()
    updateEstimatedRevenue()

    // Initialize other components
    initSlider()
    initPauseRequests()
    initLeadDetailsPopup()
    initSearchAndFilter()
    initPagination()
  }

  // Call initialization on page load and after a delay to ensure everything is loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initializeLeadManagement()

      // Also initialize after a delay to ensure everything is loaded
      setTimeout(initializeLeadManagement, 500)
    })
  } else {
    // DOM is already loaded
    initializeLeadManagement()

    // Also initialize after a delay to ensure everything is loaded
    setTimeout(initializeLeadManagement, 500)
  }

  
})()

// Functie om de lead limiet op te slaan
async function saveLeadLimit(limit) {
  log("Lead limiet wordt opgeslagen:", limit)

  try {
    // Maak API call naar de server
    const response = await fetch('/api/user/lead-limit', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lead_limit: limit
      })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Er is een fout opgetreden bij het opslaan van de limiet')
    }

    // Sla de limiet op in localStorage als backup
    localStorage.setItem("leadLimit", limit.toString())

    // Bepaal of de limiet is verhoogd of verlaagd
    const previousLimit = parseInt(localStorage.getItem("previousLeadLimit") || "0")
const isIncreased = limit > previousLimit;
const isDecreased = limit < previousLimit;
const isUnlimited = limit === 100;
const isNoLimit = limit === 0;

    // Maak een mooie notificatie bericht
    let notificationMessage = ""
    let notificationType = "success"
    let notificationIcon = "check-circle"

    if (isUnlimited) {
      notificationMessage = "🎉 Lead limiet ingesteld op onbeperkt!"
      notificationIcon = "infinity"
    } else if (isNoLimit) {
      notificationMessage = "⚠️ Lead limiet uitgeschakeld"
      notificationType = "warning"
      notificationIcon = "exclamation-triangle"
    } else if (isIncreased) {
      notificationMessage = `📈 Lead limiet verhoogd naar ${limit} aanvragen per maand`
      notificationIcon = "arrow-up"
    } else if (isDecreased) {
      notificationMessage = `📉 Lead limiet verlaagd naar ${limit} aanvragen per maand`
      notificationIcon = "arrow-down"
    } else {
      notificationMessage = `✅ Lead limiet ingesteld op ${limit} aanvragen per maand`
    }

    // Sla de huidige limiet op voor volgende vergelijking
    localStorage.setItem("previousLeadLimit", limit.toString())
    localStorage.setItem("originalLeadLimit", limit.toString())

    // Update de huidige limiet display (alleen na opslaan)
    updateCurrentLimit(limit)

    // Reset de opslaan knop naar gedeactiveerd
    const saveButton = document.getElementById("saveLeadLimit")
    if (saveButton) {
saveButton.disabled = true;
      saveButton.style.backgroundColor = "#6c757d"
      saveButton.style.borderColor = "#6c757d"
      saveButton.style.color = "#ffffff"
      saveButton.style.cursor = "not-allowed"
      log("❌ Opslaan knop gereset na opslaan")
    }

    // Toon notificatie met het bestaande systeem
    // Toon notificatie via het uniforme systeem
    notifyUser(notificationMessage, notificationType)

    // Update de UI
    const limitText = document.getElementById("leadLimitText")
    if (limitText) {
      if (limit === 0) {
        limitText.textContent = "Geen limiet ingesteld"
      } else if (limit === 100) {
        limitText.textContent = "Geen limiet"
      } else {
        limitText.textContent = `Maximaal ${limit} leads per maand`
      }
    }

    log("Lead limiet succesvol opgeslagen in database:", result)

  } catch (error) {
    console.error("Fout bij opslaan lead limiet:", error)
    
    // Toon foutmelding
    displayNotification(
      `Fout bij opslaan: ${error.message}`,
      "error"
    )
  }
}

// Functie om skeleton loader te tonen
function showLimitSkeleton() {
  const currentLimitValue = document.getElementById("currentLimitValue")
  const currentLimitUnit = document.getElementById("currentLimitUnit")
  
  if (currentLimitValue) {
    currentLimitValue.innerHTML = '<div class="skeleton-loader skeleton-text"></div>'
  }
  
  if (currentLimitUnit) {
    currentLimitUnit.innerHTML = '<div class="skeleton-loader skeleton-text-small"></div>'
  }
}

// Functie om skeleton loader te verbergen
function hideLimitSkeleton() {
  const currentLimitValue = document.getElementById("currentLimitValue")
  const currentLimitUnit = document.getElementById("currentLimitUnit")
  
  if (currentLimitValue && currentLimitValue.querySelector('.skeleton-loader')) {
    currentLimitValue.innerHTML = ''
  }
  
  if (currentLimitUnit && currentLimitUnit.querySelector('.skeleton-loader')) {
    currentLimitUnit.innerHTML = ''
  }
}

// Globale functie om de limiet status bij te werken
function updateLimitStatusCard(value) {
  log(`updateLimitStatusCard called with value: ${value}`)
  
  // Verberg skeleton loader eerst
  hideLimitSkeleton()
  
  // Probeer het element te vinden, als het niet bestaat, probeer het opnieuw na een korte delay
  const currentLimitValue = document.getElementById("currentLimitValue")
  const currentLimitUnit = document.getElementById("currentLimitUnit")

  log(`currentLimitValue element found: ${!!currentLimitValue}`)
  log(`currentLimitUnit element found: ${!!currentLimitUnit}`)

  if (!currentLimitValue || !currentLimitUnit) {
    log("Elements not found, retrying in 200ms...")
    setTimeout(() => {
      updateLimitStatusCard(value)
    }, 200)
    return
  }

  if (currentLimitValue) {
    if (value === 100) {
      currentLimitValue.textContent = "∞"
    } else {
currentLimitValue.textContent = value;
    }
    log(`Updated currentLimitValue to: ${currentLimitValue.textContent}`)
  }

  if (currentLimitUnit) {
    if (value === 100) {
      currentLimitUnit.textContent = "onbeperkt"
    } else {
      currentLimitUnit.textContent = value === 1 ? "aanvraag" : "aanvragen"
    }
    log(`Updated currentLimitUnit to: ${currentLimitUnit.textContent}`)
  }
}

// Functie om de lead instellingen op te halen
async function loadLeadSettings() {
  log("Lead instellingen worden opgehaald...")
  
  // Toon skeleton loader terwijl data wordt geladen
  showLimitSkeleton()

  try {
    // Maak API call naar de server
    const response = await fetch('/api/user/lead-settings', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Er is een fout opgetreden bij het ophalen van de instellingen')
    }

const { lead_limit, is_paused } = result.data;

    // Update de slider met de opgehaalde limiet
    const limitSlider = document.getElementById("leadLimitSlider")
    if (limitSlider) {
      // Alleen updaten als de waarde anders is (voorkomt visuele sprong)
      const currentValue = parseInt(limitSlider.value) || 0
      if (currentValue !== lead_limit) {
        limitSlider.value = lead_limit
      const event = new Event("input")
      limitSlider.dispatchEvent(event)
      }
    }

    // Update de limiet status card - wacht tot DOM klaar is
    setTimeout(() => {
      updateLimitStatusCard(lead_limit)
    }, 100)

    // Sla de huidige limiet op voor vergelijking bij volgende wijziging
    localStorage.setItem("previousLeadLimit", lead_limit.toString())
    localStorage.setItem("originalLeadLimit", lead_limit.toString())

    // Reset de opslaan knop naar gedeactiveerd na het laden van instellingen
    const saveButton = document.getElementById("saveLeadLimit")
    if (saveButton) {
saveButton.disabled = true;
      saveButton.style.backgroundColor = "#6c757d"
      saveButton.style.borderColor = "#6c757d"
      saveButton.style.color = "#ffffff"
      saveButton.style.cursor = "not-allowed"
      saveButton.textContent = "Opslaan"
      log("❌ Opslaan knop gereset na laden instellingen")
    }

    // Update de pauze checkbox
    const pauseCheckbox = document.getElementById("pauseLeads")
    if (pauseCheckbox) {
pauseCheckbox.checked = is_paused;
      // Update the pause status display without triggering the modal
updatePauseStatus(is_paused, false) // false = no notification during initialization;
      
      // Update pause notification visibility
      updatePauseNotification(is_paused)
      
      // Don't dispatch change event during initialization to prevent modal from opening
      // The event listener will be triggered naturally when user interacts with the checkbox
    }

    log("Lead instellingen succesvol opgehaald:", result.data)

  } catch (error) {
    console.error("Fout bij ophalen lead instellingen:", error)
    
    // Toon skeleton loader voor fallback
    showLimitSkeleton()
    
    // Fallback naar localStorage waarden
    const savedLimit = localStorage.getItem("leadLimit")
    const savedPauseStatus = localStorage.getItem("leadsPaused")
    
    if (savedLimit) {
      const limitSlider = document.getElementById("leadLimitSlider")
      if (limitSlider) {
limitSlider.value = savedLimit;
        const event = new Event("input")
        limitSlider.dispatchEvent(event)
      }
      
      // Update de limiet status card - wacht tot DOM klaar is
      setTimeout(() => {
        updateLimitStatusCard(parseInt(savedLimit))
      }, 100)
      
      // Sla de opgehaalde limiet op voor vergelijking
      localStorage.setItem("previousLeadLimit", savedLimit)
      localStorage.setItem("originalLeadLimit", savedLimit)
      
      // Reset de opslaan knop naar gedeactiveerd na fallback
      const saveButton = document.getElementById("saveLeadLimit")
      if (saveButton) {
saveButton.disabled = true;
        saveButton.style.backgroundColor = "#6c757d"
        saveButton.style.borderColor = "#6c757d"
        saveButton.style.color = "#ffffff"
        saveButton.style.cursor = "not-allowed"
        saveButton.textContent = "Opslaan"
        log("❌ Opslaan knop gereset na fallback")
      }
    }
    
    if (savedPauseStatus) {
      const pauseCheckbox = document.getElementById("pauseLeads")
      if (pauseCheckbox) {
        pauseCheckbox.checked = savedPauseStatus === "true"
        // Update the pause status display without triggering the modal
        updatePauseStatus(savedPauseStatus === "true")
        // Don't dispatch change event during initialization to prevent modal from opening
        // The event listener will be triggered naturally when user interacts with the checkbox
      }
    }
  }
}

// Functie om expired pauses te controleren en op te heffen
async function checkExpiredPauses() {
  try {
    const pauseData = localStorage.getItem('pauseData');
    if (!pauseData) return;

    const data = JSON.parse(pauseData);
    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    if (now > expiresAt) {
      log('Pause is expired, automatically resuming...');
      
      // Clear pause data
      localStorage.removeItem('pauseData');
      localStorage.setItem("leadsPaused", "false");
      
      // Update UI
      const pauseCheckbox = document.getElementById("pauseLeads");
      if (pauseCheckbox) {
        pauseCheckbox.checked = false;
        updatePauseStatus(false);
      }
      
      // Hide pause notification
      updatePauseNotification(false);
      
      // Save to backend
      await saveLeadPauseStatus(false);
      
      // Show notification
      if (window.showNotification) {
window.showNotification(
          "⏰ Je pauze is verlopen en aanvragen zijn automatisch hervat",
          "info",
          5000,
          true
        );
      }
    }
  } catch (error) {
    console.error('Error checking expired pauses:', error);
  }
}

// Check for expired pauses on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(checkExpiredPauses, 1000);
});

// Check every hour for expired pauses
setInterval(checkExpiredPauses, 60 * 60 * 1000);

// Functie om de lead pauze status op te slaan zonder notificatie (voor initialisatie)
async function saveLeadPauseStatusSilent(isPaused) {
  log("Lead pauze status wordt opgeslagen (silent):", isPaused)

  try {
    // Get pause data from localStorage if pausing
    let pauseData = null;
    if (isPaused) {
      const storedPauseData = localStorage.getItem('pauseData');
      if (storedPauseData) {
        pauseData = JSON.parse(storedPauseData);
      }
    }

    // Maak API call naar de server
    const response = await fetch('/api/user/lead-pause', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        is_paused: isPaused,
        pause_reason: pauseData ? pauseData.reason : null,
        pause_other_reason: pauseData ? pauseData.other_reason : null,
pause_expires_at: pauseData ? pauseData.expires_at : null
      })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Er is een fout opgetreden bij het opslaan van de pauze status')
    }

    // Sla de pauze status op in localStorage als backup
    localStorage.setItem("leadsPaused", isPaused ? "true" : "false")

    log("Lead pauze status succesvol opgeslagen in database (silent):", result)

  } catch (error) {
    console.error("Fout bij opslaan lead pauze status (silent):", error)
  }
}

// Functie om de lead pauze status op te slaan
async function saveLeadPauseStatus(isPaused) {
  log("Lead pauze status wordt opgeslagen:", isPaused)

  try {
    // Get pause data from localStorage if pausing
    let pauseData = null;
    if (isPaused) {
      const storedPauseData = localStorage.getItem('pauseData');
      if (storedPauseData) {
        pauseData = JSON.parse(storedPauseData);
      }
    }

    // Maak API call naar de server
    const response = await fetch('/api/user/lead-pause', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        is_paused: isPaused,
        pause_reason: pauseData ? pauseData.reason : null,
        pause_other_reason: pauseData ? pauseData.other_reason : null,
pause_expires_at: pauseData ? pauseData.expires_at : null
      })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Er is een fout opgetreden bij het opslaan van de pauze status')
    }

    // Sla de pauze status op in localStorage als backup
    localStorage.setItem("leadsPaused", isPaused ? "true" : "false")

    // Maak een mooie notificatie bericht voor pauze status
    let notificationMessage = ""
    let notificationType = "success"

    if (isPaused) {
      notificationMessage = "⏸️ Aanvragen zijn gepauzeerd"
      notificationType = "warning"
    } else {
      notificationMessage = "▶️ Aanvragen zijn geactiveerd"
      notificationType = "success"
    }

    // Toon notificatie met het bestaande systeem
    // Toon notificatie via het uniforme systeem
    notifyUser(notificationMessage, notificationType)

    log("Lead pauze status succesvol opgeslagen in database:", result)

  } catch (error) {
    console.error("Fout bij opslaan pauze status:", error)
    
    // Toon foutmelding
    notifyUser(`Fout bij opslaan: ${error.message}`, "error")
  }
}

// Functie om een notificatie te tonen
function displayNotification(message, type = "success", duration = 5000) {
  // Prefer the unified dashboard notifier with sounds and admin styling
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type, duration, true);
    return;
  }
  // Minimal fallback
  try {
    let container = document.querySelector('.notification-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'notification-container';
      document.body.appendChild(container);
    }
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    if (duration > 0) setTimeout(() => notification.remove(), duration);
  } catch (e) {
    console.log(message);
  }
}

// Vervang de updateEstimatedRevenue functie met deze volledig nieuwe versie
function updateEstimatedRevenue() {
  log("updateEstimatedRevenue wordt uitgevoerd")

  // Bereken de totale omzet van alle geaccepteerde leads
let totalRevenue = 0;

  // Selecteer alle geaccepteerde leads uit de hoofdtabel
  const acceptedLeads = document.querySelectorAll("#allLeadsTable tbody tr[data-lead-status='accepted']")

  log(`Aantal geaccepteerde leads gevonden: ${acceptedLeads.length}`)

  // Loop door alle geaccepteerde leads en tel de bedragen op
  acceptedLeads.forEach((lead) => {
    const amountAttr = lead.getAttribute("data-lead-amount")
    log(`Lead ID: ${lead.getAttribute("data-lead-id")}, Amount attribute: ${amountAttr}`)

    // Zorg ervoor dat we een getal krijgen, zelfs als het attribuut leeg is
const amount = amountAttr ? Number.parseInt(amountAttr, 10) : 0;

    if (isNaN(amount)) {
      logWarn(`Ongeldige bedrag waarde voor lead ${lead.getAttribute("data-lead-id")}: ${amountAttr}`)
    } else {
totalRevenue += amount;
      log(`Lead ${lead.getAttribute("data-lead-id")} bedrag: ${amount}, Totaal tot nu toe: ${totalRevenue}`)
    }
  })

  log("Totale gerealiseerde omzet berekend:", totalRevenue)

  // DIRECTE BENADERING: Zoek alle kaarten en update de juiste
  document.querySelectorAll(".card-body").forEach((cardBody) => {
    const titleElement = cardBody.querySelector(".card-title")
    if (titleElement && titleElement.textContent.trim() === "Gerealiseerde omzet") {
      const valueElement = cardBody.querySelector('div[style*="font-size: 2rem"]')
      if (valueElement) {
        // Directe update van de tekst
        valueElement.textContent = `€${totalRevenue}`
        log("Gerealiseerde omzet direct bijgewerkt naar:", totalRevenue)
      }
    }
  })

  // Sla de huidige omzet op in een globale variabele voor debugging
window.currentRevenue = totalRevenue;

return totalRevenue;
}

// Improve the updateLeadStatus function to ensure it properly updates and saves the status
function updateLeadStatus(leadId, newStatus, amount) {
  log(`Lead status updated for lead ${leadId} to ${newStatus} with amount ${amount}`)

  // Find the lead row in all tables and update the data attributes and badge
  const leadRows = document.querySelectorAll(`.lead-row[data-lead-id="${leadId}"]`)
  leadRows.forEach((row) => {
    // Save the old values for debugging
    const oldStatus = row.getAttribute("data-lead-status")
    const oldAmount = row.getAttribute("data-lead-amount")

    // Update the attributes
    row.setAttribute("data-lead-status", newStatus)
    row.setAttribute("data-lead-amount", amount)

log(
      `Data attributes bijgewerkt voor lead ${leadId}: status=${oldStatus}->${newStatus}, amount=${oldAmount}->${amount}`,
    )

    const badgeCell = row.querySelector("td:last-child")
    if (badgeCell) {
      switch (newStatus) {
case "new":
          badgeCell.innerHTML = '<span class="badge badge-warning">Nieuw</span>'
          break
case "accepted":
          badgeCell.innerHTML = '<span class="badge badge-success">Geaccepteerd</span>'
          break
case "rejected":
          badgeCell.innerHTML = '<span class="badge badge-danger">Afgewezen</span>'
          break
default:
          badgeCell.innerHTML = `<span class="badge badge-secondary">${newStatus}</span>`
          break
      }
    }
  })

  // Update the statistics
  updateLeadStatistics()

  // Update the estimated revenue
  updateEstimatedRevenue()

  // Collect and save all leads to localStorage immediately
  const leads = collectLeadsFromTable()
  const saved = saveLeadsToStorage(leads)
  log("Leads saved after status update:", saved)

  // Show a notification
  displayNotification(
    `Lead ${leadId} status bijgewerkt naar ${newStatus === "new" ? "Nieuw" : newStatus === "accepted" ? "Geaccepteerd" : "Afgewezen"}`,
    "success"
  )

  // Close the popup
  hideLeadDetailsPopup()
}

// Helper function to update compact display
function updateCompactDisplay(value) {
  const currentLimitDisplay = document.getElementById('currentLimitDisplay');
  if (currentLimitDisplay) {
    if (value === 100) {
      currentLimitDisplay.textContent = 'Geen limiet';
    } else {
      currentLimitDisplay.textContent = value + ' aanvragen';
    }
  }
}

// Lead limiet functionaliteit
document.addEventListener('DOMContentLoaded', function() {
  const leadLimitSlider = document.getElementById('leadLimitSlider');

  if (leadLimitSlider) {
    let originalValue = parseInt(leadLimitSlider.value);

    // Initialize display with current value
    log('Initializing slider with value:', originalValue);
    
    // Update new compact display
    updateCompactDisplay(originalValue);
    
    // Update progress bar
    const progressBar = document.querySelector('.modern-slider-progress');
    if (progressBar) {
      progressBar.style.width = originalValue + '%';
      log('Progress bar set to:', originalValue + '%');
    }
    
    // Force slider value to match
    leadLimitSlider.value = originalValue;

    // Update display when slider changes
    leadLimitSlider.addEventListener('input', function() {
      const value = parseInt(this.value);
      
      // Update new compact display
      updateCompactDisplay(value);
      
      // Update progress bar
      const progressBar = document.querySelector('.modern-slider-progress');
      if (progressBar) {
        progressBar.style.width = value + '%';
      }
    });

    // Show confirmation modal and save when slider is released (onchange)
    leadLimitSlider.addEventListener('change', function() {
      const value = parseInt(this.value);
      
      // Only show modal if value actually changed
      if (value !== originalValue) {
        showLimitConfirmationModal(value, originalValue);
      }
    });
  }
});

// Function to show pause confirmation modal
function showPauseConfirmationModal(isPausing) {
  // Check if modal already exists
  const existingModal = document.querySelector('.pause-confirmation-modal');
  if (existingModal) {
    log('Modal already exists, removing it first');
    document.body.removeChild(existingModal);
  }
  
  const actionText = isPausing ? 'pauzeren' : 'activeren';
  const currentStatus = isPausing ? 'actief' : 'gepauzeerd';
  const newStatus = isPausing ? 'gepauzeerd' : 'actief';
  
  const confirmationMessage = `Weet je zeker dat je je aanvragen wilt ${actionText}? Deze wijziging wordt direct van kracht.`;
  
  // Create confirmation modal
  const modal = document.createElement('div');
  modal.className = 'pause-confirmation-modal';
  modal.innerHTML = 
    '<div class="pause-confirmation-modal-overlay"></div>' +
    '<div class="pause-confirmation-modal-content">' +
      '<div class="pause-confirmation-modal-header">' +
        '<div class="pause-confirmation-modal-header-content">' +
          '<div class="pause-confirmation-modal-icon">' +
            '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>' +
            '</svg>' +
          '</div>' +
          '<div>' +
            '<h3 class="pause-confirmation-modal-title">Aanvragen ' + actionText + '</h3>' +
            '<p class="pause-confirmation-modal-subtitle">Bevestig uw wijziging</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pause-confirmation-modal-body">' +
        '<p>' + confirmationMessage + '</p>' +
        (isPausing ? 
          '<div class="pause-reason-section">' +
            '<div id="pauseReasonError" class="pause-reason-error" style="display: none;">' +
              '<i class="fas fa-exclamation-triangle"></i>' +
              '<span>Selecteer een reden voor de pauze</span>' +
            '</div>' +
            '<label for="pauseReason" class="pause-reason-label">Reden voor pauze:</label>' +
            '<select id="pauseReason" class="pause-reason-select">' +
              '<option value="">Selecteer een reden...</option>' +
              '<option value="too_expensive">Aanvragen zijn te duur</option>' +
              '<option value="not_meeting_expectations">Voldoen niet aan verwachtingen</option>' +
              '<option value="temporary_break">Tijdelijke pauze nodig</option>' +
              '<option value="budget_constraints">Budget beperkingen</option>' +
              '<option value="quality_issues">Kwaliteitsproblemen</option>' +
              '<option value="too_many_leads">Te veel aanvragen</option>' +
              '<option value="other">Anders (specificeer)</option>' +
            '</select>' +
            '<textarea id="pauseReasonOther" class="pause-reason-other" placeholder="Specificeer uw reden..." style="display: none;"></textarea>' +
          '</div>' +
          '<div class="pause-time-limit-info">' +
            '<div class="pause-time-limit-content">' +
              '<svg class="pause-time-limit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
              '</svg>' +
              '<div class="pause-time-limit-text">' +
                '<strong>Belangrijk:</strong> Een pauze kan maximaal 1 maand duren. Na deze periode worden je aanvragen automatisch hervat.' +
              '</div>' +
            '</div>' +
          '</div>' : '') +
        '<div class="pause-confirmation-info-box">' +
          '<div class="pause-confirmation-info-content">' +
            '<svg class="pause-confirmation-info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
            '</svg>' +
            '<div class="pause-confirmation-info-text">' +
              '<strong>Let op:</strong> ' + (isPausing ? 'Je ontvangt geen nieuwe aanvragen meer totdat je de pauze opheft.' : 'Je ontvangt weer nieuwe aanvragen zodra je dit bevestigt.') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pause-confirmation-modal-footer">' +
        '<button class="btn btn-secondary" id="cancelPauseBtn">Annuleren</button>' +
        '<button class="btn btn-success" id="confirmPauseBtn">Bevestigen</button>' +
      '</div>' +
    '</div>';
  
  document.body.appendChild(modal);
  
  // Function to close modal and clean up
  function closeModal() {
    if (modal && modal.parentNode) {
      document.body.removeChild(modal);
    }
  }
  
  // Add event listeners after modal is in DOM
  setTimeout(() => {
    const cancelBtn = document.getElementById('cancelPauseBtn');
    const confirmBtn = document.getElementById('confirmPauseBtn');
    const pauseReasonSelect = document.getElementById('pauseReason');
    const pauseReasonOther = document.getElementById('pauseReasonOther');
    
    // Handle reason dropdown change
    if (pauseReasonSelect && pauseReasonOther) {
      pauseReasonSelect.addEventListener('change', function() {
        // Hide error message when user selects a reason
        const errorElement = document.getElementById('pauseReasonError');
        if (errorElement) {
          errorElement.style.display = 'none';
        }
        
        if (this.value === 'other') {
          pauseReasonOther.style.display = 'block';
        } else {
          pauseReasonOther.style.display = 'none';
        }
      });
    }
    
    // Handle other reason textarea input
    if (pauseReasonOther) {
      pauseReasonOther.addEventListener('input', function() {
        // Hide error message when user types in other reason
        const errorElement = document.getElementById('pauseReasonError');
        if (errorElement) {
          errorElement.style.display = 'none';
        }
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        // Reset checkbox to original state
        const pauseCheckbox = document.getElementById('pauseLeads');
        pauseCheckbox.checked = !isPausing;
        
        // Close modal
        closeModal();
      });
    }
    
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function() {
        log('Confirm pause button clicked, isPausing:', isPausing);
        
        // Validate pause reason if pausing
        if (isPausing) {
          const selectedReason = pauseReasonSelect ? pauseReasonSelect.value : '';
          const otherReason = pauseReasonOther ? pauseReasonOther.value.trim() : '';
          const errorElement = document.getElementById('pauseReasonError');
          
          // Hide any existing error
          if (errorElement) {
            errorElement.style.display = 'none';
          }
          
          if (!selectedReason) {
            if (errorElement) {
              errorElement.querySelector('span').textContent = 'Selecteer een reden voor de pauze';
              errorElement.style.display = 'flex';
            }
            return;
          }
          
          if (selectedReason === 'other' && !otherReason) {
            if (errorElement) {
              errorElement.querySelector('span').textContent = 'Specificeer uw reden voor de pauze';
              errorElement.style.display = 'flex';
            }
            return;
          }
          
          // Store pause reason and expiry date
          const pauseData = {
            reason: selectedReason,
            other_reason: selectedReason === 'other' ? otherReason : null,
            paused_at: new Date().toISOString(),
expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now;
          };
          
          localStorage.setItem('pauseData', JSON.stringify(pauseData));
        }
        
        // Close modal first
        closeModal();
        
        // Update UI and save status
        updatePauseStatus(isPausing);
      });
    }
    
    // Close modal when clicking backdrop
    const overlay = modal.querySelector('.pause-confirmation-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function() {
        // Reset checkbox to original state
        const pauseCheckbox = document.getElementById('pauseLeads');
        pauseCheckbox.checked = !isPausing;
        
        // Close modal
        closeModal();
      });
    }
    
    // Close modal with Escape key
    const escapeHandler = function(e) {
      if (e.key === 'Escape') {
        // Reset checkbox to original state
        const pauseCheckbox = document.getElementById('pauseLeads');
        pauseCheckbox.checked = !isPausing;
        
        // Close modal
        closeModal();
        
        // Remove event listener
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    
    document.addEventListener('keydown', escapeHandler);
  }, 100);
}

// Function to scroll to pause section
function scrollToPauseSection() {
  const pauseSection = document.querySelector('.pause-requests-card');
  if (pauseSection) {
    pauseSection.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  }
}

// Function to update pause notification visibility
function updatePauseNotification(isPaused) {
  // Update old notification (for backwards compatibility)
  const pauseNotification = document.getElementById('pauseNotification');
  if (pauseNotification) {
    if (isPaused) {
      pauseNotification.style.display = 'flex';
    } else {
      pauseNotification.style.display = 'none';
    }
  }
  
  // Update new warning banner
  const pauseWarningBanner = document.getElementById('pauseWarningBanner');
  if (pauseWarningBanner) {
    if (isPaused) {
      pauseWarningBanner.classList.add('show');
    } else {
      pauseWarningBanner.classList.remove('show');
    }
  }
}

// Function to update pause status
function updatePauseStatus(isPausing, showNotification = true) {
  // Find pause status elements (might not exist in new design)
  const pauseStatus = document.getElementById('pauseStatus');
  const statusIcon = document.querySelector('.status-icon i');
  const leadLimitSlider = document.getElementById('leadLimitSlider');
  
  // Disable/enable slider based on pause status
  if (leadLimitSlider) {
    leadLimitSlider.disabled = isPausing;
    
    // Update progress bar color when disabled
    const progressBar = document.querySelector('.modern-slider-progress');
    if (progressBar) {
      if (isPausing) {
        progressBar.style.backgroundColor = '#D1D5DB';
      } else {
        progressBar.style.backgroundColor = '#ea580d';
      }
    }
  }
  
  if (isPausing) {
    // Update status text if element exists
    if (pauseStatus) {
      pauseStatus.textContent = "Aanvragen staan op pauze";
      pauseStatus.classList.remove("status-active");
      pauseStatus.classList.add("status-paused");
    }
    
    log("Aanvragen gepauzeerd");

    // Update icon color if exists
    if (statusIcon) {
      statusIcon.style.color = "#ea0d0d";
    }

    // Show pause notification/warning banner
    updatePauseNotification(true);

    // Save pause status (only show notification if requested)
    if (showNotification) {
      saveLeadPauseStatus(true);
    } else {
      // Save without notification for initialization
      saveLeadPauseStatusSilent(true);
    }
  } else {
    // Update status text if element exists
    if (pauseStatus) {
      pauseStatus.textContent = "Aanvragen zijn actief";
      pauseStatus.classList.remove("status-paused");
      pauseStatus.classList.add("status-active");
    }
    
    log("Aanvragen geactiveerd");

    // Update icon color if exists
    if (statusIcon) {
      statusIcon.style.color = "#28a745";
    }

    // Hide pause notification/warning banner
    updatePauseNotification(false);

    // Save pause status (only show notification if requested)
    if (showNotification) {
      saveLeadPauseStatus(false);
    } else {
      // Save without notification for initialization
      saveLeadPauseStatusSilent(false);
    }
  }
}

// Function to show limit confirmation modal
function showLimitConfirmationModal(newValue, oldValue) {
  const limitText = newValue === 100 ? 'onbeperkt' : newValue + ' aanvragen';
  const oldLimitText = oldValue === 100 ? 'onbeperkt' : oldValue + ' aanvragen';
  
  const confirmationMessage = `Weet je zeker dat je je maandelijkse limiet wilt wijzigen? Deze wijziging wordt direct van kracht.`;
  
  // Create confirmation modal
  const modal = document.createElement('div');
  modal.className = 'confirmation-modal';
  modal.innerHTML = 
    '<div class="confirmation-modal-overlay"></div>' +
    '<div class="confirmation-modal-content">' +
      '<div class="confirmation-modal-header">' +
        '<div class="confirmation-modal-header-content">' +
          '<div class="confirmation-modal-icon">' +
            '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>' +
            '</svg>' +
          '</div>' +
          '<div>' +
            '<h3 class="confirmation-modal-title">Limiet wijzigen</h3>' +
            '<p class="confirmation-modal-subtitle">Bevestig uw wijziging</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="confirmation-modal-body">' +
        '<p>' + confirmationMessage + '</p>' +
        '<div class="limit-change-visualization">' +
          '<div class="limit-change-content">' +
            '<div class="limit-badge">' +
              '<div class="limit-badge-label">Huidige limiet</div>' +
              '<div class="limit-badge-value">' + oldValue + '</div>' +
              '<div class="limit-badge-unit">aanvragen</div>' +
            '</div>' +
            '<div class="limit-arrow">' +
              '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>' +
              '</svg>' +
            '</div>' +
            '<div class="limit-badge new">' +
              '<div class="limit-badge-label">Nieuwe limiet</div>' +
              '<div class="limit-badge-value">' + newValue + '</div>' +
              '<div class="limit-badge-unit">aanvragen</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="confirmation-info-box">' +
          '<div class="confirmation-info-content">' +
            '<svg class="confirmation-info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
            '</svg>' +
            '<div class="confirmation-info-text">' +
              '<strong>Let op:</strong> Wijzigingen worden direct toegepast en zijn zichtbaar in je volgende factuurperiode.' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="confirmation-modal-footer">' +
        '<button class="btn btn-secondary" id="cancelLimitBtn">Annuleren</button>' +
        '<button class="btn btn-primary" id="confirmLimitBtn">Bevestigen</button>' +
      '</div>' +
    '</div>';
  
  document.body.appendChild(modal);
  
  // Add event listeners
  document.getElementById('cancelLimitBtn').addEventListener('click', function() {
    // Reset slider to original value
    const slider = document.getElementById('leadLimitSlider');
    const progressBar = document.querySelector('.modern-slider-progress');
    
    slider.value = oldValue;
    
    if (progressBar) {
      progressBar.style.width = oldValue + '%';
    }
    
    // Update display
    updateCompactDisplay(oldValue);
    
    document.body.removeChild(modal);
  });
  
  document.getElementById('confirmLimitBtn').addEventListener('click', async function() {
    // Save the new limit
    const newLimit = parseInt(document.getElementById('leadLimitSlider').value);
    
    try {
      // Show loading state
      this.disabled = true;
      this.textContent = 'Opslaan...';
      
      const response = await fetch('/api/user/lead-limit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
lead_limit: newLimit
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Show success notification
        if (typeof displayNotification === 'function') {
          displayNotification('Lead limiet succesvol bijgewerkt', 'success', 4000);
        }
        
        // Close modal
        document.body.removeChild(modal);
        
        // Reload page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
      } else {
        throw new Error(result.message || 'Er is een fout opgetreden bij het opslaan');
      }
      
    } catch (error) {
      console.error('Error saving lead limit:', error);
      if (typeof displayNotification === 'function') {
        displayNotification('Fout bij opslaan van limiet: ' + error.message, 'error', 5000);
      }
      
      // Reset button state
      this.disabled = false;
      this.textContent = 'Bevestigen';
    }
  });
  
  // Close modal when clicking overlay
  modal.querySelector('.confirmation-modal-overlay').addEventListener('click', function() {
    document.getElementById('cancelLimitBtn').click();
  });
}

// Helper function to show notifications (unified system)
function notifyUser(message, type = 'info') {
  if (typeof window.showNotification === 'function') {
    // Gebruik het globale, consistente notificatiesysteem
    window.showNotification(message, type, 5000, false)
    return
  }
  // Fallback: minimal console output (geen Bootstrap alert markup)
  try {
    console.log(`[${type}] ${message}`)
  } catch (_) {}
}

// Voeg een directe functie toe om de omzet bij te werken vanuit de console
window.updateRevenue = (forceAmount) => {
  if (forceAmount !== undefined) {
    // Directe update met een specifiek bedrag
    document.querySelectorAll(".card-body").forEach((cardBody) => {
      const titleElement = cardBody.querySelector(".card-title")
      if (titleElement && titleElement.textContent.trim() === "Gerealiseerde omzet") {
        const valueElement = cardBody.querySelector('div[style*="font-size: 2rem"]')
        if (valueElement) {
          valueElement.textContent = `€${forceAmount}`
          log("Gerealiseerde omzet geforceerd bijgewerkt naar:", forceAmount)
        }
      }
    })
return forceAmount;
  } else {
    // Normale update
    return updateEstimatedRevenue()
  }
}

// Voeg deze code toe aan het einde van het bestand
// Maak een MutationObserver om wijzigingen in de DOM te detecteren
document.addEventListener("DOMContentLoaded", () => {
  log("DOMContentLoaded event - Setting up MutationObserver")

  // Initiële update
  updateEstimatedRevenue()

  // Optimized MutationObserver with debouncing
const debouncedUpdateRevenue = debounce(() => {
  updateEstimatedRevenue();
  const leads = collectLeadsFromTable();
  saveLeadsToStorage(leads);
}, 300);

const tableObserver = new MutationObserver((mutations) => {
  let shouldUpdate = false;
  mutations.forEach((mutation) => {
    if (mutation.type === "attributes" && 
        (mutation.attributeName === "data-lead-status" || mutation.attributeName === "data-lead-amount")) {
      shouldUpdate = true;
    }
  });
  if (shouldUpdate) {
    debouncedUpdateRevenue();
  }
})

  // Observeer de tabel voor wijzigingen in attributen
  const allLeadsTable = document.getElementById("allLeadsTable")
  if (allLeadsTable) {
    tableObserver.observe(allLeadsTable, {
      attributes: true,
      attributeFilter: ["data-lead-status", "data-lead-amount"],
      subtree: true,
      childList: true,
    })
    log("MutationObserver set up for allLeadsTable")
  }

  // Stel een interval in om de omzet periodiek bij te werken (als fallback)
  setInterval(updateEstimatedRevenue, 10000)

  // Voeg event listeners toe aan de saveStatusBtn voor alle leads
  document.addEventListener("click", (event) => {
    if (event.target && event.target.id === "saveStatusBtn") {
      log("saveStatusBtn clicked, will update revenue after a delay")
      setTimeout(updateEstimatedRevenue, 200)

      // Sla de leads op in localStorage wanneer er op de saveStatusBtn wordt geklikt
      setTimeout(() => {
        const leads = collectLeadsFromTable()
        saveLeadsToStorage(leads)
      }, 300)
    }
  })

  // Laad de opgeslagen leads uit localStorage
  updateTableWithSavedLeads()

  // Laad de lead instellingen uit de database
  loadLeadSettings()
})

// Voeg deze functie toe om de status en bedrag van een lead direct te wijzigen vanuit de console
window.updateLead = (leadId, status, amount) => {
  const leadRows = document.querySelectorAll(`.lead-row[data-lead-id="${leadId}"]`)
  if (leadRows.length === 0) {
    console.error(`Geen lead gevonden met ID ${leadId}`)
return false;
  }

  updateLeadStatus(leadId, status, amount)
  log(`Lead ${leadId} bijgewerkt: status=${status}, amount=${amount}`)
return true;
}

// Dummy function to satisfy the linter. Replace with actual implementation.
function updateLeadStatistics() {
  log("updateLeadStatistics wordt uitgevoerd")

  // Tel het aantal leads per status
  const allLeads = document.querySelectorAll("#allLeadsTable tbody tr.lead-row")
  const newLeads = document.querySelectorAll("#allLeadsTable tbody tr.lead-row[data-lead-status='new']")
  const acceptedLeads = document.querySelectorAll("#allLeadsTable tbody tr.lead-row[data-lead-status='accepted']")
  const rejectedLeads = document.querySelectorAll("#allLeadsTable tbody tr.lead-row[data-lead-status='rejected']")

  // Update de badges in de tabs
  const allBadge = document.querySelector("#all-tab .badge")
  const newBadge = document.querySelector("#new-tab .badge")
  const acceptedBadge = document.querySelector("#accepted-tab .badge")
  const rejectedBadge = document.querySelector("#rejected-tab .badge")

if (allBadge) allBadge.textContent = allLeads.length;
if (newBadge) newBadge.textContent = newLeads.length;
if (acceptedBadge) acceptedBadge.textContent = acceptedLeads.length;
if (rejectedBadge) rejectedBadge.textContent = rejectedLeads.length;

  // Update de statistieken kaarten
  document.querySelectorAll(".card-body").forEach((cardBody) => {
    const titleElement = cardBody.querySelector(".card-title")
    if (titleElement) {
      const title = titleElement.textContent.trim()
      const valueElement = cardBody.querySelector('div[style*="font-size: 2rem"]')

      if (valueElement) {
        if (title === "Totaal aantal aanvragen") {
valueElement.textContent = allLeads.length;
        } else if (title === "Nieuwe aanvragen") {
valueElement.textContent = newLeads.length;
        } else if (title === "Gewonnen klanten") {
valueElement.textContent = acceptedLeads.length;
        }
      }
    }
  })

  log("Statistieken bijgewerkt")
}

// Add a function to ensure the DOM is fully loaded before initializing
document.addEventListener("DOMContentLoaded", () => {
  log("DOM fully loaded, initializing lead management")

  // Load saved leads from localStorage
  setTimeout(() => {
    const loaded = updateTableWithSavedLeads()
    log("Leads loaded from localStorage:", loaded)

    // Update filtered tables after loading
    updateFilteredTables()

    // Update statistics
    updateLeadStatistics()
    updateEstimatedRevenue()
    
    // Ensure current limit is displayed after DOM is fully loaded
    setTimeout(() => {
      const savedLimit = localStorage.getItem("leadLimit")
      if (savedLimit) {
        log("Setting current limit from localStorage:", savedLimit)
        updateLimitStatusCard(parseInt(savedLimit))
      }
    }, 200)
  }, 100)
})

// Make displayNotification globally accessible
window.displayNotification = displayNotification;

// Functie om gebruikersgegevens bij te werken
async function updateUser(userData) {
  try {
    console.log("Versturen van gebruikersgegevens:", userData)

    // Zorg ervoor dat is_admin correct wordt geformatteerd voor de server
    // Sommige backends verwachten een nummer (0/1) in plaats van een boolean
    const formattedData = {
      ...userData,
      is_admin: userData.is_admin ? 1 : 0,
    }

    // Gebruik de admin API endpoint die alle velden ondersteunt
    const response = await fetch(`/admin/api/users/${userData.id}`, {
      method: "POST", // De admin route gebruikt POST in plaats van PUT
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_name: userData.company_name,
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        phone: userData.phone,
        is_admin: formattedData.is_admin,
        status: userData.status,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Server response error:", response.status, errorData)
      throw new Error(`Er is iets misgegaan bij het bijwerken van de gebruiker (${response.status})`)
    }

    const result = await response.json()
    console.log("Bijwerken succesvol:", result)

    // Sluit de modal en vernieuw de pagina
    document.getElementById("userModal").classList.remove("show")
    location.reload()
  } catch (error) {
    console.error("Fout bij het bijwerken van gebruiker:", error)

    // Probeer de oude API endpoint als fallback
    try {
      console.log("Proberen met oude API endpoint als fallback")
      const response = await fetch(`/api/users/${userData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: userData.company_name,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone,
          isAdmin: userData.is_admin,
          status: userData.status,
        }),
      })

      if (!response.ok) {
        throw new Error(`Fallback API fout: ${response.status}`)
      }

      const result = await response.json()
      console.log("Bijwerken via fallback succesvol:", result)

      // Sluit de modal en vernieuw de pagina
      document.getElementById("userModal").classList.remove("show")
      location.reload()
    } catch (fallbackError) {
      console.error("Fout bij fallback:", fallbackError)
      alert("Er is een fout opgetreden bij het bijwerken van de gebruiker: " + error.message)
    }
  }
}

// Functie om de gebruikersmodal te openen en in te vullen
function openUserModal(userId) {
  console.log("openUserModal aangeroepen voor gebruiker ID:", userId)

  // Haal gebruikersgegevens op van de server
  fetch(`/admin/api/users/${userId}`)
    .then((response) => {
      if (!response.ok) {
        console.log("Admin API endpoint niet gevonden, probeer standaard API")
        return fetch(`/api/users/${userId}`)
      }
      return response
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      console.log("Gebruikersgegevens opgehaald:", data)

      // Haal de gebruiker uit de response (afhankelijk van API formaat)
      const user = data.user || data

      if (!user) {
        console.error("Geen gebruikersgegevens gevonden in response")
        return
      }

      // Vul de modal in met gebruikersgegevens
      document.getElementById("modalTitle").textContent = "Gebruiker bewerken"
      document.getElementById("userId").value = user.id
      document.getElementById("companyName").value = user.company_name || ""
      document.getElementById("email").value = user.email || ""

      // Deze velden worden nu correct ingevuld
      document.getElementById("firstName").value = user.first_name || ""
      document.getElementById("lastName").value = user.last_name || ""
      document.getElementById("phone").value = user.phone || ""

      // Selecteer de juiste optie in de dropdown menu's
      const roleSelect = document.getElementById("role")
      roleSelect.value = user.is_admin ? "1" : "0"

      const statusSelect = document.getElementById("status")
      statusSelect.value = user.status || "active"

      console.log("Modal ingevuld met gegevens:", {
        id: user.id,
        company_name: user.company_name,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        is_admin: user.is_admin,
        status: user.status,
      })

      // Open de modal
      const modal = document.getElementById("userModal")
      modal.classList.add("show")
    })
    .catch((error) => {
      console.error("Fout bij ophalen gebruikersgegevens:", error)
      alert("Er is een fout opgetreden bij het ophalen van de gebruikersgegevens.")
    })
}


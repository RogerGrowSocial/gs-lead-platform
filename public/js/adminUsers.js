document.addEventListener("DOMContentLoaded", () => {
  
  // Function to get orange color for avatars (consistent with users table)
  function getOrangeColor() {
    return '#ea5d0d'; // Primary orange color
  }

  // Function to update avatar colors for existing users
  function updateAvatarColors() {
    console.log('Updating user avatar colors...');
    const avatars = document.querySelectorAll('.user-avatar');
    
    avatars.forEach(avatar => {
      const initials = avatar.textContent.trim();
      if (initials) {
        const color = getOrangeColor();
        avatar.style.backgroundColor = color;
        avatar.style.color = 'white'; // White text for better contrast
        console.log(`Updated user avatar for "${initials}" with orange color: ${color}`);
      }
    });
  }

  // Update avatar colors when page loads
  setTimeout(() => {
    updateAvatarColors();
  }, 100);
    // Selecteer alle potlood-icoon elementen binnen de laatste kolom van de tabel
    const pencilIcons = document.querySelectorAll(".users-table tbody td:last-child i")
  
    pencilIcons.forEach((icon) => {
      icon.addEventListener("click", function () {
        console.log("Knop succesvol gedrukt")
  
        // Get the modal
        const modal = document.getElementById("userEditModal")
  
        // Get the row data
        const row = this.closest("tr")
        const userId = row.querySelector("td:first-child").textContent
        const companyName = row.querySelector("td:nth-child(2)").textContent
        const balance = row.querySelector("td:nth-child(4)").textContent
        const paymentMethod = row.querySelector("td:nth-child(5)").textContent
  
        // Populate the form
        document.getElementById("userId").value = userId
        document.getElementById("companyName").value = companyName
        document.getElementById("balance").value = balance
  
        // Update payment method status
        const paymentStatus = document.getElementById("paymentMethodStatus")
        if (paymentMethod && paymentMethod !== "Geen") {
          paymentStatus.innerHTML = `
            <div class="connected">
              <strong>Gekoppeld:</strong> ${paymentMethod}
              <button type="button" class="btn btn-secondary btn-sm" id="changePaymentMethod">Wijzigen</button>
            </div>
          `
          paymentStatus.className = "payment-status connected"
        } else {
          paymentStatus.innerHTML = `
            <div class="not-connected">
              <strong>Niet gekoppeld</strong>
              <button type="button" class="btn btn-primary btn-sm" id="addPaymentMethod">Betaalmethode toevoegen</button>
            </div>
          `
          paymentStatus.className = "payment-status not-connected"
        }
  
        // Fetch additional user data (email, etc.) from the server
        fetchUserDetails(userId)
  
        // Show the modal
        modal.style.display = "block"
      })
    })
  
    // Setup modal close functionality if the modal exists
    const modal = document.getElementById("userEditModal")
    if (modal) {
      const closeBtn = modal.querySelector(".close")
      const cancelBtn = document.getElementById("cancelEdit")
      const editForm = document.getElementById("editUserForm")
  
      // Close the modal when clicking the close button
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none"
      })
  
      // Close the modal when clicking the cancel button
      cancelBtn.addEventListener("click", () => {
        modal.style.display = "none"
      })
  
      // Close the modal when clicking outside of it
      window.addEventListener("click", (event) => {
        if (event.target === modal) {
          modal.style.display = "none"
        }
      })
  
      // Handle form submission
      editForm.addEventListener("submit", (event) => {
        event.preventDefault()
  
        const userId = document.getElementById("userId").value
        const companyName = document.getElementById("companyName").value
        const email = document.getElementById("email").value
        const balance = document.getElementById("balance").value
  
        // Send data to server
        updateUser({
          userId,
          companyName,
          email,
          balance,
        })
      })
  
      // Add event delegation for payment method buttons
      document.addEventListener("click", (event) => {
        if (event.target.id === "addPaymentMethod" || event.target.id === "changePaymentMethod") {
          const userId = document.getElementById("userId").value
          // Redirect to payment method setup page or show another modal
          alert(`Redirect to payment setup for user ${userId}`)
          // You would implement the actual redirect or modal here
        }
      })
    }
  
    // Function to fetch user details from the server
    function fetchUserDetails(userId) {
      // Make an AJAX request to get user details
      fetch(`/api/users/${userId}`)
        .then((response) => response.json())
        .then((data) => {
          document.getElementById("email").value = data.email
          // Populate other fields as needed
        })
        .catch((error) => {
          console.error("Error fetching user details:", error)
        })
    }
  
    // Function to update user data
    function updateUser(userData) {
      console.log("Updating user with data:", userData)
  
      fetch(`/api/users/${userData.userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            alert("Gebruiker bijgewerkt!")
            modal.style.display = "none"
            // Refresh the page to show updated data
            location.reload()
          } else {
            alert("Er is een fout opgetreden bij het bijwerken van de gebruiker.")
          }
        })
        .catch((error) => {
          console.error("Error updating user:", error)
          alert("Er is een fout opgetreden bij het bijwerken van de gebruiker.")
        })
    }
  })
  
  
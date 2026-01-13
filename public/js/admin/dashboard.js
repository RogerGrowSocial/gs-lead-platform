document.addEventListener("DOMContentLoaded", () => {
    // Sidebar toggle functionality is handled by main.js to avoid conflicts
  
    // Close dropdowns when clicking outside
    document.addEventListener("click", (event) => {
      const dropdowns = document.querySelectorAll(".dropdown-menu.show")
      dropdowns.forEach((dropdown) => {
        if (!event.target.closest(".dropdown")) {
          dropdown.classList.remove("show")
        }
      })
    })
  
    // Responsive adjustments are handled by main.js to avoid conflicts
  })
  
  
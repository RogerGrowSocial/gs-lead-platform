// Simple test to check if dropdown functionality is working
console.log('=== Dropdown Test ===');

// Check if elements exist
const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
console.log('Dropdown toggles found:', dropdownToggles.length);

if (dropdownToggles.length > 0) {
  console.log('Testing dropdown functionality...');
  
  // Test if click event works
  const firstToggle = dropdownToggles[0];
  console.log('First toggle:', firstToggle);
  
  // Add a simple click handler for testing
  firstToggle.addEventListener('click', function(e) {
    console.log('Dropdown toggle clicked!');
    e.preventDefault();
    e.stopPropagation();
    
    const dropdown = this.closest('.dropdown');
    const menu = dropdown.querySelector('.dropdown-menu');
    
    if (menu.classList.contains('show')) {
      menu.classList.remove('show');
      this.classList.remove('active');
      console.log('Dropdown closed');
    } else {
      menu.classList.add('show');
      this.classList.add('active');
      console.log('Dropdown opened');
    }
  });
  
  console.log('Test click handler added to first dropdown');
} else {
  console.log('No dropdown toggles found - check HTML rendering');
}

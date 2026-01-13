// Debug script to test the enhanced user dropdown
console.log('🔍 Debug: Testing enhanced user dropdown...');

// Check if elements exist
const userSearchInput = document.getElementById('modalUserSearchInput');
const usersDropdown = document.getElementById('usersDropdown');
const usersList = document.getElementById('usersList');
const requestAssignedTo = document.getElementById('requestAssignedTo');

console.log('Elements found:');
console.log('- userSearchInput:', userSearchInput);
console.log('- usersDropdown:', usersDropdown);
console.log('- usersList:', usersList);
console.log('- requestAssignedTo:', requestAssignedTo);

// Check if fetchUsers function exists
if (typeof fetchUsers === 'function') {
    console.log('✅ fetchUsers function exists');
    console.log('Calling fetchUsers...');
    fetchUsers();
} else {
    console.log('❌ fetchUsers function not found');
}

// Check if initializeEnhancedUserDropdown function exists
if (typeof initializeEnhancedUserDropdown === 'function') {
    console.log('✅ initializeEnhancedUserDropdown function exists');
} else {
    console.log('❌ initializeEnhancedUserDropdown function not found');
}

// Test API endpoint
console.log('Testing API endpoint...');
fetch('/api/users/with-details', {
    method: 'GET',
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
    }
})
.then(response => {
    console.log('API Response status:', response.status);
    if (response.ok) {
        return response.json();
    } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
})
.then(data => {
    console.log('API Response data:', data);
    console.log('Number of users:', data.length);
})
.catch(error => {
    console.error('API Error:', error);
});

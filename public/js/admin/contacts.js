// Contacts page JavaScript

document.addEventListener('DOMContentLoaded', function() {
  var searchInput = document.getElementById('searchInput');
  var statusSelect = document.getElementById('statusSelect');
  var prioritySelect = document.getElementById('prioritySelect');
  var contactsTableBody = document.getElementById('contactsTableBody');

  // Filter contacts
  function applyFilters() {
    var search = (searchInput && searchInput.value) ? searchInput.value.toLowerCase() : '';
    var status = (statusSelect && statusSelect.value) ? statusSelect.value : 'all';
    var priority = (prioritySelect && prioritySelect.value) ? prioritySelect.value : 'all';

    var rows = contactsTableBody ? contactsTableBody.querySelectorAll('.table-body-row') : [];
    rows.forEach(function(row) {
      var text = row.textContent.toLowerCase();
      var statusBadges = row.querySelectorAll('.status-badge');
      var rowStatus = '';
      var rowPriority = '';
      
      if (statusBadges.length > 0) {
        rowStatus = statusBadges[0].textContent.toLowerCase();
        if (statusBadges.length > 1) {
          rowPriority = statusBadges[1].textContent.toLowerCase();
        }
      }

      var matchesSearch = !search || text.includes(search);
      var matchesStatus = status === 'all' || rowStatus.includes(status);
      var matchesPriority = priority === 'all' || rowPriority.includes(priority) ||
        (priority === 'normal' && rowPriority.includes('normaal'));

      row.style.display = (matchesSearch && matchesStatus && matchesPriority) ? '' : 'none';
    });

    // Update results count
    var visibleCount = Array.from(rows).filter(function(r) {
      return r.style.display !== 'none';
    }).length;
    var info = document.getElementById('paginationInfo');
    if (info) {
      info.textContent = 'Toont ' + visibleCount + ' contactpersonen';
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }
  if (statusSelect) {
    statusSelect.addEventListener('change', applyFilters);
  }
  if (prioritySelect) {
    prioritySelect.addEventListener('change', applyFilters);
  }

  // Make table rows clickable - navigate to contact detail page
  var contactRows = document.querySelectorAll('.table-body-row[data-contact-id]');
  contactRows.forEach(function(row) {
    row.addEventListener('click', function(e) {
      // Don't navigate if clicking on the actions button or drag handle
      if (e.target.closest('.actions-button') || e.target.closest('.customer-drag-handle') || e.target.closest('td[onclick]')) {
        return;
      }
      
      var contactId = this.getAttribute('data-contact-id');
      if (contactId) {
        window.location.href = '/admin/contacts/' + contactId;
      }
    });
  });
});

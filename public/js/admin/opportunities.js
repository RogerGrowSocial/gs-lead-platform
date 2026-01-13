// Search functionality
document.getElementById('opportunitiesSearchInput')?.addEventListener('input', function(e) {
  const searchTerm = e.target.value.toLowerCase();
  filterOpportunities();
});

// Filter dropdowns
document.getElementById('statusSelect')?.addEventListener('change', filterOpportunities);
document.getElementById('prioritySelect')?.addEventListener('change', filterOpportunities);
document.getElementById('assigneeSelect')?.addEventListener('change', filterOpportunities);

function filterOpportunities() {
  const searchTerm = document.getElementById('opportunitiesSearchInput')?.value.toLowerCase() || '';
  const status = document.getElementById('statusSelect')?.value || 'all';
  const priority = document.getElementById('prioritySelect')?.value || 'all';
  const assignee = document.getElementById('assigneeSelect')?.value || 'all';
  
  // Reload page with filters
  const params = new URLSearchParams();
  if (searchTerm) params.set('search', searchTerm);
  if (status !== 'all') params.set('status', status);
  if (priority !== 'all') params.set('priority', priority);
  if (assignee !== 'all') params.set('assignee', assignee);
  
  window.location.href = `/admin/opportunities?${params.toString()}`;
}

// Pagination
function changePage(action) {
  const currentPage = parseInt(new URLSearchParams(window.location.search).get('page') || '1');
  let newPage = currentPage;
  
  if (action === 'prev') newPage = Math.max(1, currentPage - 1);
  else if (action === 'next') newPage = currentPage + 1;
  else if (action === 'goto') newPage = parseInt(event.target.dataset.page);
  
  const params = new URLSearchParams(window.location.search);
  params.set('page', newPage);
  window.location.href = `/admin/opportunities?${params.toString()}`;
}

// Assign to suggested rep
function assignToSuggested(opportunityId, repId) {
  if (!confirm('Weet je zeker dat je deze kans wilt toewijzen aan de voorgestelde sales rep?')) return;
  
  fetch(`/admin/opportunities/${opportunityId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rep_id: repId })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert('Kans succesvol toegewezen!');
      window.location.reload();
    } else {
      alert('Fout bij toewijzen: ' + (data.error || 'Onbekende fout'));
    }
  })
  .catch(err => {
    console.error('Error:', err);
    alert('Fout bij toewijzen');
  });
}

// Delegated click for AI assign buttons (no inline onclick)
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-assign]');
  if (!btn) return;
  e.stopPropagation(); // Prevent card click from firing
  const oppId = btn.getAttribute('data-opp-id');
  const repId = btn.getAttribute('data-rep-id');
  if (oppId && repId) assignToSuggested(oppId, repId);
});

// View opportunity - navigates to detail page
function viewOpportunity(opportunityId) {
  window.location.href = `/admin/opportunities/${opportunityId}`;
}

// New opportunity button
document.getElementById('newOpportunityBtn')?.addEventListener('click', function() {
  window.location.href = '/admin/opportunities/new';
});



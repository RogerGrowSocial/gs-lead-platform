let currentDealId = null;

function openReminder(dealId){
  currentDealId = dealId;
  const m = document.getElementById('dealReminderModal');
  if (m) m.style.display = 'flex';
}

function closeReminder(){
  const m = document.getElementById('dealReminderModal');
  if (m) m.style.display = 'none';
}

async function saveReminder(){
  const remindAt = document.getElementById('remindAt')?.value;
  const type = document.getElementById('remindType')?.value || 'nudge';
  const note = document.getElementById('remindNote')?.value || '';
  if (!currentDealId || !remindAt) {
    alert('Kies een datum/tijd voor de reminder.');
    return;
  }
  try{
    const res = await fetch(`/admin/api/deals/${currentDealId}/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remind_at: remindAt, type, note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fout');
    if (window.showNotification) window.showNotification('Reminder ingepland', 'success', 3000);
    closeReminder();
  } catch(e){
    if (window.showNotification) window.showNotification('Kon reminder niet opslaan: ' + e.message, 'error', 5000);
  }
}

window.openReminder = openReminder;
window.closeReminder = closeReminder;
window.saveReminder = saveReminder;

// Kanban: drag-and-drop om deal stage te wijzigen
(function initDealsKanbanDragDrop() {
  const kanban = document.getElementById('dealsKanban');
  if (!kanban) return;

  const cardWrappers = kanban.querySelectorAll('.deal-kanban-card-wrapper');
  const dropZones = kanban.querySelectorAll('.deals-kanban-column-cards');

  cardWrappers.forEach(function (el) {
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', function (e) {
      const dealId = el.getAttribute('data-deal-id');
      if (dealId) {
        e.dataTransfer.setData('text/plain', dealId);
        e.dataTransfer.effectAllowed = 'move';
      }
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', function () {
      el.classList.remove('dragging');
      dropZones.forEach(function (z) { z.classList.remove('deals-drop-target'); });
    });
  });

  dropZones.forEach(function (zone) {
    const column = zone.closest('.deals-kanban-column');
    const stage = column ? column.getAttribute('data-stage') : null;
    if (!stage) return;

    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('deals-drop-target');
    });
    zone.addEventListener('dragleave', function (e) {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('deals-drop-target');
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('deals-drop-target');
      const dealId = e.dataTransfer.getData('text/plain');
      if (!dealId) return;

      (async function () {
        try {
          const res = await fetch('/admin/api/deals/' + dealId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: stage })
          });
          const data = await res.json().catch(function () { return {}; });
          if (!res.ok) throw new Error(data.error || 'Fout bij bijwerken');
          if (window.showNotification) window.showNotification('Deal bijgewerkt', 'success', 2500);
          window.location.reload();
        } catch (err) {
          if (window.showNotification) window.showNotification(err.message || 'Kon deal niet bijwerken', 'error', 5000);
        }
      })();
    });
  });
})();



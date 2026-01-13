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



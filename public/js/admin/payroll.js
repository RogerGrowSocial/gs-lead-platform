// Payroll Management JavaScript

let currentTab = 'scales';
let editingScaleId = null;

// Tab switching
window.switchTab = function(tab) {
  currentTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.payroll-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.payroll-tab-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
  const activeContent = document.getElementById(`${tab}-tab`);
  activeContent.classList.add('active');
  activeContent.style.display = 'block';
  
  // Load data if needed
  if (tab === 'scales') {
    loadScales();
  }
};

// Load scales
async function loadScales() {
  const scalesList = document.getElementById('scalesList');
  scalesList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;"><i class="fas fa-spinner fa-spin"></i> Laden...</div>';
  
  try {
    const res = await fetch('/api/payroll/scales');
    const data = await res.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Fout bij laden schalen');
    }
    
    const scales = data.data || [];
    
    if (scales.length === 0) {
      scalesList.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
          <div style="font-size: 3rem; color: #d1d5db; margin-bottom: 1rem;">
            <i class="fas fa-layer-group"></i>
          </div>
          <h3 style="margin: 0 0 0.5rem 0; color: #374151;">Geen schalen</h3>
          <p style="color: #6b7280; margin: 0 0 1.5rem 0;">Maak je eerste salarisschaal aan om te beginnen.</p>
          <button class="btn-primary" onclick="openAddScaleModal()" style="padding: 0.625rem 1.25rem;">
            <i class="fas fa-plus"></i> Nieuwe schaal
          </button>
        </div>
      `;
      return;
    }
    
    scalesList.innerHTML = scales.map(scale => {
      const rateEuro = (scale.hourly_rate_cents / 100).toFixed(2);
      const isActive = scale.is_active !== false;
      const roles = scale.roles || [];
      const travelType = scale.travel_type || 'none';
      const travelAmount = scale.travel_amount_cents ? (scale.travel_amount_cents / 100).toFixed(2) : '0.00';
      
      // Format travel type label
      let travelLabel = '';
      if (travelType === 'per_km') {
        travelLabel = `€${travelAmount}/km`;
        if (scale.travel_max_km_per_day) {
          travelLabel += ` (max ${scale.travel_max_km_per_day} km/dag)`;
        }
        if (scale.travel_roundtrip) {
          travelLabel += ' retour';
        }
      } else if (travelType === 'per_day') {
        travelLabel = `€${travelAmount}/dag`;
      } else if (travelType === 'monthly') {
        travelLabel = `€${travelAmount}/maand`;
      }
      
      return `
        <div class="scale-card">
          <div class="scale-card-header">
            <div style="flex: 1;">
              <h3 class="scale-card-name">${escapeHtml(scale.name)}</h3>
              ${scale.description ? `<p class="scale-card-description">${escapeHtml(scale.description)}</p>` : ''}
              ${roles.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.5rem;">
                  ${roles.map(role => `
                    <span style="display: inline-flex; align-items: center; padding: 0.25rem 0.5rem; background: #eff6ff; color: #1e40af; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">
                      ${escapeHtml(role)}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
              ${travelLabel ? `
                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #6b7280;">
                  <i class="fas fa-car" style="margin-right: 0.25rem;"></i> Reiskosten: ${travelLabel}
                </div>
              ` : ''}
            </div>
            <div class="scale-card-rate">
              <p class="scale-card-rate-value">€${rateEuro}</p>
              <p class="scale-card-rate-label">/ uur</p>
            </div>
          </div>
          <div class="scale-card-footer">
            <div class="scale-card-status ${isActive ? 'active' : 'inactive'}">
              <i class="fas fa-circle" style="font-size: 0.5rem;"></i>
              ${isActive ? 'Actief' : 'Inactief'}
            </div>
            <div class="scale-card-actions">
              <button class="scale-card-btn" onclick="editScale('${scale.id}')">
                <i class="fas fa-edit"></i> Bewerken
              </button>
              <button class="scale-card-btn danger" onclick="deleteScale('${scale.id}', '${escapeHtml(scale.name)}')">
                <i class="fas fa-trash"></i> Verwijderen
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading scales:', error);
    scalesList.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #dc2626;">
        <p>Fout bij laden: ${error.message}</p>
        <button class="btn-primary" onclick="loadScales()" style="margin-top: 1rem; padding: 0.625rem 1.25rem;">
          Opnieuw proberen
        </button>
      </div>
    `;
  }
}

// Open add scale modal
window.openAddScaleModal = function() {
  editingScaleId = null;
  document.getElementById('scaleModalTitle').textContent = 'Nieuwe schaal';
  document.getElementById('scaleForm').reset();
  document.getElementById('scaleId').value = '';
  
  // Reset roles checkboxes
  document.querySelectorAll('input[name="roles"]').forEach(cb => cb.checked = false);
  
  // Reset travel fields
  document.getElementById('travelType').value = '';
  updateTravelFields();
  
  // Hide errors
  document.getElementById('rolesError').style.display = 'none';
  
  document.getElementById('scaleModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

// Edit scale
window.editScale = async function(scaleId) {
  try {
    const res = await fetch('/api/payroll/scales');
    const data = await res.json();
    
    if (!data.ok) throw new Error(data.error);
    
    const scale = data.data.find(s => s.id === scaleId);
    if (!scale) throw new Error('Schaal niet gevonden');
    
    editingScaleId = scaleId;
    document.getElementById('scaleModalTitle').textContent = 'Schaal bewerken';
    document.getElementById('scaleId').value = scale.id;
    document.getElementById('scaleName').value = scale.name;
    document.getElementById('scaleHourlyRate').value = (scale.hourly_rate_cents / 100).toFixed(2);
    document.getElementById('scaleDescription').value = scale.description || '';
    
    // Set roles checkboxes
    document.querySelectorAll('input[name="roles"]').forEach(cb => {
      cb.checked = scale.roles && scale.roles.includes(cb.value);
    });
    
    // Set travel fields
    if (scale.travel_type) {
      document.getElementById('travelType').value = scale.travel_type;
      updateTravelFields();
      
      // Set travel amount based on type
      const travelAmount = (scale.travel_amount_cents || 0) / 100;
      if (scale.travel_type === 'per_km') {
        document.getElementById('travelAmountPerKm').value = travelAmount.toFixed(2);
        if (scale.travel_max_km_per_day) {
          document.getElementById('travelMaxKmPerDay').value = scale.travel_max_km_per_day;
        }
        document.getElementById('travelRoundtrip').checked = scale.travel_roundtrip !== false;
      } else if (scale.travel_type === 'per_day') {
        document.getElementById('travelAmountPerDay').value = travelAmount.toFixed(2);
      } else if (scale.travel_type === 'monthly') {
        document.getElementById('travelAmountMonthly').value = travelAmount.toFixed(2);
      }
    }
    
    updateRateDisplay();
    document.getElementById('scaleModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } catch (error) {
    console.error('Error loading scale:', error);
    if (window.showNotification) {
      window.showNotification('Fout bij laden schaal: ' + error.message, 'error');
    } else {
      alert('Fout bij laden schaal: ' + error.message);
    }
  }
};

// Close modal
window.closeScaleModal = function() {
  document.getElementById('scaleModal').style.display = 'none';
  document.body.style.overflow = '';
  editingScaleId = null;
  
  // Reset form
  document.getElementById('scaleForm').reset();
  document.querySelectorAll('input[name="roles"]').forEach(cb => cb.checked = false);
  updateTravelFields();
  document.getElementById('rolesError').style.display = 'none';
};

// Update travel fields based on selected type
window.updateTravelFields = function() {
  const travelType = document.getElementById('travelType').value;
  
  // Hide all travel field groups
  document.getElementById('travelPerKmFields').style.display = 'none';
  document.getElementById('travelPerDayFields').style.display = 'none';
  document.getElementById('travelMonthlyFields').style.display = 'none';
  
  // Show relevant fields based on type
  if (travelType === 'per_km') {
    document.getElementById('travelPerKmFields').style.display = 'block';
    // Make required fields required
    document.getElementById('travelAmountPerKm').required = true;
    document.getElementById('travelAmountPerDay').required = false;
    document.getElementById('travelAmountMonthly').required = false;
  } else if (travelType === 'per_day') {
    document.getElementById('travelPerDayFields').style.display = 'block';
    document.getElementById('travelAmountPerDay').required = true;
    document.getElementById('travelAmountPerKm').required = false;
    document.getElementById('travelAmountMonthly').required = false;
  } else if (travelType === 'monthly') {
    document.getElementById('travelMonthlyFields').style.display = 'block';
    document.getElementById('travelAmountMonthly').required = true;
    document.getElementById('travelAmountPerKm').required = false;
    document.getElementById('travelAmountPerDay').required = false;
  } else {
    // No type selected, remove required
    document.getElementById('travelAmountPerKm').required = false;
    document.getElementById('travelAmountPerDay').required = false;
    document.getElementById('travelAmountMonthly').required = false;
  }
};

// Update rate display
window.updateRateDisplay = function() {
  // Function kept for compatibility but no longer displays cents
  // The cents display has been removed from the UI
};

// Save scale
window.saveScale = async function(event) {
  event.preventDefault();
  
  const saveBtn = document.getElementById('saveScaleBtn');
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Opslaan...';
  
  // Hide previous errors
  document.getElementById('rolesError').style.display = 'none';
  
  try {
    // Get selected roles
    const selectedRoles = Array.from(document.querySelectorAll('input[name="roles"]:checked')).map(cb => cb.value);
    if (selectedRoles.length === 0) {
      document.getElementById('rolesError').style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
      return;
    }
    
    // Get travel type and amount
    const travelType = document.getElementById('travelType').value;
    if (!travelType) {
      if (window.showNotification) {
        window.showNotification('Selecteer een type reiskosten', 'error');
      } else {
        alert('Selecteer een type reiskosten');
      }
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
      return;
    }
    
    let travelAmountCents = 0;
    let travelMaxKmPerDay = null;
    let travelRoundtrip = true;
    
    if (travelType === 'per_km') {
      const amountPerKm = parseFloat(document.getElementById('travelAmountPerKm').value);
      if (isNaN(amountPerKm) || amountPerKm <= 0) {
        if (window.showNotification) {
          window.showNotification('Reiskosten bedrag per km moet groter zijn dan 0', 'error');
        } else {
          alert('Reiskosten bedrag per km moet groter zijn dan 0');
        }
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
        return;
      }
      travelAmountCents = Math.round(amountPerKm * 100);
      
      const maxKm = document.getElementById('travelMaxKmPerDay').value;
      if (maxKm && maxKm.trim() !== '') {
        const maxKmNum = parseInt(maxKm);
        if (!isNaN(maxKmNum) && maxKmNum > 0) {
          travelMaxKmPerDay = maxKmNum;
        }
      }
      
      travelRoundtrip = document.getElementById('travelRoundtrip').checked;
    } else if (travelType === 'per_day') {
      const amountPerDay = parseFloat(document.getElementById('travelAmountPerDay').value);
      if (isNaN(amountPerDay) || amountPerDay <= 0) {
        if (window.showNotification) {
          window.showNotification('Reiskosten bedrag per dag moet groter zijn dan 0', 'error');
        } else {
          alert('Reiskosten bedrag per dag moet groter zijn dan 0');
        }
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
        return;
      }
      travelAmountCents = Math.round(amountPerDay * 100);
    } else if (travelType === 'monthly') {
      const amountMonthly = parseFloat(document.getElementById('travelAmountMonthly').value);
      if (isNaN(amountMonthly) || amountMonthly <= 0) {
        if (window.showNotification) {
          window.showNotification('Reiskosten bedrag per maand moet groter zijn dan 0', 'error');
        } else {
          alert('Reiskosten bedrag per maand moet groter zijn dan 0');
        }
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
        return;
      }
      travelAmountCents = Math.round(amountMonthly * 100);
    }
    
    const formData = {
      name: document.getElementById('scaleName').value.trim(),
      hourly_rate_cents: Math.round(parseFloat(document.getElementById('scaleHourlyRate').value) * 100),
      description: document.getElementById('scaleDescription').value.trim() || null,
      roles: selectedRoles,
      travel_type: travelType,
      travel_amount_cents: travelAmountCents,
      travel_max_km_per_day: travelMaxKmPerDay,
      travel_roundtrip: travelRoundtrip
    };
    
    if (!formData.name) {
      if (window.showNotification) {
        window.showNotification('Naam is verplicht', 'error');
      } else {
        alert('Naam is verplicht');
      }
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
      return;
    }
    
    if (isNaN(formData.hourly_rate_cents) || formData.hourly_rate_cents < 0) {
      if (window.showNotification) {
        window.showNotification('Ongeldig uurtarief', 'error');
      } else {
        alert('Ongeldig uurtarief');
      }
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
      return;
    }
    
    const url = editingScaleId 
      ? `/api/payroll/scales/${editingScaleId}`
      : '/api/payroll/scales';
    const method = editingScaleId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await res.json();
    
    if (data.ok) {
      if (window.showNotification) {
        window.showNotification(data.message || 'Schaal succesvol opgeslagen', 'success');
      } else {
        alert(data.message || 'Schaal succesvol opgeslagen');
      }
      closeScaleModal();
      loadScales();
    } else {
      alert('Fout: ' + (data.error || 'Onbekende fout'));
    }
  } catch (error) {
    console.error('Error saving scale:', error);
    alert('Fout bij opslaan: ' + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
};

// Delete scale
window.deleteScale = async function(scaleId, scaleName) {
  if (!confirm(`Weet je zeker dat je de schaal "${scaleName}" wilt verwijderen?\n\nLet op: Als deze schaal wordt gebruikt door werknemers, kan deze niet worden verwijderd.`)) {
    return;
  }
  
  try {
    const res = await fetch(`/api/payroll/scales/${scaleId}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.ok) {
      if (window.showNotification) {
        window.showNotification(data.message || 'Schaal succesvol verwijderd', 'success');
      } else {
        alert(data.message || 'Schaal succesvol verwijderd');
      }
      loadScales();
    } else {
      alert('Fout: ' + (data.error || 'Onbekende fout'));
    }
  } catch (error) {
    console.error('Error deleting scale:', error);
    alert('Fout bij verwijderen: ' + error.message);
  }
};

// Helper function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Close modal on backdrop click
document.addEventListener('click', function(e) {
  const modal = document.getElementById('scaleModal');
  if (modal && e.target === modal) {
    closeScaleModal();
  }
});

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    if (currentTab === 'scales') {
      loadScales();
    }
  });
} else {
  if (currentTab === 'scales') {
    loadScales();
  }
}


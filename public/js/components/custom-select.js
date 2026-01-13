/* ============================================
   CUSTOM SELECT - IDEMPOTENT INITIALIZATION
   ============================================ */

// Idempotent Custom Select initializer with registry
(function () {
  const registry = new Map();

  function init(el) {
    if (!el || el.dataset.initialized === 'true') return;

    const id = el.dataset.selectId || el.getAttribute('data-select-id');
    if (!id) {
      console.warn('[CustomSelect] Missing data-select-id on element:', el);
      return;
    }
    if (registry.has(id)) {
      console.warn(`[CustomSelect] Duplicate data-select-id "${id}" detected. Skipping this instance.`);
      el.dataset.initialized = 'true';
      return;
    }

    const trigger = el.querySelector('[data-select-trigger]');
    const dropdown = el.querySelector('[data-select-dropdown]');
    const items = el.querySelectorAll('.custom-select-item');
    const valueDisplay = el.querySelector('[data-select-value]');
    const hiddenInput = el.querySelector('[data-select-input]');
    
    if (!trigger || !dropdown || !valueDisplay || !hiddenInput) {
      console.warn('[CustomSelect] Missing required elements in:', el);
      return;
    }
    
    // Click trigger to open/close
    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleDropdown(el);
    });
    
    // Click item to select
    items.forEach(item => {
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        selectItem(el, item, valueDisplay, hiddenInput);
      });
      
      // Keyboard navigation
      item.addEventListener('keydown', function(e) {
        handleItemKeydown(e, el, item, items, valueDisplay, hiddenInput);
      });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!el.contains(e.target)) {
        closeDropdown(el);
      }
    });
    
    // Keyboard navigation for trigger
    trigger.addEventListener('keydown', function(e) {
      handleTriggerKeydown(e, el, items);
    });

    el.dataset.initialized = 'true';
    registry.set(id, { el, trigger, dropdown, items, valueDisplay, hiddenInput });

    // Tell listeners this instance is ready
    el.dispatchEvent(new CustomEvent('custom-select:ready', {
      bubbles: true,
      detail: { id, el, hiddenInput }
    }));
  }

  function initAll(root = document) {
    const selects = root.querySelectorAll('.custom-select');
    
    selects.forEach((el, idx) => {
      
      init(el);
    });
  }

  function onChange(id, cb) {
    const rec = registry.get(id);
    if (!rec || !rec.hiddenInput) return;
    if (rec.hiddenInput.dataset.changeBound === 'true') return; // prevent double binding
    rec.hiddenInput.dataset.changeBound = 'true';
    rec.hiddenInput.addEventListener('change', (e) => cb(e.target.value, e));
  }

  function getValue(id) {
    const rec = registry.get(id);
    return rec?.hiddenInput?.value ?? null;
  }

  function setValue(id, value, trigger = true) {
    const rec = registry.get(id);
    if (!rec || !rec.hiddenInput) return;
    if (rec.hiddenInput.value !== value) {
      rec.hiddenInput.value = value;
      if (trigger) rec.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Public API
  window.CustomSelect = { initAll, onChange, getValue, setValue, _registry: registry };

  // Auto-init on page load
  document.addEventListener('DOMContentLoaded', () => initAll());

  // Re-init when content is revealed/inserted (e.g., Bootstrap modal)
  document.addEventListener('shown.bs.modal', (e) => initAll(e.target));
})();

/* ============================================
   TOGGLE DROPDOWN OPEN/CLOSE
   ============================================ */
function toggleDropdown(select) {
  const isOpen = select.classList.contains('open');
  
  // Close all other dropdowns first
  closeAllDropdowns();
  
  if (isOpen) {
    closeDropdown(select);
  } else {
    openDropdown(select);
  }
}

/* ============================================
   OPEN DROPDOWN
   ============================================ */
function openDropdown(select) {
  const trigger = select.querySelector('[data-select-trigger]');
  
  // Add open class
  select.classList.add('open');
  
  // Update ARIA attribute
  trigger.setAttribute('aria-expanded', 'true');
  
  // Focus first item
  const firstItem = select.querySelector('.custom-select-item');
  if (firstItem) {
    setTimeout(() => firstItem.focus(), 50);
  }
}

/* ============================================
   CLOSE DROPDOWN
   ============================================ */
function closeDropdown(select) {
  const trigger = select.querySelector('[data-select-trigger]');
  
  // Remove open class
  select.classList.remove('open');
  
  // Update ARIA attribute
  trigger.setAttribute('aria-expanded', 'false');
}

/* ============================================
   CLOSE ALL DROPDOWNS
   ============================================ */
function closeAllDropdowns() {
  const openSelects = document.querySelectorAll('.custom-select.open');
  openSelects.forEach(select => closeDropdown(select));
}

/* ============================================
   SELECT ITEM
   ============================================ */
function selectItem(select, item, valueDisplay, hiddenInput) {
  const value = item.getAttribute('data-value');
  const text = item.querySelector('.custom-select-item-text').textContent;
  
  // Remove selected class from all items
  const allItems = select.querySelectorAll('.custom-select-item');
  allItems.forEach(i => i.classList.remove('selected'));
  
  // Add selected class to clicked item
  item.classList.add('selected');
  
  // Update display text
  valueDisplay.textContent = text;
  
  // Update hidden input value
  hiddenInput.value = value;
  
  // Trigger change event
  const changeEvent = new Event('change', { bubbles: true });
  hiddenInput.dispatchEvent(changeEvent);
  
  // Close dropdown
  closeDropdown(select);
  
  // Return focus to trigger
  const trigger = select.querySelector('[data-select-trigger]');
  trigger.focus();
}

/* ============================================
   HANDLE TRIGGER KEYBOARD NAVIGATION
   ============================================ */
function handleTriggerKeydown(e, select, items) {
  switch(e.key) {
    case 'Enter':
    case ' ':
    case 'ArrowDown':
      e.preventDefault();
      openDropdown(select);
      break;
    case 'ArrowUp':
      e.preventDefault();
      openDropdown(select);
      // Focus last item
      const lastItem = items[items.length - 1];
      if (lastItem) {
        setTimeout(() => lastItem.focus(), 50);
      }
      break;
    case 'Escape':
      closeDropdown(select);
      break;
  }
}

/* ============================================
   HANDLE ITEM KEYBOARD NAVIGATION
   ============================================ */
function handleItemKeydown(e, select, item, items, valueDisplay, hiddenInput) {
  const itemsArray = Array.from(items);
  const currentIndex = itemsArray.indexOf(item);
  
  switch(e.key) {
    case 'Enter':
    case ' ':
      e.preventDefault();
      selectItem(select, item, valueDisplay, hiddenInput);
      break;
      
    case 'ArrowDown':
      e.preventDefault();
      // Focus next item
      const nextIndex = (currentIndex + 1) % itemsArray.length;
      itemsArray[nextIndex].focus();
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      // Focus previous item
      const prevIndex = (currentIndex - 1 + itemsArray.length) % itemsArray.length;
      itemsArray[prevIndex].focus();
      break;
      
    case 'Home':
      e.preventDefault();
      // Focus first item
      itemsArray[0].focus();
      break;
      
    case 'End':
      e.preventDefault();
      // Focus last item
      itemsArray[itemsArray.length - 1].focus();
      break;
      
    case 'Escape':
      e.preventDefault();
      closeDropdown(select);
      // Return focus to trigger
      const trigger = select.querySelector('[data-select-trigger]');
      trigger.focus();
      break;
      
    case 'Tab':
      // Allow default tab behavior
      closeDropdown(select);
      break;
  }
}

/* ============================================
   PUBLIC API - GET SELECTED VALUE
   ============================================ */
function getSelectValue(selectId) {
  const select = document.querySelector(`[data-select-id="${selectId}"]`);
  if (!select) return null;
  
  const hiddenInput = select.querySelector('[data-select-input]');
  return hiddenInput ? hiddenInput.value : null;
}

/* ============================================
   PUBLIC API - SET SELECTED VALUE
   ============================================ */
function setSelectValue(selectId, value) {
  const select = document.querySelector(`[data-select-id="${selectId}"]`);
  if (!select) return;
  
  const item = select.querySelector(`[data-value="${value}"]`);
  if (!item) return;
  
  const valueDisplay = select.querySelector('[data-select-value]');
  const hiddenInput = select.querySelector('[data-select-input]');
  
  selectItem(select, item, valueDisplay, hiddenInput);
}

// Legacy API for backward compatibility
window.CustomSelect = window.CustomSelect || {
  getValue: getSelectValue,
  setValue: setSelectValue
};

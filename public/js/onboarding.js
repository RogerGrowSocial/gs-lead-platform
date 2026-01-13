// =====================================================
// ONBOARDING SYSTEM - JavaScript Implementation
// =====================================================
// Update je bestaande JavaScript met deze functies

// Onboarding state
let currentStep = 1;
const onboardingData = {
  firstName: '',
  lastName: '',
  companyName: '',
  phone: '',
  referralSource: '',
  referralNote: '',
  industries: [],
  locations: [],
  leadTypes: [],
  budgetMin: '',
  budgetMax: '',
  notifications: ['inapp']
};

// Initialize wizard on page load
document.addEventListener('DOMContentLoaded', function() {
  // Check if user has completed onboarding
  checkOnboardingStatus();
  
  // Setup tag button toggles
  setupTagButtons();
  
  // Debounce slider API calls to prevent excessive DOM mutations during tour
  const slider = document.getElementById('leadLimitSlider');
  if (slider) {
    const debounced = ((fn,ms)=>{let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};})(
      async (v)=>{
        try {
          await fetch('/api/user/lead-pause', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ v })
          });
        } catch(e){ console.warn('pause API failed (ignored during tour)'); }
      }, 300
    );
    slider.addEventListener('input', e => debounced(e.target.value));
  }
});

// Check onboarding status from backend
async function checkOnboardingStatus() {
  try {
    const response = await fetch('/api/onboarding/status', {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      const status = result.data;
      
      // If onboarding not completed AND step < 99, redirect to dedicated onboarding page
      // Step 99 means "ready for tour" - allow dashboard access even if not fully completed
      const step = status.onboarding_step || 0;
      if (!status.onboarding_completed && step < 99) {
        // Redirect to the beautiful onboarding page instead of showing wizard
        window.location.href = '/onboarding';
        return;
      }
      // If step >= 99, user is in tour - don't redirect
    }
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    // Fallback: check localStorage
    const hasCompletedOnboarding = localStorage.getItem('onboarding_completed');
    if (!hasCompletedOnboarding) {
      // Redirect to onboarding page instead of showing wizard
      window.location.href = '/onboarding';
    }
  }
}

// Load existing onboarding data from backend
async function loadExistingOnboardingData() {
  try {
    const response = await fetch('/api/onboarding/status', {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      // Populate form fields if data exists
      const data = result.data;
      // Note: You'll need to fetch full profile data for this
      // For now, we'll use localStorage as fallback
      const savedData = localStorage.getItem('onboarding_data');
      if (savedData) {
        Object.assign(onboardingData, JSON.parse(savedData));
        populateFormFields();
      }
    }
  } catch (error) {
    console.error('Error loading onboarding data:', error);
  }
}

function populateFormFields() {
  // Populate form fields from onboardingData
  if (document.getElementById('firstName')) {
    document.getElementById('firstName').value = onboardingData.firstName || '';
  }
  if (document.getElementById('lastName')) {
    document.getElementById('lastName').value = onboardingData.lastName || '';
  }
  if (document.getElementById('companyName')) {
    document.getElementById('companyName').value = onboardingData.companyName || '';
  }
  if (document.getElementById('phone')) {
    document.getElementById('phone').value = onboardingData.phone || '';
  }
  if (document.getElementById('referralSource')) {
    document.getElementById('referralSource').value = onboardingData.referralSource || '';
  }
  if (document.getElementById('referralNote')) {
    document.getElementById('referralNote').value = onboardingData.referralNote || '';
  }
  if (document.getElementById('locations')) {
    document.getElementById('locations').value = onboardingData.locations.join('; ') || '';
  }
  if (document.getElementById('budgetMin')) {
    document.getElementById('budgetMin').value = onboardingData.budgetMin || '';
  }
  if (document.getElementById('budgetMax')) {
    document.getElementById('budgetMax').value = onboardingData.budgetMax || '';
  }
  
  // Update tag buttons
  updateTagButtons('industries', onboardingData.industries);
  updateTagButtons('leadTypes', onboardingData.leadTypes);
  updateTagButtons('notifications', onboardingData.notifications);
}

function updateTagButtons(groupId, selectedValues) {
  const group = document.getElementById(groupId);
  if (!group) return;
  
  group.querySelectorAll('.tag-btn').forEach(btn => {
    const value = btn.dataset.value;
    if (selectedValues.includes(value)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function showIntakeWizard() {
  document.getElementById('intakeWizard').classList.remove('hidden');
}

function hideIntakeWizard() {
  document.getElementById('intakeWizard').classList.add('hidden');
}

// Setup tag button click handlers
function setupTagButtons() {
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      this.classList.toggle('active');
      
      // Update data based on parent group
      const group = this.closest('.tag-group').id;
      const value = this.dataset.value;
      
      if (group === 'industries') {
        toggleArrayValue(onboardingData.industries, value);
      } else if (group === 'leadTypes') {
        toggleArrayValue(onboardingData.leadTypes, value);
      } else if (group === 'notifications') {
        toggleArrayValue(onboardingData.notifications, value);
      }
    });
  });
}

function toggleArrayValue(array, value) {
  const index = array.indexOf(value);
  if (index > -1) {
    array.splice(index, 1);
  } else {
    array.push(value);
  }
}

async function nextStep() {
  // Save current step data
  await saveCurrentStepData();
  
  // Update backend step
  await updateOnboardingStep(currentStep + 1);
  
  // Hide current step
  document.querySelector(`[data-step="${currentStep}"]`).classList.add('hidden');
  
  // Show next step
  currentStep++;
  document.querySelector(`[data-step="${currentStep}"]`).classList.remove('hidden');
}

async function skipStep() {
  // Just move to next step without saving
  await updateOnboardingStep(currentStep + 1);
  
  document.querySelector(`[data-step="${currentStep}"]`).classList.add('hidden');
  currentStep++;
  
  if (currentStep > 3) {
    await finishIntake();
  } else {
    document.querySelector(`[data-step="${currentStep}"]`).classList.remove('hidden');
  }
}

async function saveCurrentStepData() {
  if (currentStep === 1) {
    onboardingData.firstName = document.getElementById('firstName').value;
    onboardingData.lastName = document.getElementById('lastName').value;
    onboardingData.companyName = document.getElementById('companyName').value;
    onboardingData.phone = document.getElementById('phone').value;
    
    // Save to backend
    await saveOnboardingData({
      firstName: onboardingData.firstName,
      lastName: onboardingData.lastName,
      companyName: onboardingData.companyName,
      phone: onboardingData.phone
    });
  } else if (currentStep === 2) {
    onboardingData.referralSource = document.getElementById('referralSource').value;
    onboardingData.referralNote = document.getElementById('referralNote').value;
    
    // Save to backend
    await saveOnboardingData({
      referralSource: onboardingData.referralSource,
      referralNote: onboardingData.referralNote
    });
  } else if (currentStep === 3) {
    const locations = document.getElementById('locations').value;
    onboardingData.locations = locations.split(';').map(s => s.trim()).filter(Boolean);
    onboardingData.budgetMin = document.getElementById('budgetMin').value;
    onboardingData.budgetMax = document.getElementById('budgetMax').value;
    
    // Save to backend
    await saveOnboardingData({
      industries: onboardingData.industries,
      locations: onboardingData.locations,
      leadTypes: onboardingData.leadTypes,
      budgetMin: onboardingData.budgetMin,
      budgetMax: onboardingData.budgetMax,
      notifications: onboardingData.notifications
    });
  }
  
  // Also save to localStorage as backup
  localStorage.setItem('onboarding_data', JSON.stringify(onboardingData));
}

async function updateOnboardingStep(step) {
  try {
    const response = await fetch('/api/onboarding/step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ step })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('Error updating onboarding step:', result.error);
    }
  } catch (error) {
    console.error('Error updating onboarding step:', error);
  }
}

async function saveOnboardingData(data) {
  try {
    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('Error saving onboarding data:', result.error);
    }
  } catch (error) {
    console.error('Error saving onboarding data:', error);
  }
}

async function finishIntake() {
  await saveCurrentStepData();
  
  // Mark onboarding step as 99 (ready for tour)
  await updateOnboardingStep(99);
  
  // Hide wizard
  hideIntakeWizard();
  
  // Redirect to dashboard with tour flag - tour will start automatically
  window.location.href = '/dashboard?tour=true&step=0';
}

// =====================================================
// SPOTLIGHT TOUR FUNCTIONS
// =====================================================

// Tour steps configuration
const TOUR_STEPS = [
  {
    id: 'sidebar',
    title: 'Navigatie',
    text: 'Hier vind je alles: Dashboard, Aanvragen, Betalingen en Instellingen. Gebruik deze sidebar om snel door het platform te navigeren.',
    page: '/dashboard',
    position: 'right',
    selector: '#sidebar', // Direct naar de aside met id="sidebar"
    padding: 0, // Geen extra rand: precies de container
    borderRadius: 0, // Rechte hoeken voor sidebar
    // Wacht tot de sidebar er is en in stabiele staat (breedte niet meer wisselt)
    waitFor: (() => {
      let stableCount = 0;
      let lastWidth = null;
      return () => {
        const el = document.querySelector('#sidebar');
        if (!el) { stableCount = 0; return false; }
        const r = el.getBoundingClientRect();
        // Zichtbaar en minimum afmetingen
        if (r.width < 60 || r.height < 100) { stableCount = 0; return false; }
        const w = Math.round(r.width);
        if (lastWidth === null || Math.abs(w - lastWidth) > 1) {
          lastWidth = w; stableCount = 1; return false;
        }
        stableCount += 1;
        return stableCount >= 3;
      };
    })(),
    maxWaitMs: 2000
  },
  {
    id: 'kpi',
    title: 'Overzicht',
    text: 'Hier zie je je belangrijkste statistieken in één oogopslag: totaal aantal aanvragen, nieuwe aanvragen en geaccepteerde aanvragen.',
    page: '/dashboard',
    position: 'top', // tooltip boven de KPI-rij
    selector: '#dashboard-kpis', // hele rij i.p.v. 1 kaart
    padding: 0, // GEEN padding - exact om card-content
    tooltipOffsetY: -16, // extra ruimte tussen tooltip en highlight
    spotlightChildrenSelector: '.card-content', // highlight om alle card-content blokken heen
    multipleHighlights: true, // maak aparte highlights voor elke card-content (niet union rect)
    // Wacht tot de KPI-container fysiek staat én zijn top stabiel blijft over enkele frames
    waitFor: (() => {
      let stableCount = 0;
      let lastTop = null;

      const isStable = () => {
        const cont = document.querySelector('[data-tour-id="kpi"]');
        if (!cont) return false;

        const r = cont.getBoundingClientRect();
        // Zichtbaar en voldoende hoogte
        if (r.height < 100) { stableCount = 0; return false; }

        const top = Math.round(r.top);
        if (lastTop === null || Math.abs(top - lastTop) > 1) {
          lastTop = top;
          stableCount = 1;
          return false;
        }

        stableCount += 1;
        // 3 opeenvolgende stabiele checks (~> 2 RAF-cycli)
        return stableCount >= 3;
      };

      return () => {
        // Zorg ook dat ten minste één kaart binnen de selector bestaat
        const firstCard = document.querySelector('[data-tour-id="kpi"] .card');
        if (!firstCard) return false;
        return isStable();
      };
    })(),
    // Geef fonts/banners/netwerk eventjes lucht
    maxWaitMs: 2500
  },
  {
    id: 'recent-requests',
    title: 'Recente aanvragen',
    text: 'Hier zie je je meest recente aanvragen. Klik op een aanvraag om details te bekijken en actie te ondernemen.',
    page: '/dashboard',
    position: 'bottom',
    selector: '[data-tour-id="recent-requests"] .card',
    padding: 0,
    // Wacht op ten minste 1 zichtbare card binnen de sectie
    waitFor: () => {
      const box = document.querySelector('[data-tour-id="recent-requests"]');
      if (!box) return false;
      const cards = box.querySelectorAll('.card');
      return Array.from(cards).some(c => {
        const r = c.getBoundingClientRect();
        return r.width >= 40 && r.height >= 40;
      });
    },
    maxWaitMs: 2500
  },
  {
    id: 'monthly-limit',
    title: 'Stel je maandelijkse limiet in',
    text: 'Hier bepaal je hoeveel aanvragen je per maand wilt ontvangen. Verschuif de slider om je limiet in te stellen; wij pauzeren automatisch als je limiet bereikt is.',
    page: '/dashboard/leads',
    selector: '.monthly-limit-section',
    // GEEN spotlightChildrenSelector, GEEN multipleHighlights
    padding: 0, // Geen padding - highlight moet precies op containerrand zitten
    borderRadius: 8,
    position: 'top',
    tipOffset: { x: 0, y: -10 },
    allowOffscreen: true,
    waitFor: (() => {
      let seenOnce = false;
      return () => {
        // Check of de monthly-limit-section bestaat
        const section = document.querySelector('.monthly-limit-section');
        if (!section) {
          seenOnce = false;
          return false;
        }
        const sectionRect = section.getBoundingClientRect();
        if (sectionRect.width <= 0 || sectionRect.height <= 0) {
          seenOnce = false;
          return false;
        }
        if (!seenOnce) {
          seenOnce = true;
          return false; // één frame wachten zodat layout kan landen
        }
        return true;
      };
    })(),
    maxWaitMs: 8000 // Meer tijd voor laden
  },
  {
    id: 'industry-preferences',
    title: 'Branche voorkeuren',
    text: 'Selecteer voor welke branches je aanvragen wilt ontvangen. Je kunt dit op elk moment wijzigen door branches aan of uit te zetten.',
    page: '/dashboard/leads',
    position: 'bottom',
    selector: '#branchePreferencesCard',
    padding: 0,
    tipOffset: { x: 0, y: 0 },
    waitFor: () => {
      const card = document.querySelector('#branchePreferencesCard');
      if (!card) return false;
      
      // Check of card zichtbaar is en correct gepositioneerd
      const cardRect = card.getBoundingClientRect();
      if (cardRect.width < 40 || cardRect.height < 80) return false;
      if (cardRect.x <= 2 && cardRect.y <= 2 && (cardRect.width < 100 || cardRect.height < 100)) return false;
      
      // Check of de industry preferences grid bestaat en geladen is
      const grid = document.querySelector('#industryPreferencesGrid');
      if (!grid) return false;
      
      // Check of er daadwerkelijk items zijn (niet loading state)
      const items = grid.querySelectorAll('.industry-preference-item');
      const isLoading = grid.querySelector('.industry-preferences-loading');
      const isEmpty = grid.querySelector('.industry-preferences-empty');
      
      // Wacht tot items geladen zijn (minimaal 1 item, of empty state)
      if (isLoading) return false;
      if (items.length === 0 && !isEmpty) return false;
      
      // Check of grid zichtbaar is en correct gepositioneerd
      const gridRect = grid.getBoundingClientRect();
      if (gridRect.width < 20 || gridRect.height < 20) return false;
      // Extra check: grid mag niet linksboven staan (niet geladen)
      if (gridRect.x <= 2 && gridRect.y <= 2 && (gridRect.width < 100 || gridRect.height < 100)) return false;
      
      return true;
    },
    maxWaitMs: 8000 // Meer tijd voor laden (industry preferences kunnen lang duren)
  },
  {
    id: 'payment-cards',
    title: 'Betalingsoverzicht',
    text: 'Hier zie je je volgende betaling, factuurdatum en hoeveel aanvragen je hebt ontvangen in de afgelopen periode.',
    page: '/dashboard/payments',
    position: 'bottom',
    selector: '.card-container', // Selecteer de container, niet individuele cards
    padding: 0,
    tipOffset: { x: 0, y: 0 },
    spotlightChildrenSelector: '.card', // Highlight alle cards binnen de container
    multipleHighlights: true, // Maak aparte highlights voor elke card
    waitFor: () => {
      const box = document.querySelector('.card-container');
      if (!box) return false;
      return Array.from(box.querySelectorAll('.card')).some(card => {
        const r = card.getBoundingClientRect();
        return r.width >= 40 && r.height >= 40;
      });
    },
    maxWaitMs: 4000
  },
  {
    id: 'payments-overview',
    title: 'Betalingen overzicht',
    text: 'Hier zie je alle betalingen die je hebt uitgevoerd voor de leads die je hebt ontvangen. Je kunt hier ook facturen downloaden.',
    page: '/dashboard/payments',
    position: 'bottom',
    selector: '.payments-section',
    padding: 0,
    tipOffset: { x: 0, y: 0 },
    waitFor: () => {
      const el = document.querySelector('.payments-section');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 20;
    },
    maxWaitMs: 2000
  },
  {
    id: 'payment-method',
    title: 'Betaalmethode instellen',
    text: 'Start nu met het instellen van je bankrekening! Koppel je bankrekening zodat je automatisch kunt betalen voor nieuwe aanvragen.',
    page: '/dashboard/payments',
    position: 'bottom',
    selector: 'section.bank-section[data-tour-id="payment-method"] > div',
    padding: 0,
    tipOffset: { x: 0, y: 0 },
    waitFor: () => {
      const el = document.querySelector('section.bank-section[data-tour-id="payment-method"] > div');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 20;
    },
    maxWaitMs: 2000,
    isLast: true
  }
];

// Maak TOUR_STEPS globaal beschikbaar
window.TOUR_STEPS = TOUR_STEPS;

let currentTourStep = 0;
let currentPage = window.location.pathname;
let tourInstance = null;

// Helper om URL in sync te houden bij page-nav
function syncUrlStep(i) {
  const u = new URL(location.href);
  u.searchParams.set('tour', 'true');
  u.searchParams.set('step', String(i));
  history.replaceState(null, '', u.toString());
}

// Maak syncUrlStep globaal beschikbaar
window.syncUrlStep = syncUrlStep;

// Make tour functions globally available
window.startSpotlightTour = function() {
  if (!window.GSTour) {
    console.error('GSTour not loaded. Make sure onboarding-spotlight.js is loaded first.');
    return;
  }
  
  // Read step from URL if present (voor resume na page navigation)
  const urlParams = new URLSearchParams(window.location.search);
  const urlStep = urlParams.get('step');
  if (urlStep !== null) {
    const parsedStep = parseInt(urlStep, 10);
    if (!isNaN(parsedStep) && parsedStep >= 0 && parsedStep < TOUR_STEPS.length) {
      currentTourStep = parsedStep;
    }
  }
  
  // Prepare steps with labels for last step
  const steps = TOUR_STEPS.map((step, idx) => {
    const stepCopy = {...step};
    if (stepCopy.isLast) {
      stepCopy.labels = {
        skip: 'Overslaan',
        back: 'Terug',
        done: 'Klaar',
        later: 'Ik doe dit later'
      };
      stepCopy.onLater = window.laterTour;
    }
    return stepCopy;
  });
  
  // Start tour with page navigation support
  // Wacht even zodat DOM volledig geladen is voordat we starten
  setTimeout(() => {
    tourInstance = window.GSTour.start(steps, {
      initialIndex: currentTourStep,     // <-- start op juiste step
      onStepChange: (newIdx) => {
        currentTourStep = newIdx;
        syncUrlStep(newIdx); // <-- sync URL
      },
      onFinish: async () => {
        await window.finishTour();
      }
    });
    
    currentPage = window.location.pathname;
  }, 150);
};

window.nextTourStep = function() {
  if (tourInstance) {
    tourInstance.next();
  }
};

window.previousTourStep = function() {
  if (tourInstance) {
    tourInstance.back();
  }
};

// Make showTourStep globally available - now uses new GSTour
window.showTourStep = function(stepIndex) {
  currentTourStep = stepIndex >= 0 && stepIndex < TOUR_STEPS.length ? stepIndex : 0;
  currentPage = window.location.pathname;
  
  // Sync URL immediately
  syncUrlStep(currentTourStep);
  
  if (window.GSTour) {
    // Restart tour at specific step
    if (tourInstance) {
      tourInstance.stop();
      tourInstance = null;
    }
    
    // Check if we need to navigate to the correct page first
    const step = TOUR_STEPS[currentTourStep];
    if (step && step.page && step.page !== window.location.pathname) {
      window.location.href = step.page + '?tour=true&step=' + currentTourStep;
      return;
    }
    
    // Start tour (will use currentTourStep via initialIndex)
    // Wacht even zodat DOM volledig geladen is
    setTimeout(() => {
      window.startSpotlightTour();
    }, 100);
  } else {
    // GSTour nog niet geladen, wacht even
    setTimeout(() => {
      window.showTourStep(stepIndex);
    }, 100);
  }
};

// OLD CODE REMOVED - replaced by GSTour
function showTourStepInternal_OLD(stepIndex) {
  currentTourStep = stepIndex;
  const step = TOUR_STEPS[stepIndex];
  
  // Ensure tour is visible
  const tourElement = document.getElementById('spotlightTour');
  if (tourElement) {
    tourElement.classList.remove('hidden');
  }
  
  // Check if we're on the correct page
  if (step.page !== window.location.pathname) {
    window.location.href = step.page + '?tour=true&step=' + stepIndex;
    return;
  }
  
  // Find target element
  const targetElement = document.querySelector(`[data-tour-id="${step.id}"]`);
  if (!targetElement) {
    console.error('Tour target not found:', step.id);
    // Skip to next step if element not found
    if (stepIndex < TOUR_STEPS.length - 1) {
      setTimeout(() => showTourStepInternal(stepIndex + 1), 100); // Reduced from 300ms to 100ms for faster navigation
    } else {
      finishTour();
    }
    return;
  }
  
  // Get spotlight overlay first
  const overlay = document.querySelector('.spotlight-overlay');
  if (!overlay) {
    console.error('Spotlight overlay not found');
    return;
  }
  
  // Ensure overlay is visible and has correct styling
  overlay.style.display = 'block';
  overlay.style.opacity = '1';
  overlay.style.visibility = 'visible';
  overlay.style.background = 'rgba(0, 0, 0, 0.6)';
  overlay.style.pointerEvents = 'auto';
  
  // Test: temporarily remove clip-path to see if overlay shows
  // overlay.style.clipPath = 'none';
  
  // Get element position BEFORE any style changes to avoid layout shifts
  const rect = targetElement.getBoundingClientRect();
  const padding = 16; // Increased padding for better spotlight effect
  
  // Debug: log element info
  console.log('Tour step:', step.id);
  console.log('Target element:', targetElement);
  console.log('Element rect:', rect);
  console.log('Window size:', window.innerWidth, 'x', window.innerHeight);
  
  // Do not change target layout/z-index; the mask reveals the underlying element
  
  // Determine highlight set by step preference
  let highlightElements;
  if (step.highlightSelector) {
    if (step.highlightSelector === ':self') {
      highlightElements = [targetElement];
    } else {
      try {
        highlightElements = Array.from(targetElement.querySelectorAll(step.highlightSelector));
      } catch (e) {
        highlightElements = [targetElement];
      }
      if (!highlightElements || highlightElements.length === 0) {
        highlightElements = [targetElement];
      }
    }
  } else {
    const childHighlights = targetElement.querySelectorAll('.industry-preference-item, .card');
    highlightElements = childHighlights && childHighlights.length ? Array.from(childHighlights) : [targetElement];
  }

  // Apply SVG mask with rounded-rect holes for all highlight elements
  applySpotlightMask(overlay, highlightElements, padding);
  
  // Position tooltip
  const tooltip = document.querySelector('.spotlight-tooltip');
  if (!tooltip) {
    console.error('Spotlight tooltip not found');
    return;
  }
  
  const isLastStep = step.isLast || stepIndex === TOUR_STEPS.length - 1;
  
  // Add wider class for last step
  if (isLastStep) {
    tooltip.classList.add('spotlight-tooltip-wide');
  } else {
    tooltip.classList.remove('spotlight-tooltip-wide');
  }
  
  positionTooltip(tooltip, rect, step.position || 'bottom', isLastStep);
  
  // Update tooltip content
  document.querySelector('.spotlight-title').textContent = step.title;
  document.querySelector('.spotlight-text').textContent = step.text;
  
  // Update button visibility - cleaner for last step
  if (isLastStep) {
    // Last step: only show primary action and "later" button
    document.querySelector('.btn-skip').classList.add('hidden');
    document.querySelector('.btn-back').classList.add('hidden');
    document.querySelector('.btn-next').classList.add('hidden');
    document.querySelector('.btn-finish').classList.remove('hidden');
    document.querySelector('.btn-later').classList.remove('hidden');
  } else {
    // Normal steps: show skip, back, next
    document.querySelector('.btn-skip').classList.remove('hidden');
    document.querySelector('.btn-back').classList.toggle('hidden', stepIndex === 0);
    document.querySelector('.btn-next').classList.remove('hidden');
    document.querySelector('.btn-finish').classList.add('hidden');
    document.querySelector('.btn-later').classList.add('hidden');
  }
  
  // Scroll element into view - faster without smooth animation
  targetElement.scrollIntoView({ behavior: 'auto', block: 'center' });
  
  // Recalculate and update spotlight after scroll and layout
  // Use requestAnimationFrame to ensure layout is complete
  requestAnimationFrame(() => {
    setTimeout(() => {
      // Recompute highlights (elements may have moved)
      let updatedHighlightElements;
      if (step.highlightSelector) {
        if (step.highlightSelector === ':self') {
          updatedHighlightElements = [targetElement];
        } else {
          try {
            updatedHighlightElements = Array.from(targetElement.querySelectorAll(step.highlightSelector));
          } catch (e) {
            updatedHighlightElements = [targetElement];
          }
          if (!updatedHighlightElements || updatedHighlightElements.length === 0) {
            updatedHighlightElements = [targetElement];
          }
        }
      } else {
        const updatedChildHighlights = targetElement.querySelectorAll('.industry-preference-item, .card');
        updatedHighlightElements = updatedChildHighlights && updatedChildHighlights.length ? Array.from(updatedChildHighlights) : [targetElement];
      }
      applySpotlightMask(overlay, updatedHighlightElements, padding);
      const updatedRect = targetElement.getBoundingClientRect();
      positionTooltip(tooltip, updatedRect, step.position || 'bottom', isLastStep);
    }, 100);
  });
}


// Draws 4 overlay rectangles to create a spotlight hole
function applySpotlightMask(overlay, elements, padding) {
  // Build multi-hole SVG mask with rounded corners matching target elements
  const width = window.innerWidth;
  const height = window.innerHeight;
  const maskId = `spotlight-mask-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let holes = '';
  elements.forEach(el => {
    const r = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    const radius = parseFloat(styles.borderRadius || '12') || 12;
    const x = Math.max(0, r.left - padding);
    const y = Math.max(0, r.top - padding);
    const w = Math.min(r.width + padding * 2, width - x);
    const h = Math.min(r.height + padding * 2, height - y);
    holes += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="black"/>`;
  });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <mask id="${maskId}">
          <rect width="${width}" height="${height}" fill="white"/>
          ${holes}
        </mask>
      </defs>
      <rect width="${width}" height="${height}" fill="white" mask="url(#${maskId})"/>
    </svg>
  `.trim();

  const encoded = encodeURIComponent(svg);
  const url = `url("data:image/svg+xml;charset=utf-8,${encoded}")`;

  overlay.style.background = 'rgba(0, 0, 0, 0.6)';
  overlay.style.maskImage = url;
  overlay.style.webkitMaskImage = url;
  overlay.style.maskMode = 'alpha';
  overlay.style.webkitMaskMode = 'alpha';
}


function createSpotlightMask(rect, padding) {
  const x = Math.max(0, rect.left - padding);
  const y = Math.max(0, rect.top - padding);
  const w = Math.min(rect.width + (padding * 2), window.innerWidth - x);
  const h = Math.min(rect.height + (padding * 2), window.innerHeight - y);
  
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Create SVG mask that covers everything except the highlighted area
  // In mask: white = visible (overlay), black = transparent (hole)
  const maskId = `spotlight-mask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Create SVG with mask - simpler version that should work better
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <mask id="${maskId}">
        <!-- White = overlay visible -->
        <rect width="${width}" height="${height}" fill="white"/>
        <!-- Black = transparent hole -->
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="black"/>
      </mask>
    </defs>
    <rect width="${width}" height="${height}" fill="white" mask="url(#${maskId})"/>
  </svg>`;
  
  // Convert to data URL - use proper encoding
  const encodedSvg = encodeURIComponent(svg);
  return `url("data:image/svg+xml;charset=utf-8,${encodedSvg}")`;
}

function createSpotlightClipPath(rect, padding) {
  // Ensure padding creates a nice highlight effect
  const x = Math.max(0, rect.left - padding);
  const y = Math.max(0, rect.top - padding);
  const w = rect.width + (padding * 2);
  const h = rect.height + (padding * 2);
  const right = x + w;
  const bottom = y + h;
  
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Calculate pixels for inset() - this is more reliable than polygon
  // Use inset() to create a frame: inset(top right bottom left)
  // We create 4 rectangles that cover everything except the hole
  const topInset = y;
  const bottomInset = height - bottom;
  const leftInset = x;
  const rightInset = width - right;
  
  // Use a combination of inset() values to create the frame
  // This approach uses multiple clip-paths combined
  // Actually, clip-path doesn't support multiple shapes easily
  // Let's use a polygon that correctly draws the frame
  
  // Calculate percentages for polygon
  const topY = (y / height) * 100;
  const bottomY = ((bottom) / height) * 100;
  const leftX = (x / width) * 100;
  const rightX = ((right) / width) * 100;
  
  // Create polygon that draws around the hole
  // The polygon path must go clockwise and create a frame shape
  // Start top-left, go right, down to hole, around hole, then continue down and left
  return `polygon(
    0% 0%,
    100% 0%,
    100% ${topY}%,
    ${rightX}% ${topY}%,
    ${rightX}% ${bottomY}%,
    100% ${bottomY}%,
    100% 100%,
    0% 100%,
    0% ${bottomY}%,
    ${leftX}% ${bottomY}%,
    ${leftX}% ${topY}%,
    0% ${topY}%
  )`;
}

function positionTooltip(tooltip, targetRect, preferredPosition = 'bottom', isLastStep = false) {
  const padding = 16;
  const tooltipWidth = isLastStep ? 500 : 380;
  const tooltipHeight = isLastStep ? 180 : 200;
  let top, left;
  
  // Position based on preferred position, but adjust if needed
  if (preferredPosition === 'right') {
    // Place to the right of the element
    left = targetRect.right + padding;
    top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
    
    // If tooltip goes off right edge, place it on the left
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = targetRect.left - tooltipWidth - padding;
    }
    
    // Ensure it stays within viewport vertically
    if (top < padding) {
      top = padding;
    } else if (top + tooltipHeight > window.innerHeight - padding) {
      top = window.innerHeight - tooltipHeight - padding;
    }
  } else if (preferredPosition === 'left') {
    // Place to the left of the element
    left = targetRect.left - tooltipWidth - padding;
    top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
    
    // If tooltip goes off left edge, place it on the right
    if (left < padding) {
      left = targetRect.right + padding;
    }
    
    // Ensure it stays within viewport vertically
    if (top < padding) {
      top = padding;
    } else if (top + tooltipHeight > window.innerHeight - padding) {
      top = window.innerHeight - tooltipHeight - padding;
    }
  } else {
    // Default: bottom positioning
    top = targetRect.bottom + padding;
    left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
    
    // Adjust if tooltip would go off screen
    if (top + tooltipHeight > window.innerHeight - padding) {
      top = targetRect.top - tooltipHeight - padding;
    }
    
    // Center horizontally but keep within bounds
    if (left < padding) {
      left = padding;
    } else if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }
  }
  
  // Final bounds check
  top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));
  left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function nextTourStep() {
  window.nextTourStep();
}

function previousTourStep() {
  window.previousTourStep();
}

window.skipTour = async function() {
  await window.finishTour();
};

window.finishTour = async function() {
  // Guard: voorkom meerdere gelijktijdige aanroepen
  if (window.__finishingTour) {
    console.log('[Tour] finishTour already in progress, skipping');
    return;
  }
  window.__finishingTour = true;
  
  try {
    // Stop tour
    if (tourInstance) {
      tourInstance.stop();
      tourInstance = null;
    }
    
    // Disable alle buttons in de tooltip om dubbele clicks te voorkomen
    const tooltip = document.getElementById('gs-spotlight-tooltip');
    if (tooltip) {
      const buttons = tooltip.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.6';
      });
    }
    
    // Show success notification using the toast system - DIRECT bij confetti start
    // Wacht kort zodat de DOM volledig geladen is en showNotification beschikbaar is
    setTimeout(() => {
      if (typeof window.showNotification === 'function') {
        // Check signatuur: main.js heeft (message, type, duration, playSound)
        // settings.js heeft (message, type, duration, sound)
        // Probeer beide volgordes
        try {
          window.showNotification('Welkom bij GrowSocial! Je onboarding is voltooid.', 'success', 6000, true);
        } catch (e) {
          // Fallback: probeer andere signatuur
          try {
            window.showNotification('Welkom bij GrowSocial! Je onboarding is voltooid.', 'success', 6000);
          } catch (e2) {
            showSuccessMessage();
          }
        }
      } else {
        // Fallback naar showSuccessMessage als showNotification niet beschikbaar is
        showSuccessMessage();
      }
    }, 100); // Korte delay om zeker te zijn dat DOM klaar is
    
    // Trigger confetti animation (wacht tot confetti klaar is voordat we verder gaan)
    await new Promise((resolve) => {
      triggerConfetti(resolve); // Pass resolve callback
    });
    
    // Mark onboarding as completed
    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        localStorage.setItem('onboarding_completed', 'true');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      localStorage.setItem('onboarding_completed', 'true');
    }
    
    // Hide old tour element if it exists
    const tourElement = document.getElementById('spotlightTour');
    if (tourElement) {
      tourElement.classList.add('hidden');
    }
    
    // Remove tour query params
    const url = new URL(window.location.href);
    url.searchParams.delete('tour');
    url.searchParams.delete('step');
    window.history.replaceState({}, '', url);
  } finally {
    // Reset guard na korte delay om race conditions te voorkomen
    setTimeout(() => {
      window.__finishingTour = false;
    }, 1000);
  }
};

window.laterTour = async function() {
  // Guard: voorkom meerdere gelijktijdige aanroepen
  if (window.__finishingTour) {
    console.log('[Tour] laterTour already in progress, skipping');
    return;
  }
  window.__finishingTour = true;
  
  try {
    // Stop tour
    if (tourInstance) {
      tourInstance.stop();
      tourInstance = null;
    }
    
    // Disable alle buttons in de tooltip om dubbele clicks te voorkomen
    const tooltip = document.getElementById('gs-spotlight-tooltip');
    if (tooltip) {
      const buttons = tooltip.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.6';
      });
    }
    
    // Mark onboarding as completed but don't show success message
    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        localStorage.setItem('onboarding_completed', 'true');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      localStorage.setItem('onboarding_completed', 'true');
    }
    
    // Hide old tour element if it exists
    const tourElement = document.getElementById('spotlightTour');
    if (tourElement) {
      tourElement.classList.add('hidden');
    }
    
    // Remove tour query params
    const url = new URL(window.location.href);
    url.searchParams.delete('tour');
    url.searchParams.delete('step');
    window.history.replaceState({}, '', url);
  } finally {
    // Reset guard na korte delay om race conditions te voorkomen
    setTimeout(() => {
      window.__finishingTour = false;
    }, 1000);
  }
};

function triggerConfetti(onComplete) {
  // Create confetti canvas
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99999999';
  document.body.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  // Normale confetti kleuren + brand kleuren
  const colors = [
    '#EA5D0D', '#FF6B35', '#F7931E', // Brand kleuren
    '#FF0000', '#00FF00', '#0000FF', // Rood, Groen, Blauw
    '#FFFF00', '#FF00FF', '#00FFFF', // Geel, Magenta, Cyan
    '#FFA500', '#800080', '#FF1493', // Oranje, Paars, Deep Pink
    '#00CED1', '#FFD700', '#32CD32'  // Turquoise, Goud, Lime Green
  ];
  const confetti = [];
  const confettiCount = 150;
  
  // Create confetti particles
  for (let i = 0; i < confettiCount; i++) {
    confetti.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 4 + 2,
      d: Math.random() * confettiCount + 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngleIncrement: Math.random() * 0.07 + 0.05,
      tiltAngle: 0,
      speed: Math.random() * 2 + 2
    });
  }
  
  let animationId;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let remaining = 0;
    confetti.forEach((c, i) => {
      c.tiltAngle += c.tiltAngleIncrement;
      c.y += (Math.cos(c.d) + 3 + c.r / 2) / 2 * c.speed;
      c.tilt = Math.sin(c.tiltAngle - i / 3) * 15;
      
      ctx.save();
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.ellipse(c.x + c.tilt, c.y, c.r, c.r * 0.5, c.tiltAngle, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // Check of particle nog binnen het scherm is (met marge voor smooth fade-out)
      if (c.y < canvas.height + 50) {
        remaining++;
      }
    });
    
    if (remaining > 0) {
      animationId = requestAnimationFrame(animate);
    } else {
      // Alle particles zijn weg - verwijder canvas en roep callback aan
      setTimeout(() => {
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }, 300); // Extra tijd voor smooth fade-out
    }
  }
  
  animate();
}

function showSuccessMessage() {
  // Use your existing notification system
  if (window.showNotification) {
    window.showNotification('success', 'Welkom bij GrowSocial! Je bent klaar om te beginnen.');
  } else {
    // Fallback notification
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
      <div class="success-content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>Welkom bij GrowSocial! Je bent klaar om te beginnen.</span>
      </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
}


/**
 * rdv.js — Clínica Las Calas
 * 4-step appointment form:
 *   1. Personal data
 *   2. Consultation type + specialty + doctor
 *   3. Slot selection (fetched from N8N)
 *   4. Confirmation + submit
 *
 * N8N get-slots payload: { action:'get_slots', specialite, medecin, langue, date_souhaitee }
 * N8N submit  payload:   { action:'submit', nom, email, telephone, langue, specialite,
 *                          medecin, date_souhaitee, creneau_date, creneau_heure,
 *                          creneau_label, type_rdv, motif, doc_type, ... }
 *
 * Expected N8N slots response:
 *   { "slots": [{ "date":"2026-04-20", "heure":"10:00", "medecin":"Dr. ...", "duree":30 }, ...] }
 */

const RDV_API = 'https://kenzel2122.app.n8n.cloud/webhook/clinica-rdv';

let currentStep  = 1;
const TOTAL_STEPS = 4;
let selectedSlot  = null; // { date, heure, medecin, duree, label }

// ─── Doctor map by specialty ──────────────────────────────────────────────────
const DOCTORS_BY_SPECIALTY = {
  general:  ['Dr. Carlos Herrera Montoya','Dr. Sophie Marchand','Dr. Olena Kovalenko','Dr. Amir Benali'],
  cardio:   ['Dra. Elena Vásquez Ruiz','Dr. Thomas Müller'],
  gyneco:   ['Dra. Natalia Petrenko','Dra. Yasmine Cherif'],
  diabeto:  ['Dr. Marco Ferretti','Dr. Lin Wei'],
  pediatric:[], dermato:[], trauma:[], travel:[]
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showStep(1);
  bindStepButtons();
  bindConsultTypeToggle();
  bindDateMin();
  bindPhoneFormat();
  bindSpecialtyChange();
});

// ─── Step display ─────────────────────────────────────────────────────────────
function showStep(step) {
  currentStep = step;
  [1, 2, 3, 4].forEach(n => {
    const el = document.getElementById('step' + n);
    if (el) el.style.display = n === step ? 'block' : 'none';
  });
  document.querySelectorAll('.rdv-step').forEach(ind => {
    const s = parseInt(ind.dataset.step);
    ind.classList.remove('active', 'completed');
    if (s === step) ind.classList.add('active');
    if (s < step)   ind.classList.add('completed');
  });
  const card = document.querySelector('.rdv-form-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Navigation ───────────────────────────────────────────────────────────────
window.goStep = function(direction) {
  if (direction === 'next') {
    if (!validateStep(currentStep)) return;

    if (currentStep === 2) {
      // Fetch slots before advancing — fetchSlots calls showStep(3) itself
      fetchSlots();
      return;
    }
    if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);

  } else {
    // Back — if coming back from step 3, clear slot selection
    if (currentStep === 3) {
      clearSlotSelection();
    }
    if (currentStep > 1) showStep(currentStep - 1);
  }
};

// ─── Validation ───────────────────────────────────────────────────────────────
function validateStep(step) {
  clearErrors();
  let valid = true;
  if (step === 1) {
    valid = validateField('rFirstName', v => v.length >= 2, t('error.min2')  || 'Mínimo 2 caracteres') && valid;
    valid = validateField('rLastName',  v => v.length >= 2, t('error.min2')  || 'Mínimo 2 caracteres') && valid;
    valid = validateField('rEmail',     v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), t('error.email') || 'Email inválido') && valid;
    valid = validateField('rPhone',     v => v.replace(/\s/g,'').length >= 9,       t('error.phone') || 'Teléfono inválido') && valid;
  }
  if (step === 2) {
    valid = validateField('rSpecialty', v => v !== '',       t('error.specialty') || 'Selecciona una especialidad') && valid;
    valid = validateField('rMotive',    v => v.length >= 10, t('error.motive')    || 'Describe el motivo (mín. 10 caracteres)') && valid;
  }
  return valid;
}

function validateField(id, rule, errorMsg) {
  const el = document.getElementById(id);
  if (!el) return true;
  if (!rule(el.value.trim())) {
    showFieldError(id, errorMsg);
    el.classList.add('error');
    return false;
  }
  return true;
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  let err = el.parentElement?.querySelector('.field-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'field-error';
    el.parentElement?.appendChild(err);
  }
  err.textContent = msg;
  el.classList.add('error');
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.remove());
  document.querySelectorAll('.error').forEach(e => e.classList.remove('error'));
}

// ─── Slot fetching ────────────────────────────────────────────────────────────
async function fetchSlots() {
  showStep(3);
  selectedSlot = null;

  const loadEl  = document.getElementById('slotsLoading');
  const boxEl   = document.getElementById('slotsContainer');
  const errEl   = document.getElementById('slotsError');
  const listEl  = document.getElementById('slotsList');

  // Reset state
  if (loadEl)  { loadEl.style.display  = 'flex'; }
  if (boxEl)   { boxEl.style.display   = 'none'; }
  if (errEl)   { errEl.style.display   = 'none'; }
  if (listEl)  { listEl.innerHTML      = ''; }

  const specialty   = document.getElementById('rSpecialty')?.value   || '';
  const doctor      = document.getElementById('rDoctor')?.value      || '';
  const lang        = document.getElementById('rLang')?.value        || 'es';
  const prefDate    = document.getElementById('rPreference')?.value  || '';
  const specialtyEl = document.getElementById('rSpecialty');
  const specialtyLabel = specialtyEl?.options[specialtyEl.selectedIndex]?.text || specialty;

  try {
    const res = await fetch(RDV_API, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        action        : 'get_slots',
        specialite    : specialtyLabel,
        specialite_key: specialty,
        medecin       : doctor || null,
        langue        : lang,
        date_souhaitee: prefDate || null
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data  = await res.json().catch(() => ({}));
    // Accept both { slots: [...] } and direct array
    const slots = data.slots || data.creneaux || data.disponibilites
                  || (Array.isArray(data) ? data : []);

    if (loadEl) loadEl.style.display = 'none';

    if (!slots || slots.length === 0) {
      showSlotsError();
      return;
    }

    renderSlots(slots, specialtyLabel, lang);
    if (boxEl) boxEl.style.display = 'block';

  } catch (err) {
    console.error('[RDV] fetchSlots error:', err);
    if (loadEl) loadEl.style.display = 'none';
    showSlotsError();
  }
}

function showSlotsError() {
  const errEl = document.getElementById('slotsError');
  if (errEl) errEl.style.display = 'flex';
}

// ─── Slot rendering ───────────────────────────────────────────────────────────
function renderSlots(slots, specialtyLabel, lang) {
  const listEl = document.getElementById('slotsList');
  if (!listEl) return;

  listEl.innerHTML = '';

  // Keep at most 4 slots (N8N should send 2, but be flexible)
  const displayed = slots.slice(0, 4);

  displayed.forEach((slot, i) => {
    // Normalize field names (handle different N8N output conventions)
    const date    = slot.date   || slot.fecha || '';
    const heure   = slot.heure  || slot.hora  || slot.time  || '';
    const medecin = slot.medecin|| slot.doctor|| slot.médico|| '';
    const duree   = slot.duree  || slot.duracion || slot.duration || 30;

    const isoDate  = date;
    const label    = slot.label || buildSlotLabel(isoDate, heure, lang);
    const doctorDisplay = medecin || document.getElementById('rDoctor')?.value || '';

    const card = document.createElement('div');
    card.className = 'slot-card';
    card.dataset.index = i;
    card.innerHTML = `
      <div class="slot-card-inner">
        <div class="slot-card-left">
          <div class="slot-icon">📅</div>
          <div>
            <div class="slot-date-label">${label}</div>
            ${doctorDisplay ? `<div class="slot-doctor-name">👨‍⚕️ ${doctorDisplay}</div>` : ''}
            <div class="slot-meta">${specialtyLabel} · ${duree} min</div>
          </div>
        </div>
        <div class="slot-card-right">
          <div class="slot-time-big">${heure}</div>
          <div class="slot-select-badge">${t('rdv.slot.select') || 'Seleccionar'}</div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      selectSlot({ date: isoDate, heure, medecin: doctorDisplay, duree, label, specialite: specialtyLabel });
    });

    listEl.appendChild(card);
  });
}

function buildSlotLabel(isoDate, heure, lang) {
  if (!isoDate) return heure || '—';
  try {
    const d = new Date(isoDate + 'T12:00:00');
    const locale = lang.startsWith('ar') ? 'ar' : lang;
    return d.toLocaleDateString(locale + '-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      .replace(/^./, c => c.toUpperCase());
  } catch { return isoDate; }
}

// ─── Slot selection ───────────────────────────────────────────────────────────
function selectSlot(slot) {
  selectedSlot = slot;

  // Visual feedback: highlight selected card
  document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
  // Flash selected state briefly, then advance
  const cards = document.querySelectorAll('.slot-card');
  cards.forEach(c => {
    const label = c.querySelector('.slot-date-label')?.textContent;
    if (label && label === slot.label) c.classList.add('selected');
  });

  // Short delay so user sees the selection, then advance
  setTimeout(() => {
    buildSummary();
    showStep(4);
  }, 400);
}

function clearSlotSelection() {
  selectedSlot = null;
  document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
}

// ─── Build summary (step 4) ───────────────────────────────────────────────────
function buildSummary() {
  const g = id => (document.getElementById(id)?.value || '').trim();
  const checkedType  = document.querySelector('input[name="rdvType"]:checked');
  const specialtyEl  = document.getElementById('rSpecialty');
  const specialtyLabel = specialtyEl?.options[specialtyEl.selectedIndex]?.text || g('rSpecialty');
  const typeLabel    = checkedType?.value === 'teleconsulta' ? '💻 Teleconsulta (Teams)' : '🏥 Presencial';

  const box = document.getElementById('rdvSummary');
  if (!box) return;

  const slotSection = selectedSlot ? `
    <div class="summary-slot-highlight">
      <div class="summary-slot-icon">📅</div>
      <div>
        <div class="summary-slot-date">${selectedSlot.label}</div>
        <div class="summary-slot-time">⏰ ${selectedSlot.heure}</div>
        ${selectedSlot.medecin ? `<div class="summary-slot-doctor">👨‍⚕️ ${selectedSlot.medecin}</div>` : ''}
        <div class="summary-slot-meta">${selectedSlot.specialite || specialtyLabel} · ${selectedSlot.duree} min · ${checkedType?.value === 'teleconsulta' ? 'Teleconsulta' : 'Presencial'}</div>
      </div>
    </div>
  ` : '';

  box.innerHTML = `
    ${slotSection}
    <div class="summary-grid">
      <div class="summary-section">
        <h4>👤 ${t('rdv.step1.title') || 'Datos personales'}</h4>
        <p><strong>${t('form.firstname')||'Nombre'}:</strong> ${g('rFirstName')} ${g('rLastName')}</p>
        <p><strong>${t('form.email')||'Email'}:</strong> ${g('rEmail')}</p>
        <p><strong>${t('form.phone')||'Teléfono'}:</strong> ${g('rPhone')}</p>
        <p><strong>${t('form.lang')||'Idioma'}:</strong> ${g('rLang').toUpperCase()}</p>
      </div>
      <div class="summary-section">
        <h4>🏥 ${t('rdv.step2.title') || 'Consulta'}</h4>
        <p><strong>${t('rdv.type.label')||'Tipo'}:</strong> ${typeLabel}</p>
        <p><strong>${t('rdv.specialty')||'Especialidad'}:</strong> ${specialtyLabel}</p>
        ${g('rMotive') ? `<p><strong>${t('rdv.motive')||'Motivo'}:</strong> ${g('rMotive')}</p>` : ''}
      </div>
    </div>
  `;

  // Store full payload for submit
  box.dataset.rdvPayload = JSON.stringify({
    nom            : `${g('rFirstName')} ${g('rLastName')}`.trim(),
    email          : g('rEmail'),
    telephone      : g('rPhone'),
    langue         : g('rLang'),
    specialite     : specialtyLabel,
    specialite_key : g('rSpecialty'),
    medecin        : selectedSlot?.medecin || g('rDoctor') || null,
    creneau_date   : selectedSlot?.date    || null,
    creneau_heure  : selectedSlot?.heure   || null,
    creneau_label  : selectedSlot?.label   || null,
    date_souhaitee : selectedSlot?.date    || g('rPreference') || null,
    type_rdv       : checkedType?.value    || 'presential',
    motif          : g('rMotive'),
    doc_type       : g('rDoc'),
    action         : 'submit'
  });
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function submitRDV() {
  const consent = document.getElementById('rConsent');
  if (!consent?.checked) {
    showFieldError('rConsent', t('error.consent') || 'Debes aceptar el consentimiento para continuar');
    return;
  }

  const box = document.getElementById('rdvSummary');
  if (!box?.dataset.rdvPayload) return;

  const payload = JSON.parse(box.dataset.rdvPayload);
  payload.langue_interface = window.getCurrentLang?.() || 'es';
  payload.source           = 'web-form';
  payload.timestamp        = new Date().toISOString();

  const submitBtn = document.getElementById('rdvSubmit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `⏳ ${t('rdv.sending') || 'Enviando…'}`;
  }

  try {
    const res = await fetch(RDV_API, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json().catch(() => ({}));

    // ── Success ──────────────────────────────────────────────────────────────
    const formEl  = document.getElementById('rdvForm');
    const stepsEl = document.getElementById('rdvSteps');
    if (formEl)  formEl.style.display  = 'none';
    if (stepsEl) stepsEl.style.display = 'none';

    const successEl = document.getElementById('rdvSuccess');
    if (successEl) {
      if (data.dossier) {
        const refEl = document.createElement('p');
        refEl.style.cssText = 'margin-top:.6rem;font-size:.9rem;font-weight:600;';
        refEl.innerHTML = `📋 ${t('rdv.dossier') || 'Expediente'}: <strong>${data.dossier}</strong>`;
        successEl.querySelector('div')?.appendChild(refEl);
      }
      // Add slot confirmation in success message
      if (selectedSlot) {
        const slotConfirm = document.createElement('p');
        slotConfirm.style.cssText = 'margin-top:.5rem;font-size:.9rem;background:rgba(255,255,255,.15);padding:.6rem .8rem;border-radius:.5rem;';
        slotConfirm.innerHTML = `📅 <strong>${selectedSlot.label}</strong> · ⏰ ${selectedSlot.heure}${selectedSlot.medecin ? ` · 👨‍⚕️ ${selectedSlot.medecin}` : ''}`;
        successEl.querySelector('div')?.appendChild(slotConfirm);
      }
      successEl.style.display = 'flex';
      successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

  } catch (err) {
    console.error('[RDV] submit error:', err);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>${t('rdv.submit') || 'Confirmar cita'}</span>`;
    }
    const errEl = document.getElementById('rdvError');
    if (errEl) {
      errEl.textContent = t('rdv.error') || 'Error al enviar. Por favor, llámenos: +34 965 000 000.';
      errEl.style.display = 'block';
    }
  }
}

// ─── Bindings ─────────────────────────────────────────────────────────────────
function bindStepButtons() {
  document.getElementById('rdvSubmit')?.addEventListener('click', e => { e.preventDefault(); submitRDV(); });
  document.getElementById('rdvForm')?.addEventListener('submit',  e => { e.preventDefault(); submitRDV(); });
}

function bindConsultTypeToggle() {
  document.querySelectorAll('input[name="rdvType"]').forEach(r =>
    r.addEventListener('change', () => {})
  );
}

function bindDateMin() {
  const dateInput = document.getElementById('rPreference');
  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
}

function bindPhoneFormat() {
  document.getElementById('rPhone')?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/[^\d\s\+\-\(\)]/g, '');
  });
}

function bindSpecialtyChange() {
  document.getElementById('rSpecialty')?.addEventListener('change', e => updateDoctorList(e.target.value));
}

function updateDoctorList(specialtyValue) {
  const select = document.getElementById('rDoctor');
  const group  = document.getElementById('rDoctorGroup');
  if (!select) return;
  const doctors = DOCTORS_BY_SPECIALTY[specialtyValue] || [];
  const noPreference = t('rdv.doctor.none') || '— Sin preferencia —';
  select.innerHTML = `<option value="">${noPreference}</option>`;
  doctors.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    select.appendChild(opt);
  });
  if (group) group.style.display = doctors.length === 0 ? 'none' : 'block';
}

// ─── i18n helper (safe wrapper) ───────────────────────────────────────────────
function t(key) {
  return window.__i18n?.[key] || window.getTranslation?.(key) || null;
}

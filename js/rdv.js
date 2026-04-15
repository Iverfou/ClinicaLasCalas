/**
 * rdv.js — Clínica Las Calas
 * 3-step appointment booking form: navigation, validation, summary, submit
 * Sends to N8N: nom, email, telephone, langue, specialite, medecin,
 *               date_souhaitee, type_rdv, motif, doc_type
 */

const RDV_API = 'https://kenzel2122.app.n8n.cloud/webhook/clinica-rdv';
let currentStep = 1;
const TOTAL_STEPS = 3;

// ─── Doctor map by specialty ──────────────────────────────────────────────────
const DOCTORS_BY_SPECIALTY = {
  general:  [
    'Dr. Carlos Herrera Montoya',
    'Dr. Sophie Marchand',
    'Dr. Olena Kovalenko',
    'Dr. Amir Benali'
  ],
  cardio:   [
    'Dra. Elena Vásquez Ruiz',
    'Dr. Thomas Müller'
  ],
  gyneco:   [
    'Dra. Natalia Petrenko',
    'Dra. Yasmine Cherif'
  ],
  diabeto:  [
    'Dr. Marco Ferretti',
    'Dr. Lin Wei'
  ],
  pediatric: [],
  dermato:   [],
  trauma:    [],
  travel:    []
};

// Specialty display labels (fallback if i18n not loaded)
const SPECIALTY_LABELS = {
  general:   'Medicina General',
  cardio:    'Cardiología',
  pediatric: 'Pediatría',
  dermato:   'Dermatología',
  gyneco:    'Ginecología',
  diabeto:   'Diabetología',
  trauma:    'Traumatología',
  travel:    'Medicina del Viajero'
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

// ─── Step navigation ──────────────────────────────────────────────────────────
function showStep(step) {
  currentStep = step;
  [1, 2, 3].forEach(n => {
    const el = document.getElementById('step' + n);
    if (el) el.style.display = n === step ? 'block' : 'none';
  });
  document.querySelectorAll('.rdv-step').forEach(ind => {
    const s = parseInt(ind.dataset.step);
    ind.classList.remove('active', 'completed');
    if (s === step) ind.classList.add('active');
    if (s < step)   ind.classList.add('completed');
  });
  const form = document.querySelector('.rdv-form-card');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.goStep = function(direction) {
  if (direction === 'next') {
    if (!validateStep(currentStep)) return;
    if (currentStep === 2) buildSummary();
    if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
  } else {
    if (currentStep > 1) showStep(currentStep - 1);
  }
};

// ─── Validation ───────────────────────────────────────────────────────────────
function validateStep(step) {
  clearErrors();
  let valid = true;

  if (step === 1) {
    valid = validateField('rFirstName', v => v.length >= 2, 'Mínimo 2 caracteres') && valid;
    valid = validateField('rLastName',  v => v.length >= 2, 'Mínimo 2 caracteres') && valid;
    valid = validateField('rEmail',     v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email inválido') && valid;
    valid = validateField('rPhone',     v => v.replace(/\s/g,'').length >= 9, 'Teléfono inválido') && valid;
  }

  if (step === 2) {
    valid = validateField('rSpecialty', v => v !== '', 'Selecciona una especialidad') && valid;
    valid = validateField('rMotive',    v => v.length >= 10, 'Describe brevemente el motivo (mín. 10 caracteres)') && valid;
  }

  return valid;
}

function validateField(id, rule, errorMsg) {
  const el = document.getElementById(id);
  if (!el) return true;
  const val = el.value.trim();
  if (!rule(val)) {
    showError(id, errorMsg);
    el.classList.add('error');
    return false;
  }
  return true;
}

function showError(id, msg) {
  const el = document.getElementById(id) || document.querySelector(`[data-error="${id}"]`);
  if (!el) return;
  let errEl = el.parentElement?.querySelector('.field-error');
  if (!errEl) {
    errEl = document.createElement('span');
    errEl.className = 'field-error';
    el.parentElement?.appendChild(errEl);
  }
  errEl.textContent = msg;
  el.classList.add('error');
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.remove());
  document.querySelectorAll('.error').forEach(e => e.classList.remove('error'));
}

// ─── Consultation type toggle ─────────────────────────────────────────────────
function bindConsultTypeToggle() {
  document.querySelectorAll('input[name="rdvType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isTele = radio.value === 'teleconsulta';
      const telemsg = document.getElementById('tele-info-msg');
      if (telemsg) telemsg.style.display = isTele ? 'block' : 'none';
    });
  });
}

// ─── Date minimum (today) ─────────────────────────────────────────────────────
function bindDateMin() {
  const dateInput = document.getElementById('rPreference');
  if (!dateInput) return;
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
}

// ─── Phone format ─────────────────────────────────────────────────────────────
function bindPhoneFormat() {
  const phone = document.getElementById('rPhone');
  if (!phone) return;
  phone.addEventListener('input', () => {
    phone.value = phone.value.replace(/[^\d\s\+\-\(\)]/g, '');
  });
}

// ─── Step buttons ─────────────────────────────────────────────────────────────
function bindStepButtons() {
  const submitBtn = document.getElementById('rdvSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', e => {
      e.preventDefault();
      submitRDV();
    });
  }
  const form = document.getElementById('rdvForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      submitRDV();
    });
  }
}

// ─── Dynamic doctor list ──────────────────────────────────────────────────────
function bindSpecialtyChange() {
  const specialty = document.getElementById('rSpecialty');
  if (!specialty) return;
  specialty.addEventListener('change', () => updateDoctorList(specialty.value));
}

function updateDoctorList(specialtyValue) {
  const select = document.getElementById('rDoctor');
  if (!select) return;

  const doctors = DOCTORS_BY_SPECIALTY[specialtyValue] || [];
  const noPreference = window.t ? window.t('rdv.doctor.none') || '— Sin preferencia —' : '— Sin preferencia —';

  select.innerHTML = `<option value="">${noPreference}</option>`;
  doctors.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  // Show/hide group if no doctors available
  const group = document.getElementById('rDoctorGroup');
  if (group) group.style.display = doctors.length === 0 ? 'none' : 'block';
}

// ─── Build summary (step 3) ───────────────────────────────────────────────────
function buildSummary() {
  const g  = id => (document.getElementById(id)?.value || '').trim();
  const checkedType = document.querySelector('input[name="rdvType"]:checked');
  const specialtyEl = document.getElementById('rSpecialty');
  const specialtyLabel = specialtyEl?.options[specialtyEl.selectedIndex]?.text || g('rSpecialty');

  const summary = {
    // N8N field names
    nom            : `${g('rFirstName')} ${g('rLastName')}`.trim(),
    email          : g('rEmail'),
    telephone      : g('rPhone'),
    langue         : g('rLang'),
    specialite     : specialtyLabel,
    specialite_key : g('rSpecialty'),
    medecin        : g('rDoctor') || '— Sin preferencia —',
    date_souhaitee : g('rPreference'),
    type_rdv       : checkedType?.value || 'presential',
    motif          : g('rMotive'),
    doc_type       : g('rDoc')
  };

  const box = document.getElementById('rdvSummary');
  if (!box) return;

  const typeLabel = summary.type_rdv === 'teleconsulta' ? '💻 Teleconsulta (Teams)' : '🏥 Presencial';

  box.innerHTML = `
    <div class="summary-grid">
      <div class="summary-section">
        <h4>👤 ${window.t?.('rdv.step1.title') || 'Datos personales'}</h4>
        <p><strong>Nombre:</strong> ${summary.nom}</p>
        <p><strong>Email:</strong> ${summary.email}</p>
        <p><strong>Teléfono:</strong> ${summary.telephone}</p>
        <p><strong>Idioma:</strong> ${summary.langue.toUpperCase()}</p>
        <p><strong>Documento:</strong> ${summary.doc_type}</p>
      </div>
      <div class="summary-section">
        <h4>🏥 ${window.t?.('rdv.step2.title') || 'Consulta'}</h4>
        <p><strong>Tipo:</strong> ${typeLabel}</p>
        <p><strong>Especialidad:</strong> ${summary.specialite}</p>
        <p><strong>Médico:</strong> ${summary.medecin}</p>
        ${summary.date_souhaitee ? `<p><strong>Fecha deseada:</strong> ${formatDate(summary.date_souhaitee)}</p>` : ''}
        <p><strong>Motivo:</strong> ${summary.motif}</p>
      </div>
    </div>
  `;

  // Store payload for submit
  box.dataset.rdvPayload = JSON.stringify(summary);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(window.getCurrentLang?.() || 'es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function submitRDV() {
  const consent = document.getElementById('rConsent');
  if (!consent?.checked) {
    showError('rConsent', 'Debes aceptar el consentimiento para continuar');
    return;
  }

  const box = document.getElementById('rdvSummary');
  if (!box?.dataset.rdvPayload) return;

  const payload = JSON.parse(box.dataset.rdvPayload);
  // Enrich with page language
  payload.langue_interface = window.getCurrentLang?.() || 'es';
  payload.source = 'web-form';
  payload.timestamp = new Date().toISOString();

  const submitBtn = document.getElementById('rdvSubmit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ ' + (window.t?.('rdv.sending') || 'Enviando...');
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

    // ── Success: hide form, show confirmation ──────────────────────────────
    const formEl = document.getElementById('rdvForm');
    const stepsEl = document.getElementById('rdvSteps');
    if (formEl)  formEl.style.display  = 'none';
    if (stepsEl) stepsEl.style.display = 'none';

    const successEl = document.getElementById('rdvSuccess');
    if (successEl) {
      // Enrich the success message with dossier ref if returned
      if (data.dossier) {
        const refEl = document.createElement('p');
        refEl.style.cssText = 'margin-top:.6rem;font-size:.9rem;font-weight:600;';
        refEl.innerHTML = `📋 ${window.t?.('rdv.dossier') || 'Expediente'}: <strong>${data.dossier}</strong>`;
        successEl.querySelector('div')?.appendChild(refEl);
      }
      successEl.style.display = 'flex';
      successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

  } catch (err) {
    console.error('RDV submit error:', err);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span data-i18n="rdv.submit">${window.t?.('rdv.submit') || 'Confirmar cita'}</span>`;
    }
    const errorEl = document.getElementById('rdvError');
    if (errorEl) {
      errorEl.textContent = window.t?.('rdv.error') || 'Error al enviar la solicitud. Por favor, llámanos directamente al +34 965 000 000.';
      errorEl.style.display = 'block';
    } else {
      // Fallback: show inline under submit button
      showError('rdvSubmit', 'Error al enviar. Por favor, llámanos al +34 965 000 000.');
    }
  }
}

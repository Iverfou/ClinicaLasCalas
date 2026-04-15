/**
 * rdv.js — Clínica Las Calas
 * 3-step appointment booking form: navigation, validation, summary, submit
 */

const RDV_API = 'https://kenzel2122.app.n8n.cloud/webhook/clinica-rdv';
let currentStep = 1;
const TOTAL_STEPS = 3;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showStep(1);
  bindStepButtons();
  bindConsultTypeToggle();
  bindDateMin();
  bindPhoneFormat();
});

// ─── Step navigation ──────────────────────────────────────────────────────────
function showStep(step) {
  currentStep = step;
  document.querySelectorAll('.rdv-step-content').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.step) === step);
  });
  document.querySelectorAll('.step-indicator').forEach(ind => {
    const s = parseInt(ind.dataset.step);
    ind.classList.remove('active', 'completed');
    if (s === step)  ind.classList.add('active');
    if (s < step)    ind.classList.add('completed');
  });
  // Scroll top of form
  const form = document.querySelector('.rdv-form-container');
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
    valid = validateField('rdv-firstname', v => v.length >= 2, 'Mínimo 2 caracteres') && valid;
    valid = validateField('rdv-lastname',  v => v.length >= 2, 'Mínimo 2 caracteres') && valid;
    valid = validateField('rdv-email',     v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email inválido') && valid;
    valid = validateField('rdv-phone',     v => v.replace(/\s/g,'').length >= 9, 'Teléfono inválido') && valid;
    const docType = document.querySelector('input[name="doc_type"]:checked');
    if (!docType) {
      showError('doc-type-group', 'Selecciona un tipo de documento');
      valid = false;
    }
    valid = validateField('rdv-docnum', v => v.length >= 6, 'Número de documento inválido') && valid;
  }

  if (step === 2) {
    const type = document.querySelector('input[name="rdv_type"]:checked');
    if (!type) {
      showError('rdv-type-group', 'Selecciona el tipo de consulta');
      valid = false;
    }
    valid = validateField('rdv-specialty', v => v !== '', 'Selecciona una especialidad') && valid;
    valid = validateField('rdv-motive',    v => v.length >= 10, 'Describe brevemente el motivo (mín. 10 caracteres)') && valid;
    valid = validateField('rdv-date',      v => v !== '', 'Selecciona una fecha preferida') && valid;
    const lang = document.getElementById('rdv-lang');
    if (lang) valid = validateField('rdv-lang', v => v !== '', 'Selecciona un idioma') && valid;
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
  document.querySelectorAll('input[name="rdv_type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isTele = radio.value === 'teleconsulta';
      const telemsg = document.getElementById('tele-info-msg');
      if (telemsg) telemsg.style.display = isTele ? 'block' : 'none';
    });
  });
}

// ─── Date minimum (today) ─────────────────────────────────────────────────────
function bindDateMin() {
  const dateInput = document.getElementById('rdv-date');
  if (!dateInput) return;
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
}

// ─── Phone format ─────────────────────────────────────────────────────────────
function bindPhoneFormat() {
  const phone = document.getElementById('rdv-phone');
  if (!phone) return;
  phone.addEventListener('input', () => {
    phone.value = phone.value.replace(/[^\d\s\+\-\(\)]/g, '');
  });
}

// ─── Step buttons ─────────────────────────────────────────────────────────────
function bindStepButtons() {
  // Step 1 → 2
  const next1 = document.getElementById('step1-next');
  if (next1) next1.addEventListener('click', () => goStep('next'));

  // Step 2 → 1 / 3
  const back2 = document.getElementById('step2-back');
  const next2 = document.getElementById('step2-next');
  if (back2) back2.addEventListener('click', () => goStep('back'));
  if (next2) next2.addEventListener('click', () => goStep('next'));

  // Step 3 → 2 / submit
  const back3  = document.getElementById('step3-back');
  const submit = document.getElementById('rdv-submit');
  if (back3)  back3.addEventListener('click', () => goStep('back'));
  if (submit) submit.addEventListener('click', submitRDV);
}

// ─── Build summary (step 3) ───────────────────────────────────────────────────
function buildSummary() {
  const g = id => (document.getElementById(id)?.value || '').trim();
  const checkedDoc  = document.querySelector('input[name="doc_type"]:checked');
  const checkedType = document.querySelector('input[name="rdv_type"]:checked');

  const summary = {
    firstname : g('rdv-firstname'),
    lastname  : g('rdv-lastname'),
    email     : g('rdv-email'),
    phone     : g('rdv-phone'),
    docType   : checkedDoc?.value  || '',
    docNum    : g('rdv-docnum'),
    lang      : g('rdv-lang'),
    type      : checkedType?.value || '',
    specialty : g('rdv-specialty'),
    motive    : g('rdv-motive'),
    date      : g('rdv-date')
  };

  // Render in summary box
  const box = document.getElementById('summary-box');
  if (!box) return;

  box.innerHTML = `
    <div class="summary-grid">
      <div class="summary-section">
        <h4>👤 ${window.t('rdv.step1.title') || 'Datos personales'}</h4>
        <p><strong>Nombre:</strong> ${summary.firstname} ${summary.lastname}</p>
        <p><strong>Email:</strong> ${summary.email}</p>
        <p><strong>Teléfono:</strong> ${summary.phone}</p>
        <p><strong>Documento:</strong> ${summary.docType} – ${summary.docNum}</p>
        ${summary.lang ? `<p><strong>Idioma:</strong> ${summary.lang}</p>` : ''}
      </div>
      <div class="summary-section">
        <h4>🏥 ${window.t('rdv.step2.title') || 'Consulta'}</h4>
        <p><strong>Tipo:</strong> ${summary.type === 'presencial' ? '🏥 Presencial' : '💻 Teleconsulta'}</p>
        <p><strong>Especialidad:</strong> ${summary.specialty}</p>
        <p><strong>Motivo:</strong> ${summary.motive}</p>
        <p><strong>Fecha deseada:</strong> ${formatDate(summary.date)}</p>
      </div>
    </div>
  `;

  // Store for submit
  box.dataset.payload = JSON.stringify(summary);
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
  const consent = document.getElementById('rdv-consent');
  if (!consent?.checked) {
    showError('rdv-consent', 'Debes aceptar el consentimiento para continuar');
    return;
  }

  const box = document.getElementById('summary-box');
  if (!box?.dataset.payload) return;
  const payload = JSON.parse(box.dataset.payload);
  payload.lang = window.getCurrentLang?.() || 'es';

  const submitBtn = document.getElementById('rdv-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Enviando...';
  }

  try {
    const res = await fetch(RDV_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();

    // Show success state
    const form = document.querySelector('.rdv-form-container');
    if (form) {
      form.innerHTML = `
        <div class="rdv-success">
          <div class="success-icon">✅</div>
          <h2>${window.t('rdv.success.title') || '¡Solicitud enviada!'}</h2>
          <p>${window.t('rdv.success.desc') || 'Te contactaremos en menos de 2 horas para confirmar tu cita.'}</p>
          ${data.dossier ? `<p class="dossier-ref">📋 Expediente: <strong>${data.dossier}</strong></p>` : ''}
          <a href="/index.html" class="btn btn-primary">← Volver al inicio</a>
        </div>
      `;
    }

  } catch (err) {
    console.error('RDV submit error:', err);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = window.t('rdv.submit') || 'Confirmar cita';
    }
    const errorEl = document.getElementById('rdv-error');
    if (errorEl) {
      errorEl.textContent = 'Error al enviar la solicitud. Por favor, llámanos directamente.';
      errorEl.style.display = 'block';
    }
  }
}

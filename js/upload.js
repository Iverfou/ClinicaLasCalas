/**
 * upload.js — Clínica Las Calas
 * Drag & drop file upload with Claude Vision analysis
 */

const UPLOAD_API = '/api/upload';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['application/pdf','image/jpeg','image/png','image/heic','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_EXT   = ['.pdf','.jpg','.jpeg','.png','.heic','.doc','.docx'];

let selectedFiles = [];

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDropzone();
  bindFileInput();
  bindSubmit();
  prefillDossier();
});

// ─── Prefill dossier from URL param ──────────────────────────────────────────
function prefillDossier() {
  const params  = new URLSearchParams(window.location.search);
  const dossier = params.get('dossier');
  if (dossier) {
    const input = document.getElementById('upload-dossier');
    if (input) input.value = dossier;
    const banner = document.getElementById('dossier-banner');
    if (banner) {
      banner.textContent = `📋 Expediente: ${dossier}`;
      banner.style.display = 'block';
    }
  }
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────
function initDropzone() {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  });

  zone.addEventListener('click', () => {
    const input = document.getElementById('file-input');
    if (input) input.click();
  });
}

function bindFileInput() {
  const input = document.getElementById('file-input');
  if (!input) return;
  input.addEventListener('change', () => {
    addFiles(Array.from(input.files));
    input.value = ''; // Reset so same file can be re-added
  });
}

// ─── File management ──────────────────────────────────────────────────────────
function addFiles(files) {
  const errors = [];
  files.forEach(file => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      errors.push(`${file.name}: formato no permitido`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: archivo demasiado grande (máx. 10 MB)`);
      return;
    }
    if (selectedFiles.find(f => f.name === file.name && f.size === file.size)) return;
    selectedFiles.push(file);
  });

  if (errors.length) showUploadError(errors.join('\n'));
  renderFileList();
  updateSubmitBtn();
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
  updateSubmitBtn();
}

function renderFileList() {
  const list = document.getElementById('file-list');
  if (!list) return;

  if (!selectedFiles.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = selectedFiles.map((file, i) => `
    <div class="file-item" data-index="${i}">
      <span class="file-icon">${getFileIcon(file.name)}</span>
      <span class="file-name">${escapeHtml(file.name)}</span>
      <span class="file-size">${formatSize(file.size)}</span>
      <button class="file-remove" onclick="removeFile(${i})" aria-label="Eliminar">✕</button>
    </div>
  `).join('');
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = { pdf: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', heic: '🖼️', doc: '📝', docx: '📝' };
  return icons[ext] || '📎';
}

function formatSize(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function updateSubmitBtn() {
  const btn = document.getElementById('upload-submit');
  if (btn) btn.disabled = selectedFiles.length === 0;
}

// ─── Submit ───────────────────────────────────────────────────────────────────
function bindSubmit() {
  const btn = document.getElementById('upload-submit');
  if (btn) btn.addEventListener('click', submitUpload);
}

async function submitUpload() {
  if (!selectedFiles.length) {
    showUploadError('Por favor seleccione al menos un archivo.');
    return;
  }

  const consent = document.getElementById('uConsent');
  if (consent && !consent.checked) {
    showUploadError('Por favor acepte las condiciones de uso.');
    return;
  }

  const dossier  = (document.getElementById('upload-dossier')?.value || '').trim();
  const firstname= (document.getElementById('upload-firstname')?.value || '').trim();
  const lastname = (document.getElementById('upload-lastname')?.value || '').trim();
  const email    = (document.getElementById('upload-email')?.value || '').trim();
  const notes    = (document.getElementById('upload-notes')?.value || '').trim();

  const categories = [];
  document.querySelectorAll('input[name="doc_cat"]:checked').forEach(cb => categories.push(cb.value));

  const btn = document.getElementById('upload-submit');
  const originalText = btn?.innerHTML || '📤 Enviar documentos';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Enviando…';
  }

  showProgressBar(0);

  try {
    // Convert all files to base64
    showProgressBar(10);
    const filesBase64 = await Promise.all(selectedFiles.map(async file => ({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData: await fileToBase64(file)
    })));

    showProgressBar(30);

    const lang = document.documentElement.lang || 'es';
    const docType = categories[0] || 'other';

    // Build JSON payload — one entry per file, N8N receives fileData + metadata
    const payload = {
      dossier   : dossier || null,
      fullName  : `${firstname} ${lastname}`.trim(),
      firstname,
      lastname,
      email,
      notes     : notes || null,
      lang,
      docType,
      categories,
      timestamp : new Date().toISOString(),
      // Primary file (first) for N8N single-file workflows
      fileName  : filesBase64[0]?.fileName || null,
      fileType  : filesBase64[0]?.fileType || null,
      fileData  : filesBase64[0]?.fileData || null,
      // All files for N8N multi-file workflows
      files     : filesBase64
    };

    showProgressBar(50);

    const res = await fetch(UPLOAD_API, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload)
    });

    showProgressBar(80);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error del servidor (${res.status})`);
    }

    const data = await res.json();
    showProgressBar(100);

    showUploadSuccess(data);

    // Show Vision analysis result
    if (data.analysis) {
      showVisionResult(data.analysis);
    }

  } catch (err) {
    console.error('Upload error:', err);
    showUploadError(err.message || 'Error al enviar los documentos. Inténtalo de nuevo o contáctanos.');
    hideProgressBar();
  } finally {
    // Always restore button
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function showProgressBar(pct) {
  const bar = document.getElementById('upload-progress');
  if (!bar) return;
  bar.style.display = 'block';
  const fill = bar.querySelector('.progress-fill');
  if (fill) fill.style.width = pct + '%';
}

function hideProgressBar() {
  const bar = document.getElementById('upload-progress');
  if (bar) bar.style.display = 'none';
}

// ─── Success / Error states ───────────────────────────────────────────────────
function showUploadSuccess(data) {
  // Show the success alert already in the HTML
  const successEl = document.getElementById('upload-success');
  if (successEl) {
    successEl.style.display = 'block';
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Hide the submit button area and file zone
  const submitBtn = document.getElementById('upload-submit');
  if (submitBtn) submitBtn.style.display = 'none';

  const dropZone = document.getElementById('drop-zone');
  if (dropZone) dropZone.style.display = 'none';

  const fileList = document.getElementById('file-list');
  if (fileList) fileList.style.display = 'none';

  // Show dossier ref if returned by API
  if (data?.dossier) {
    const dossierEl = document.getElementById('upload-dossier');
    if (dossierEl) dossierEl.value = data.dossier;
  }
}

function showUploadError(msg) {
  const errorEl = document.getElementById('upload-error');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { errorEl.style.display = 'none'; }, 8000);
  }
}

// ─── Vision result ────────────────────────────────────────────────────────────
function showVisionResult(analysis) {
  const box = document.getElementById('vision-result');
  if (!box) return;
  box.style.display = 'block';
  const content = box.querySelector('.vision-content');
  if (content) {
    content.innerHTML = renderMarkdown(analysis);
  }
}

function renderMarkdown(text) {
  return text
    // Headers ## and # → bold labels
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong style="font-size:.95rem;display:block;margin:.6rem 0 .2rem">$1</strong>')
    // Bold **text**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic *text*
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // List items - item
    .replace(/^[-•]\s+(.+)$/gm, '<span style="display:block;padding-left:.8rem">• $1</span>')
    // Line breaks
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]); // strip data:...;base64,
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Expose for inline onclick
window.removeFile = removeFile;

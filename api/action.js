// api/action.js — Clínica Las Calas
// GET  ?token=XXX  → charge données Airtable via N8N, mappe vers champs action.html
// POST             → traite la décision médecin → N8N → Resend + Airtable

// ── Helper: parse JSON body (Vercel ne parse pas automatiquement) ──────────────
function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk.toString());
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { resolve({}); }
    });
  });
}

// ── Helper: mapper champs Airtable (FR) → champs action.html ─────────────────
function mapAirtableFields(raw) {
  // N8N peut retourner { fields: {...} } ou directement { ... }
  const f = raw?.fields || raw || {};

  // Mapper type document → label lisible
  const docTypeRaw = f['Documents reçus'] || f['docType'] || '';
  const docTypeLabels = {
    identidad: 'Documento de identidad',
    identity : 'Identity document',
    seguro   : 'Seguro médico',
    insurance: 'Health insurance',
    medico   : 'Documento médico',
    medical  : 'Medical document',
    autre    : 'Autre document',
    other    : 'Other document',
  };
  const docTypeLabel = docTypeLabels[docTypeRaw?.toLowerCase()] || docTypeRaw || '—';

  // Parser l'analyse si c'est une string JSON
  let analysis = f['Analyse'] || f['analysis'] || null;
  if (typeof analysis === 'string') {
    try { analysis = JSON.parse(analysis); }
    catch(e) { analysis = { resumen_medico: analysis }; }
  }

  return {
    dossier    : f['Nº Client']              || f['dossier']     || null,
    patientName: f['Nom Complet']            || f['patientName'] || null,
    patientEmail: f['Email']                 || f['email']       || null,
    patientLang: f['Langue']                 || f['lang']        || 'es',
    docType    : docTypeRaw,
    docTypeLabel,
    fileName   : f['Nom sur document']       || f['fileName']    || null,
    uploadDate : f['Date premier contact']   || f['uploadDate']  || null,
    oneDriveUrl: f['OneDrive URL']           || f['oneDriveUrl'] || null,
    airtableUrl: f['Airtable URL']           || f['airtableUrl'] || null,
    analysis,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const n8nWebhook = process.env.N8N_ACTION_WEBHOOK;

  // ── GET: charger et mapper les données du token ───────────────────────────
  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    if (!n8nWebhook) {
      // Demo mode
      return res.status(200).json({ demo: true, valid: true });
    }

    try {
      const r = await fetch(n8nWebhook, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ action: 'get_token', token })
      });

      if (!r.ok) {
        console.error('N8N GET error:', r.status);
        return res.status(200).json({ error: 'invalid' });
      }

      const data = await r.json().catch(() => null);
      const record = Array.isArray(data) ? data[0] : data;
      const fields = record?.fields || {};

      // Token déjà utilisé
      if (fields['Token utilisé'] === true) {
        return res.status(200).json({ used: true });
      }

      // Record non trouvé
      if (!fields['Nº Client']) {
        return res.status(200).json({ error: 'invalid' });
      }

      const docTypeMap = {
        identidad: 'Documento de identidad',
        seguro   : 'Seguro médico',
        medico   : 'Documento médico',
      };
      const docType = fields['Documents reçus'] || '';

      return res.status(200).json({
  dossier     : fields['Nº Client']      || '',
  patientName : fields['Nom Complet']    || '',
  patientEmail: fields['Email']          || '',
  patientLang : (fields['Langue'] || 'es').trim(),
  docType     : fields['Notes']          || '',
  docTypeLabel: fields['Notes']          || '',
  fileName    : fields['fileName']       || '',
  uploadDate  : fields['RECEPTION DATE'] || '',
  oneDriveUrl : fields['One Drive']      || '',
  airtableUrl : '',
  analysis    : {resumen_medico: fields['Notes'] || ''
  },
});
    } catch(e) {
      console.error('GET error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: traiter la décision médecin ─────────────────────────────────────
  if (req.method === 'POST') {
    const body = await parseBody(req);

    const {
      token,
      action,        // valid | refus | supp
      dossier,
      patientEmail,
      patientName,
      patientLang,
      docType,
      fileName,
      reason,
      instruction,
      deadline,
      note,
      analysis
    } = body;

    if (!token || !action) {
      return res.status(400).json({ error: 'Missing token or action' });
    }

    const siteUrl   = process.env.SITE_URL || 'https://clinica-las-calas.vercel.app';
    const uploadLink = `${siteUrl}/upload.html?dossier=${encodeURIComponent(dossier || '')}&lang=${patientLang || 'es'}`;

    const airtableStatus = {
      valid: 'Docs validados',
      refus: 'Doc rechazado — nuevo envío requerido',
      supp : 'Doc adicional solicitado',
    }[action];

    const payload = {
      action,
      token,
      dossier,
      patientEmail,
      patientName,
      patientLang    : patientLang || 'es',
      docType,
      fileName,
      airtableStatus,
      uploadLink,
      note           : action === 'valid'               ? (note || '')        : null,
      reason         : ['refus','supp'].includes(action) ? (reason || '')      : null,
      instruction    : action === 'refus'               ? (instruction || '') : null,
      deadline       : action === 'supp'                ? (deadline || '')    : null,
      analysisSummary: action === 'valid'               ? (analysis?.resumen_medico || null) : null,
      timestamp      : new Date().toISOString(),
    };

    if (!n8nWebhook) {
      console.warn('N8N_ACTION_WEBHOOK not set — demo mode');
      return res.status(200).json({ success: true, demo: true, action, dossier });
    }

    try {
      const r = await fetch(n8nWebhook, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(payload)
      });

      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        console.error('N8N POST error:', errText);
        return res.status(500).json({ error: 'N8N error', detail: errText });
      }

      const data = await r.json().catch(() => ({}));
      return res.status(200).json({ success: true, action, dossier, ...data });

    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

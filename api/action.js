// api/action.js — Clínica Las Calas
// GET  ?token=XXX  → retourne les données du document à valider
// POST             → traite la décision médecin → N8N → Resend + Airtable

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const n8nWebhook = process.env.N8N_ACTION_WEBHOOK;

  // ── GET: charger les données du token ──────────────
  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    if (!n8nWebhook) {
      // Demo: token toujours valide
      return res.status(200).json({ demo: true, valid: true });
    }

    try {
      const r = await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_token', token })
      });
      const data = await r.json();
      return res.status(200).json(data);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: traiter la décision ──────────────────────
  if (req.method === 'POST') {
    const {
      token,
      action,         // valid | refus | supp
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
    } = req.body;

    if (!token || !action) {
      return res.status(400).json({ error: 'Missing token or action' });
    }

    // Construire le payload N8N
    // N8N se charge de :
    // 1. Marquer le token comme utilisé (Airtable)
    // 2. Mettre à jour le statut Airtable du dossier
    // 3. Envoyer l'email patient dans sa langue (Resend)
    // 4. Si refus → inclure lien nouvel upload dans l'email
    // 5. Si supp  → inclure lien upload + précision du doc demandé

    const uploadLink = `${process.env.SITE_URL || 'https://clinica-las-calas.vercel.app'}/upload.html?dossier=${encodeURIComponent(dossier)}&lang=${patientLang || 'es'}`;

    const airtableStatus = {
      valid: 'Docs validados',
      refus: 'Doc rechazado — nuevo envío requerido',
      supp:  'Doc adicional solicitado'
    }[action];

    const payload = {
      action,           // pour N8N: brancher sur valid / refus / supp
      token,
      dossier,
      patientEmail,
      patientName,
      patientLang: patientLang || 'es',
      docType,
      fileName,
      airtableStatus,
      uploadLink,       // lien pré-rempli pour nouvel upload
      // Selon l'action
      note:        action === 'valid' ? (note || '') : null,
      reason:      ['refus','supp'].includes(action) ? reason : null,
      instruction: action === 'refus' ? (instruction || '') : null,
      deadline:    action === 'supp'  ? (deadline || '') : null,
      // Résumé Claude Vision pour l'email patient (si validation)
      analysisSummary: action === 'valid' ? (analysis?.resumen_medico || null) : null,
      timestamp: new Date().toISOString()
    };

    if (!n8nWebhook) {
      console.warn('N8N_ACTION_WEBHOOK not set — demo mode');
      return res.status(200).json({ success: true, demo: true, action, dossier });
    }

    try {
      const r = await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error('N8N error:', errText);
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

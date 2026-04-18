// api/upload.js — Clínica Las Calas
// Proxy → N8N_UPLOAD_WEBHOOK
// Remappe les champs frontend (camelCase) vers les noms attendus par N8N (snake_case FR)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parse JSON body (Vercel ne parse pas automatiquement)
    const body = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk.toString());
      req.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({});
        }
      });
    });

    if (!body.email || !body.fileData) {
      return res.status(400).json({ error: 'Missing required fields (email, fileData)' });
    }

    const n8nWebhook = process.env.N8N_UPLOAD_WEBHOOK;

    if (!n8nWebhook) {
      console.warn('N8N_UPLOAD_WEBHOOK not set — demo mode');
      return res.status(200).json({ success: true, demo: true });
    }

    // Remapping frontend → N8N (champs attendus par le workflow N8N)
    const n8nPayload = {
      // Champs fichier (noms attendus par JS1 N8N)
      fichier_base64 : body.fileData,
      fichier_type   : body.fileType   || 'application/octet-stream',
      fichier_nom    : body.fileName   || 'document',

      // Champs document
      type_document  : body.docType    || 'other',
      type_dossier   : body.categories?.[0] || body.docType || 'autre',

      // Champs patient
      nom            : body.fullName   || `${body.firstname || ''} ${body.lastname || ''}`.trim(),
      email          : body.email,
      dossier        : body.dossier    || null,
      notes          : body.notes      || null,
      lang           : body.lang       || 'es',
      timestamp      : body.timestamp  || new Date().toISOString(),

      // Multi-fichiers : tableau pour N8N si plusieurs fichiers
      fichiers       : (body.files || []).map(f => ({
        fichier_base64: f.fileData,
        fichier_type  : f.fileType,
        fichier_nom   : f.fileName,
        fichier_taille: f.fileSize
      }))
    };

    const n8nRes = await fetch(n8nWebhook, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(n8nPayload)
    });

    if (!n8nRes.ok) {
      const errText = await n8nRes.text().catch(() => '');
      console.error('N8N error:', n8nRes.status, errText);
      return res.status(502).json({ error: `N8N error ${n8nRes.status}`, detail: errText });
    }

    const data = await n8nRes.json().catch(() => ({}));
    return res.status(200).json({ success: true, ...data });

  } catch (err) {
    console.error('Upload API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

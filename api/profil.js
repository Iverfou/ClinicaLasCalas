// api/profil.js — Clínica Las Calas
// Actions: verify (access by dossier+email), get (by token), reply (send message reply)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const n8nWebhook = process.env.N8N_PROFIL_WEBHOOK;

  // ── GET by token ──────────────────────────────────────
  if (req.method === 'GET') {
    const { token, dossier, lang } = req.query;

    if (!token && !dossier) {
      return res.status(400).json({ error: 'Missing token or dossier' });
    }

    if (!n8nWebhook) {
      return res.status(200).json({ patient: null, demo: true });
    }

    try {
      const n8nRes = await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', token, dossier, lang: lang || 'es' })
      });
      const data = await n8nRes.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST actions ──────────────────────────────────────
  if (req.method === 'POST') {
    const { action, dossier, email, lang, msgIndex, reply } = req.body;

    // ── VERIFY: check dossier + email, return patient data
    if (action === 'verify') {
      if (!dossier || !email) {
        return res.status(400).json({ error: 'Missing dossier or email' });
      }

      if (!n8nWebhook) {
        // Demo mode — return null so frontend uses mock
        return res.status(200).json({ patient: null, demo: true });
      }

      try {
        const n8nRes = await fetch(n8nWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', dossier, email, lang: lang || 'es' })
        });
        const data = await n8nRes.json();
        return res.status(200).json(data);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ── REPLY: patient replies to a clinic message
    if (action === 'reply') {
      if (!reply || !dossier) {
        return res.status(400).json({ error: 'Missing reply or dossier' });
      }

      if (!n8nWebhook) {
        return res.status(200).json({ success: true, demo: true });
      }

      try {
        // N8N will: save reply to Airtable + notify relevant staff by email
        const n8nRes = await fetch(n8nWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reply',
            dossier,
            msgIndex,
            reply,
            lang: lang || 'es',
            timestamp: new Date().toISOString()
          })
        });
        const data = await n8nRes.json().catch(() => ({}));
        return res.status(200).json({ success: true, ...data });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// api/upload.js — Clínica Las Calas
// Simple proxy → N8N_UPLOAD_WEBHOOK
// Toute la logique est dans N8N (Claude Vision, Airtable, OneDrive, Resend)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
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

    if (!body.email || !body.docType || !body.fileData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const n8nWebhook = process.env.N8N_UPLOAD_WEBHOOK;

    if (!n8nWebhook) {
      return res.status(200).json({ success: true, demo: true });
    }

    const n8nRes = await fetch(n8nWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await n8nRes.json().catch(() => ({}));
    return res.status(200).json({ success: true, ...data });

  } catch (err) {
    console.error('Upload API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

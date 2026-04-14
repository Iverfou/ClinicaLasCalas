/**
 * api/upload.js — Clínica Las Calas
 * File upload: Claude Vision analysis + OneDrive storage + Airtable update + Resend notification
 */

import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend    = new Resend(process.env.RESEND_API_KEY);

const AIRTABLE_BASE  = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE_RDV || 'RDV';
const AIRTABLE_KEY   = process.env.AIRTABLE_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL   || 'noreply@clinicalascalas.es';
const CLINIC_EMAIL   = process.env.CLINIC_EMAIL || 'info@clinicalascalas.es';

// ─── Vercel config: allow large body for file uploads ─────────────────────────
export const config = {
  api: { bodyParser: false }
};

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Parse multipart form
  let fields, files;
  try {
    ({ fields, files } = await parseMultipart(req));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid form data' });
  }

  const dossier   = fields.dossier   || '';
  const firstname = fields.firstname || '';
  const lastname  = fields.lastname  || '';
  const email     = fields.email     || '';
  const notes     = fields.notes     || '';
  const lang      = fields.lang      || 'es';
  const categories= JSON.parse(fields.categories || '[]');

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files received' });
  }

  try {
    // 1. Claude Vision analysis (first image/PDF file only)
    let analysis = null;
    const analysisCandidates = files.filter(f =>
      ['image/jpeg','image/png','image/heic','application/pdf'].includes(f.mimetype)
    );
    if (analysisCandidates.length > 0) {
      analysis = await analyzeWithVision(analysisCandidates[0]).catch(err => {
        console.error('Vision error:', err);
        return null;
      });
    }

    // 2. Upload to OneDrive (non-blocking)
    const folderName = dossier
      ? `${dossier} – ${firstname} ${lastname}`.trim()
      : `Upload_${Date.now()}`;
    uploadToOneDrive(files, folderName, categories).catch(err =>
      console.error('OneDrive upload error:', err)
    );

    // 3. Update Airtable status
    if (dossier) {
      updateAirtableStatus(dossier, files.length, categories).catch(err =>
        console.error('Airtable update error:', err)
      );
    }

    // 4. Send notification emails
    await Promise.allSettled([
      email && sendClientConfirmation({ email, firstname, lastname, dossier, filesCount: files.length }),
      sendClinicNotification({ dossier, firstname, lastname, email, filesCount: files.length, categories, notes })
    ]);

    return res.status(200).json({
      success   : true,
      dossier   : dossier || null,
      filesCount: files.length,
      analysis
    });

  } catch (err) {
    console.error('Upload API error:', err);
    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
}

// ─── Parse multipart (manual, no external dep) ───────────────────────────────
async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      const buffer  = Buffer.concat(chunks);
      const ctype   = req.headers['content-type'] || '';
      const boundary = ctype.split('boundary=')[1];
      if (!boundary) return reject(new Error('No boundary'));

      const fields = {};
      const files  = [];
      const parts  = buffer.toString('binary').split('--' + boundary);

      parts.forEach(part => {
        if (!part || part.trim() === '--') return;
        const [headerStr, ...bodyParts] = part.split('\r\n\r\n');
        const body = bodyParts.join('\r\n\r\n').replace(/\r\n$/, '');
        const cdMatch = headerStr.match(/Content-Disposition:[^\n]*name="([^"]+)"/i);
        if (!cdMatch) return;
        const name = cdMatch[1];
        const fnMatch = headerStr.match(/filename="([^"]+)"/i);
        const ctMatch = headerStr.match(/Content-Type:\s*([^\s;]+)/i);

        if (fnMatch) {
          // File field
          files.push({
            fieldname: name,
            filename : fnMatch[1],
            mimetype : ctMatch ? ctMatch[1] : 'application/octet-stream',
            buffer   : Buffer.from(body, 'binary')
          });
        } else {
          fields[name] = body;
        }
      });

      resolve({ fields, files });
    });
  });
}

// ─── Claude Vision ────────────────────────────────────────────────────────────
async function analyzeWithVision(file) {
  const base64 = file.buffer.toString('base64');
  const mediaType = file.mimetype.startsWith('image/') ? file.mimetype : 'image/jpeg';

  // Only images supported by vision; skip PDFs for now
  if (!file.mimetype.startsWith('image/')) {
    return `📄 Documento recibido: ${file.filename}\n\nAnálisis PDF disponible tras revisión médica.`;
  }

  const response = await anthropic.messages.create({
    model    : 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system   : 'Eres un asistente médico. Analiza este documento médico y resume brevemente su contenido: tipo de documento, fecha si visible, información relevante. NO hagas diagnósticos. Responde en el idioma del documento.',
    messages : [{
      role   : 'user',
      content: [{
        type  : 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 }
      }, {
        type: 'text',
        text: 'Analiza este documento médico brevemente.'
      }]
    }]
  });

  return response.content[0]?.text || 'Documento recibido correctamente.';
}

// ─── OneDrive upload ──────────────────────────────────────────────────────────
async function uploadToOneDrive(files, folderName, categories) {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, ONEDRIVE_FOLDER } = process.env;
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) return;

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type   : 'client_credentials',
        client_id    : MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        scope        : 'https://graph.microsoft.com/.default'
      })
    }
  );
  if (!tokenRes.ok) return;
  const { access_token } = await tokenRes.json();

  const parentPath = ONEDRIVE_FOLDER || 'Pacientes';
  const uploadPath = `${parentPath}/${folderName}`;

  for (const file of files) {
    const fileUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${uploadPath}/${file.filename}:/content`;
    await fetch(fileUrl, {
      method : 'PUT',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type' : file.mimetype
      },
      body: file.buffer
    });
  }
}

// ─── Airtable: Update status ──────────────────────────────────────────────────
async function updateAirtableStatus(dossier, filesCount, categories) {
  // Find record by dossier number
  const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}?filterByFormula=SEARCH("${dossier}",{Expediente})`;
  const searchRes = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_KEY}` }
  });
  if (!searchRes.ok) return;
  const { records } = await searchRes.json();
  if (!records?.length) return;

  const recordId = records[0].id;
  await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}/${recordId}`,
    {
      method : 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_KEY}`,
        'Content-Type' : 'application/json'
      },
      body: JSON.stringify({
        fields: {
          'Estado'           : 'Docs recibidos',
          'Nº docs recibidos': filesCount,
          'Categorías docs'  : categories.join(', '),
          'Fecha docs'       : new Date().toISOString().split('T')[0]
        }
      })
    }
  );
}

// ─── Emails ───────────────────────────────────────────────────────────────────
async function sendClientConfirmation({ email, firstname, lastname, dossier, filesCount }) {
  await resend.emails.send({
    from   : `Clínica Las Calas <${FROM_EMAIL}>`,
    to     : email,
    subject: `✅ Documentos recibidos — ${dossier || 'Clínica Las Calas'}`,
    html   : `
<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
  <div style="background:#1A8FD1;color:white;padding:25px;text-align:center">
    <h2>🏥 Clínica Las Calas</h2>
    <p>Documentos recibidos</p>
  </div>
  <div style="padding:25px;background:#f9f9f9">
    <p>Estimado/a <strong>${firstname} ${lastname}</strong>,</p>
    <p>Hemos recibido tus documentos correctamente (${filesCount} archivo(s)).</p>
    ${dossier ? `<p>📋 <strong>Expediente:</strong> ${dossier}</p>` : ''}
    <p>El médico revisará tus documentos antes de tu consulta.</p>
    <p style="color:#888;font-size:13px">⚠️ En caso de emergencia, llama al 112.</p>
  </div>
</div>`
  });
}

async function sendClinicNotification({ dossier, firstname, lastname, email, filesCount, categories, notes }) {
  await resend.emails.send({
    from   : `Sistema CRM <${FROM_EMAIL}>`,
    to     : CLINIC_EMAIL,
    subject: `📎 Nuevos documentos — ${dossier || 'Sin expediente'} — ${firstname} ${lastname}`,
    html   : `
<div style="font-family:Arial,sans-serif">
  <h3>📎 Nuevos documentos recibidos</h3>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Expediente</td><td style="padding:8px">${dossier || '—'}</td></tr>
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Paciente</td><td style="padding:8px">${firstname} ${lastname}</td></tr>
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Email</td><td style="padding:8px">${email || '—'}</td></tr>
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Archivos</td><td style="padding:8px">${filesCount}</td></tr>
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Categorías</td><td style="padding:8px">${categories.join(', ') || '—'}</td></tr>
    ${notes ? `<tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Notas</td><td style="padding:8px">${notes}</td></tr>` : ''}
  </table>
</div>`
  });
}

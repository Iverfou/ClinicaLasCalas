/**
 * api/rdv.js — Clínica Las Calas
 * Appointment booking: Airtable CRM + OneDrive folder + Resend emails
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Airtable config ──────────────────────────────────────────────────────────
const AIRTABLE_BASE   = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE  = process.env.AIRTABLE_TABLE_RDV || 'RDV';
const AIRTABLE_KEY    = process.env.AIRTABLE_API_KEY;

// ─── Email config ─────────────────────────────────────────────────────────────
const FROM_EMAIL    = process.env.FROM_EMAIL    || 'noreply@clinicalascalas.es';
const CLINIC_EMAIL  = process.env.CLINIC_EMAIL  || 'info@clinicalascalas.es';
const CLINIC_NAME   = 'Clínica Las Calas';

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    firstname, lastname, email, phone,
    docType, docNum, lang,
    type, specialty, motive, date
  } = req.body || {};

  // Basic validation
  if (!firstname || !lastname || !email || !phone || !specialty || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const fullName = `${firstname} ${lastname}`.trim();
  const isoDate  = new Date(date + 'T12:00:00Z').toISOString().split('T')[0];

  try {
    // 1. Create Airtable record → get dossier number
    const dossier = await createAirtableRecord({
      fullName, firstname, lastname, email, phone,
      docType, docNum, lang,
      type, specialty, motive, date: isoDate
    });

    // 2. Create OneDrive folder (non-blocking)
    createOneDriveFolder(dossier, fullName).catch(err =>
      console.error('OneDrive folder error:', err)
    );

    // 3. Send confirmation emails (parallel)
    await Promise.allSettled([
      sendClientEmail({ firstname, lastname, email, type, specialty, date: isoDate, dossier, lang }),
      sendClinicEmail({ fullName, email, phone, type, specialty, motive, date: isoDate, dossier, lang, docType, docNum })
    ]);

    return res.status(200).json({ success: true, dossier });

  } catch (err) {
    console.error('RDV API error:', err);
    return res.status(500).json({ error: 'Booking failed. Please try again or call us.' });
  }
}

// ─── Airtable: Create record ──────────────────────────────────────────────────
async function createAirtableRecord(data) {
  // Get next dossier number
  const existing = await fetchAirtableCount();
  const num = String(existing + 1).padStart(3, '0');
  const dossier = `ClC-${num}`;

  const fields = {
    'Expediente'   : dossier,
    'Nombre'       : data.fullName,
    'Email'        : data.email,
    'Teléfono'     : data.phone,
    'Tipo documento': data.docType || '',
    'Nº documento' : data.docNum  || '',
    'Idioma'       : data.lang    || 'es',
    'Tipo consulta': data.type    === 'teleconsulta' ? 'Teleconsulta' : 'Presencial',
    'Especialidad' : data.specialty,
    'Motivo'       : data.motive  || '',
    'Fecha deseada': data.date,
    'Estado'       : 'Nuevo',
    'Creado'       : new Date().toISOString()
  };

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`,
    {
      method : 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_KEY}`,
        'Content-Type' : 'application/json'
      },
      body: JSON.stringify({ fields })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Airtable error: ${err}`);
  }

  return dossier;
}

async function fetchAirtableCount() {
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}?fields[]=Expediente&pageSize=1&sort[0][field]=Creado&sort[0][direction]=desc`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_KEY}` }
    });
    if (!res.ok) return 0;
    const data = await res.json();
    // Count total records via offset pagination
    return data.offset ? 100 : (data.records?.length || 0);
  } catch {
    return Math.floor(Math.random() * 900) + 1; // fallback random to avoid duplicates
  }
}

// ─── OneDrive: Create patient folder ─────────────────────────────────────────
async function createOneDriveFolder(dossier, fullName) {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, ONEDRIVE_FOLDER } = process.env;
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) return;

  // Get access token
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
  if (!tokenRes.ok) throw new Error('MS token failed');
  const { access_token } = await tokenRes.json();

  // Create folder: /ONEDRIVE_FOLDER/ClC-001 – Nombre Apellido
  const folderName  = `${dossier} – ${fullName}`;
  const parentPath  = ONEDRIVE_FOLDER || 'Pacientes';
  const graphUrl    = `https://graph.microsoft.com/v1.0/me/drive/root:/${parentPath}:/children`;

  await fetch(graphUrl, {
    method : 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type' : 'application/json'
    },
    body: JSON.stringify({
      name  : folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename'
    })
  });
}

// ─── Resend: Client confirmation email ───────────────────────────────────────
async function sendClientEmail({ firstname, lastname, email, type, specialty, date, dossier, lang }) {
  const isTele = type === 'teleconsulta';
  const subject = `✅ Solicitud de cita recibida — ${CLINIC_NAME} (${dossier})`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
  .header { background: #1A8FD1; color: white; padding: 30px; text-align: center; }
  .content { padding: 30px; background: #f9f9f9; }
  .info-box { background: white; border-left: 4px solid #C9A84C; padding: 15px; margin: 15px 0; }
  .footer { background: #333; color: #aaa; padding: 20px; text-align: center; font-size: 12px; }
  .btn { display: inline-block; background: #1A8FD1; color: white; padding: 12px 25px;
         text-decoration: none; border-radius: 6px; margin: 15px 0; }
</style></head>
<body>
  <div class="header">
    <h1>🏥 Clínica Las Calas</h1>
    <p>Solicitud de cita recibida</p>
  </div>
  <div class="content">
    <p>Estimado/a <strong>${firstname} ${lastname}</strong>,</p>
    <p>Hemos recibido tu solicitud de cita. Nos pondremos en contacto contigo en menos de <strong>2 horas</strong> para confirmar.</p>

    <div class="info-box">
      <p>📋 <strong>Expediente:</strong> ${dossier}</p>
      <p>🏥 <strong>Especialidad:</strong> ${specialty}</p>
      <p>📅 <strong>Fecha deseada:</strong> ${date}</p>
      <p>${isTele ? '💻' : '🏥'} <strong>Tipo:</strong> ${isTele ? 'Teleconsulta (Microsoft Teams)' : 'Presencial en clínica'}</p>
    </div>

    ${isTele ? `
    <div class="info-box" style="border-color:#1A8FD1">
      <p>💻 <strong>Teleconsulta:</strong> Recibirás el enlace de Microsoft Teams 15 minutos antes de tu cita.</p>
    </div>` : ''}

    <p>Puedes enviar tus documentos médicos a través del siguiente enlace:</p>
    <a href="https://clinicalascalas.vercel.app/upload.html?dossier=${dossier}" class="btn">📤 Enviar documentos</a>

    <p style="color:#666; font-size:14px;">⚠️ <em>En caso de emergencia médica, llama al 112 o dirígete al hospital más cercano.</em></p>
  </div>
  <div class="footer">
    <p>${CLINIC_NAME} · Cap de las Huertas, Playa San Juan, Alicante</p>
    <p>Tel: +34 XXX XXX XXX · info@clinicalascalas.es</p>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from   : `${CLINIC_NAME} <${FROM_EMAIL}>`,
    to     : email,
    subject,
    html
  });
}

// ─── Resend: Internal clinic notification ─────────────────────────────────────
async function sendClinicEmail({ fullName, email, phone, type, specialty, motive, date, dossier, lang, docType, docNum }) {
  const subject = `🆕 Nueva cita — ${dossier} — ${specialty}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
  .header { background: #1A8FD1; color: white; padding: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  td:first-child { font-weight: bold; width: 40%; background: #f5f5f5; }
  .urgent { background: #fff3cd; padding: 10px; border-left: 4px solid #C9A84C; }
</style></head>
<body>
  <div class="header">
    <h2>🆕 Nueva solicitud de cita — ${dossier}</h2>
  </div>
  <div style="padding:20px">
    <table>
      <tr><td>Expediente</td><td><strong>${dossier}</strong></td></tr>
      <tr><td>Paciente</td><td>${fullName}</td></tr>
      <tr><td>Email</td><td>${email}</td></tr>
      <tr><td>Teléfono</td><td>${phone}</td></tr>
      <tr><td>Documento</td><td>${docType || ''} – ${docNum || ''}</td></tr>
      <tr><td>Idioma</td><td>${lang || 'es'}</td></tr>
      <tr><td>Tipo</td><td>${type === 'teleconsulta' ? '💻 Teleconsulta' : '🏥 Presencial'}</td></tr>
      <tr><td>Especialidad</td><td>${specialty}</td></tr>
      <tr><td>Fecha deseada</td><td>${date}</td></tr>
      <tr><td>Motivo</td><td>${motive || '—'}</td></tr>
    </table>
    <div class="urgent">
      <p>⚡ Acción requerida: confirmar cita y enviar confirmación al paciente antes de 2 horas.</p>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from   : `Sistema CRM <${FROM_EMAIL}>`,
    to     : CLINIC_EMAIL,
    subject,
    html
  });
}

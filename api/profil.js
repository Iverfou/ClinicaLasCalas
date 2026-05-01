// api/profil.js — Clínica Las Calas
// Proxy → N8N_PROFIL_WEBHOOK
// Actions: verify (dossier+email), get (token+dossier), reply

// ── Helper: parse JSON body (Vercel ne parse pas automatiquement) ──────────
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

// ── Helper: normaliser la réponse N8N → champs plats attendus par profil.html
function mapPatient(raw) {
  // N8N peut retourner [{ fields }] ou { patient } ou objet plat
  const record = Array.isArray(raw) ? raw[0] : raw;
  const f = record?.fields || record?.patient || record || {};

  const firstName   = f['Prénom']      || f['firstName']   || f['nombre']   || '';
  const lastName    = f['Nom']         || f['lastName']    || f['apellido'] || '';
  const patientName = f['Nom Complet'] || f['patientName'] ||
                      `${firstName} ${lastName}`.trim()    || null;

  // docCount : tableau ou nombre brut
  const docsRaw = f['Documents reçus'] || f['docs_received'] || f['docs_sent'] || [];
  const docCount = typeof docsRaw === 'number' ? docsRaw
                 : Array.isArray(docsRaw)      ? docsRaw.length
                 : 0;

  // RDV counts
  const rdvHistory  = f['Historique RDV'] || f['rdv_history'] || [];
  const rdvList     = f['RDV']            || f['rdv']         || [];
  const rdvCount    = Array.isArray(rdvHistory) ? rdvHistory.length : 0;
  const rdvUpcoming = Array.isArray(rdvList)    ? rdvList.length    : 0;

  // Champs plats — noms exacts attendus par profil.html
  return {
    patientName,                                              // profilName, inputNombre
    lastName,                                                 // inputApellido
    patientEmail : f['Email']       || f['patientEmail'] || f['email'] || null,
    phone        : f['Téléphone']   || f['phone']        || f['tel']   || null,
    dossier      : f['Nº Client']   || f['dossier']      || null,
    lang         : (f['Langue']     || f['lang']         || 'es').trim(),
    dob          : f['Date de naissance'] || f['dob']    || null,
    docCount,
    rdvCount,
    rdvUpcoming,
    statut             : f['Statut']               || null,
    dateRdv            : f['Date Rdv']             || null,
    typeRdv            : f['Type RDV']             || null,
    medecin            : f['Medecin']              || null,
    specialite         : f['Specialite']           || null,
    motif              : f['Motif']                || null,
    docsAttendus       : f['Documents Attendus']   || null,
    datePremierContact : f['Date premier contact'] || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const n8nWebhook = process.env.N8N_PROFIL_WEBHOOK;

  // ── GET: charger profil par token ─────────────────────────────────────────
  if (req.method === 'GET') {
    const { token, dossier, lang } = req.query;

    if (!token && !dossier) {
      return res.status(400).json({ error: 'Missing token or dossier' });
    }

    if (!n8nWebhook) {
      return res.status(200).json({ patient: null, demo: true });
    }

    try {
      const r = await fetch(n8nWebhook, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ action: 'get', token, dossier, lang: lang || 'es' })
      });

      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        console.error('N8N GET error:', r.status, errText);
        return res.status(200).json({ error: 'invalid' });
      }

      const data = await r.json().catch(() => null);
      if (!data) return res.status(200).json({ error: 'invalid' });

      const patient = mapPatient(data);
      return res.status(200).json({ patient });

    } catch(e) {
      console.error('GET error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST actions ──────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const { action, dossier, email, token, lang, msgIndex, reply } = body;

    // ── LOAD: charger profil par dossier (lien clinique) ─────────────────
    if (action === 'load') {
      if (!dossier) {
        return res.status(400).json({ error: 'Missing dossier' });
      }

      if (!n8nWebhook) {
        return res.status(200).json({ patient: null, demo: true });
      }

      try {
        const r = await fetch(n8nWebhook, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ action: 'load', dossier })
        });

        if (!r.ok) {
          const errText = await r.text().catch(() => '');
          console.error('N8N load error:', r.status, errText);
          return res.status(200).json({ error: 'not_found' });
        }

        const data = await r.json().catch(() => null);
        if (!data) return res.status(200).json({ error: 'not_found' });

        // Si N8N retourne le nouveau format { patient, documents, rdv }
if (data.patient) {
  return res.status(200).json(data);
}
// Sinon ancien format flat
const patient = mapPatient(data);
if (!patient.dossier) return res.status(200).json({ error: 'not_found' });
return res.status(200).json(patient);

      } catch(e) {
        console.error('load error:', e.message);
        return res.status(500).json({ error: e.message });
      }
    }

    // ── VERIFY: vérifier dossier + email → retourner patient ─────────────
    if (action === 'verify') {
  if (!dossier || !email) {
    return res.status(400).json({ error: 'Missing dossier or email' });
  }

  if (!n8nWebhook) {
    return res.status(200).json({ valid: true, dossier, demo: true });
  }

  try {
    const r = await fetch(n8nWebhook, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ action: 'verify', dossier, email })
    });

    const data = await r.json().catch(() => null);
    
    // N8N retourne { valid: true/false, dossier: 'CLC-X' }
    if (data && data.valid && data.dossier) {
      return res.status(200).json({ valid: true, dossier: data.dossier });
    }
    
    return res.status(200).json({ valid: false });

  } catch(e) {
    console.error('verify error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
    // ── REPLY: répondre à un message ─────────────────────────────────────
    if (action === 'reply') {
      if (!reply || !dossier) {
        return res.status(400).json({ error: 'Missing reply or dossier' });
      }

      if (!n8nWebhook) {
        return res.status(200).json({ success: true, demo: true });
      }

      try {
        const r = await fetch(n8nWebhook, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({
            action,
            dossier,
            msgIndex,
            reply,
            lang     : lang || 'es',
            timestamp: new Date().toISOString()
          })
        });

        if (!r.ok) {
          const errText = await r.text().catch(() => '');
          console.error('N8N reply error:', r.status, errText);
          return res.status(500).json({ error: `N8N error ${r.status}`, detail: errText });
        }

        const data = await r.json().catch(() => ({}));
        return res.status(200).json({ success: true, ...data });

      } catch(e) {
        console.error('reply error:', e.message);
        return res.status(500).json({ error: e.message });
      }
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

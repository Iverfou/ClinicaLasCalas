// emails/templates.js — Clínica Las Calas
// Tous les templates email Resend pour le flux upload/action
// Utilisé par N8N via api/action.js ou directement

const SITE_URL = process.env.SITE_URL || 'https://clinica-las-calas.vercel.app';
const FROM     = process.env.RESEND_FROM || 'Clínica Las Calas <noreply@clinicalascalas.com>';
const REPLY_TO = process.env.REPLY_TO    || 'contacto@clinicalascalas.com';
const LOGO_URL = `${SITE_URL}/assets/logo.svg`;

// ── COULEURS ─────────────────────────────────────────
const C = {
  azul:    '#1A6B7C',
  azul2:   '#134F5C',
  success: '#1A9E6B',
  error:   '#C0392B',
  warn:    '#E67E22',
  arena:   '#F7F4EF',
  muted:   '#6B7F8C',
  border:  '#DDD8D0',
  white:   '#FFFFFF',
  ink:     '#1C2B33',
};

// ── BASE LAYOUT ───────────────────────────────────────
function layout(content, lang = 'es') {
  const footerTexts = {
    es: `Este email es un mensaje automático de Clínica Las Calas. No responda directamente a este email — para contactar con nosotros: <a href="mailto:${REPLY_TO}" style="color:${C.azul}">${REPLY_TO}</a>`,
    en: `This email is an automated message from Clínica Las Calas. Please do not reply directly — to contact us: <a href="mailto:${REPLY_TO}" style="color:${C.azul}">${REPLY_TO}</a>`,
    fr: `Cet email est un message automatique de la Clínica Las Calas. Ne répondez pas directement à cet email — pour nous contacter : <a href="mailto:${REPLY_TO}" style="color:${C.azul}">${REPLY_TO}</a>`,
  };
  const rgpd = {
    es: 'Sus datos son tratados conforme al RGPD. <a href="' + SITE_URL + '/mentions.html#privacy" style="color:' + C.muted + '">Política de privacidad</a>',
    en: 'Your data is processed in compliance with GDPR. <a href="' + SITE_URL + '/mentions.html#privacy" style="color:' + C.muted + '">Privacy policy</a>',
    fr: 'Vos données sont traitées conformément au RGPD. <a href="' + SITE_URL + '/mentions.html#privacy" style="color:' + C.muted + '">Politique de confidentialité</a>',
  };

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Clínica Las Calas</title>
</head>
<body style="margin:0;padding:0;background:${C.arena};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.arena};padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:${C.azul2};border-radius:12px 12px 0 0;padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <span style="font-family:Georgia,serif;font-size:1.2rem;font-weight:700;color:#fff;">Clínica Las Calas</span>
        <span style="display:block;font-size:0.65rem;color:rgba(255,255,255,.7);letter-spacing:.08em;text-transform:uppercase;margin-top:2px;">Cap de las Huertas · Alicante</span>
      </td>
      <td align="right">
        <span style="background:rgba(255,255,255,.15);border-radius:20px;padding:5px 12px;font-size:.72rem;color:#fff;font-weight:600;">🔒 Seguro</span>
      </td>
    </tr>
    </table>
  </td></tr>

  <!-- CONTENT -->
  <tr><td style="background:${C.white};padding:32px;border-left:1px solid ${C.border};border-right:1px solid ${C.border};">
    ${content}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f0ede8;border-radius:0 0 12px 12px;padding:20px 32px;border:1px solid ${C.border};border-top:none;">
    <p style="font-size:.72rem;color:${C.muted};line-height:1.6;margin:0 0 8px;">${footerTexts[lang] || footerTexts.es}</p>
    <p style="font-size:.68rem;color:#9aacb5;margin:0;">${rgpd[lang] || rgpd.es}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── HELPER: bouton CTA ────────────────────────────────
function ctaBtn(url, label, color = C.azul) {
  return `<table cellpadding="0" cellspacing="0" style="margin:20px 0;">
<tr><td style="background:${color};border-radius:9px;padding:0;">
  <a href="${url}" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-size:.9rem;font-weight:700;border-radius:9px;">${label}</a>
</td></tr></table>`;
}

// ── HELPER: ligne info ────────────────────────────────
function infoRow(key, val) {
  return `<tr>
    <td style="padding:8px 12px;font-size:.78rem;font-weight:700;color:${C.muted};background:#f7f4ef;border-radius:6px;white-space:nowrap;">${key}</td>
    <td style="padding:8px 12px;font-size:.83rem;color:${C.ink};">${val}</td>
  </tr>`;
}

// ── HELPER: badge statut ──────────────────────────────
function badge(label, color, bg) {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:10px;font-size:.72rem;font-weight:700;color:${color};background:${bg};">${label}</span>`;
}

// ═══════════════════════════════════════════════════════
// 1. EMAIL PATIENT — Confirmation upload reçu
// ═══════════════════════════════════════════════════════
export function emailUploadPatient({ patientName, dossier, docTypeLabel, fileName, analysisSummary, lang = 'es' }) {
  const T = {
    es: {
      subject: `Documento recibido — ${dossier}`,
      title: `Su documento ha sido recibido`,
      greeting: `Estimado/a ${patientName},`,
      body: `Hemos recibido correctamente su documento. Nuestro equipo médico lo revisará en breve y le notificaremos el resultado.`,
      dossier: 'Expediente', docType: 'Tipo', fileName: 'Archivo', status: 'Estado',
      statusVal: '📥 Recibido — En revisión',
      summaryLabel: 'Resumen del análisis automático',
      summaryNote: 'Este resumen es generado automáticamente por IA y no sustituye la revisión médica.',
      profilBtn: '👤 Ver mi expediente',
      note: 'Recibirá otro email cuando el médico haya revisado su documento.',
    },
    en: {
      subject: `Document received — ${dossier}`,
      title: `Your document has been received`,
      greeting: `Dear ${patientName},`,
      body: `We have successfully received your document. Our medical team will review it shortly and notify you of the result.`,
      dossier: 'File', docType: 'Type', fileName: 'File name', status: 'Status',
      statusVal: '📥 Received — Under review',
      summaryLabel: 'Automatic analysis summary',
      summaryNote: 'This summary is automatically generated by AI and does not replace medical review.',
      profilBtn: '👤 View my file',
      note: 'You will receive another email once the doctor has reviewed your document.',
    },
    fr: {
      subject: `Document reçu — ${dossier}`,
      title: `Votre document a bien été reçu`,
      greeting: `Cher/Chère ${patientName},`,
      body: `Nous avons bien reçu votre document. Notre équipe médicale le vérifiera dans les meilleurs délais et vous informera du résultat.`,
      dossier: 'Dossier', docType: 'Type', fileName: 'Fichier', status: 'Statut',
      statusVal: '📥 Reçu — En cours de vérification',
      summaryLabel: 'Résumé de l\'analyse automatique',
      summaryNote: 'Ce résumé est généré automatiquement par IA et ne remplace pas la vérification médicale.',
      profilBtn: '👤 Voir mon dossier',
      note: 'Vous recevrez un autre email dès que le médecin aura vérifié votre document.',
    }
  };
  const t = T[lang] || T.es;
  const profilUrl = `${SITE_URL}/profil.html?dossier=${encodeURIComponent(dossier)}&lang=${lang}`;

  const content = `
    <h2 style="font-family:Georgia,serif;font-size:1.3rem;color:${C.ink};margin:0 0 6px;">📎 ${t.title}</h2>
    <p style="font-size:.85rem;color:${C.muted};margin:0 0 24px;">${t.greeting}</p>
    <p style="font-size:.9rem;color:${C.ink};line-height:1.7;margin:0 0 20px;">${t.body}</p>

    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${C.border};border-radius:9px;overflow:hidden;margin-bottom:20px;">
    ${infoRow(t.dossier, `<strong>${dossier}</strong>`)}
    ${infoRow(t.docType, docTypeLabel)}
    ${infoRow(t.fileName, fileName)}
    ${infoRow(t.status, badge(t.statusVal, C.azul, C.teal2 || '#D6EEF2'))}
    </table>

    ${analysisSummary ? `
    <div style="background:#f0f9fb;border:1px solid #a8d5dc;border-radius:9px;padding:16px;margin-bottom:20px;">
      <div style="font-size:.75rem;font-weight:700;color:${C.azul};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">🔍 ${t.summaryLabel}</div>
      <div style="font-size:.85rem;color:${C.ink};line-height:1.6;font-style:italic;">${analysisSummary}</div>
      <div style="font-size:.68rem;color:${C.muted};margin-top:8px;">⚠️ ${t.summaryNote}</div>
    </div>` : ''}

    ${ctaBtn(profilUrl, t.profilBtn)}

    <p style="font-size:.78rem;color:${C.muted};line-height:1.6;margin:16px 0 0;padding:12px;background:#f7f4ef;border-radius:7px;">
      ℹ️ ${t.note}
    </p>`;

  return { subject: t.subject, html: layout(content, lang), from: FROM, replyTo: REPLY_TO };
}

// ═══════════════════════════════════════════════════════
// 2. EMAIL MÉDECIN — Nouveau document à valider
// ═══════════════════════════════════════════════════════
export function emailUploadMedecin({ patientName, dossier, docTypeLabel, fileName, analysis, actionToken, doctorEmail, lang = 'es' }) {
  const actionUrl = `${SITE_URL}/action.html?token=${actionToken}`;
  const airtableUrl = process.env.AIRTABLE_BASE_URL ? `${process.env.AIRTABLE_BASE_URL}/${dossier}` : '#';

  const confLabels = { alta:'Alta ✓', high:'High ✓', media:'Media ~', medium:'Medium ~', baja:'Baja ⚠', low:'Low ⚠' };
  const confColors = { alta: C.success, high: C.success, media: C.warn, medium: C.warn, baja: C.error, low: C.error };
  const conf = analysis?.confianza || 'media';

  let analysisRows = '';
  if (analysis?.tipo_detectado) analysisRows += infoRow('Tipo detectado', analysis.tipo_detectado);
  if (analysis?.datos) {
    Object.entries(analysis.datos).slice(0, 6).forEach(([k,v]) => {
      if (v && v !== 'null') analysisRows += infoRow(k, v);
    });
  }

  const content = `
    <div style="background:${C.azul};border-radius:9px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:.7rem;font-weight:700;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Nuevo documento para validar</div>
      <div style="font-family:Georgia,serif;font-size:1.2rem;color:#fff;">${patientName} — <span style="opacity:.8">${dossier}</span></div>
    </div>

    <p style="font-size:.9rem;color:${C.ink};line-height:1.7;margin:0 0 20px;">
      El paciente <strong>${patientName}</strong> ha enviado un documento de tipo <strong>${docTypeLabel}</strong> que requiere su revisión.
    </p>

    <h3 style="font-size:.78rem;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;">🔍 Análisis Claude Vision</h3>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${C.border};border-radius:9px;overflow:hidden;margin-bottom:8px;">
    ${analysisRows}
    ${infoRow('Archivo', fileName)}
    ${infoRow('Confianza IA', badge(confLabels[conf] || conf, confColors[conf] || C.muted, 'rgba(0,0,0,.06)'))}
    </table>

    ${analysis?.resumen_medico ? `
    <div style="background:#f0f9fb;border-left:3px solid ${C.azul};padding:12px 16px;margin-bottom:20px;border-radius:0 7px 7px 0;">
      <div style="font-size:.72rem;font-weight:700;color:${C.azul};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Resumen para el médico</div>
      <div style="font-size:.88rem;color:${C.ink};line-height:1.6;font-style:italic;">${analysis.resumen_medico}</div>
    </div>` : ''}

    <h3 style="font-size:.78rem;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;margin:20px 0 12px;">⚕️ Acción requerida</h3>
    <p style="font-size:.85rem;color:${C.muted};margin:0 0 16px;">Haga clic en el botón para validar, rechazar o solicitar un documento adicional. El paciente será notificado automáticamente en su idioma.</p>

    ${ctaBtn(actionUrl, '⚕️ Revisar y tomar acción →', C.azul)}

    <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:8px;">
    <tr>
      <td style="padding:4px;">
        <a href="${actionUrl}?action=valid" style="display:block;text-align:center;padding:10px;background:rgba(26,158,107,.1);border:1.5px solid ${C.success};border-radius:8px;color:${C.success};text-decoration:none;font-size:.8rem;font-weight:700;">✅ Validar</a>
      </td>
      <td style="padding:4px;">
        <a href="${actionUrl}?action=refus" style="display:block;text-align:center;padding:10px;background:rgba(192,57,43,.07);border:1.5px solid ${C.error};border-radius:8px;color:${C.error};text-decoration:none;font-size:.8rem;font-weight:700;">❌ Rechazar</a>
      </td>
      <td style="padding:4px;">
        <a href="${actionUrl}?action=supp" style="display:block;text-align:center;padding:10px;background:rgba(230,126,34,.07);border:1.5px solid ${C.warn};border-radius:8px;color:${C.warn};text-decoration:none;font-size:.8rem;font-weight:700;">📋 Doc. adicional</a>
      </td>
    </tr>
    </table>

    <p style="font-size:.72rem;color:${C.muted};margin-top:16px;text-align:center;">
      🔒 Enlace de acción único · Válido 7 días · <a href="${airtableUrl}" style="color:${C.azul}">Ver en Airtable →</a>
    </p>`;

  return {
    subject: `[CLC] Documento pendiente — ${patientName} (${dossier})`,
    html: layout(content, 'es'),
    from: FROM,
    to: doctorEmail,
    replyTo: REPLY_TO
  };
}

// ═══════════════════════════════════════════════════════
// 3. EMAIL PATIENT — Document validé ✅
// ═══════════════════════════════════════════════════════
export function emailValidationPatient({ patientName, dossier, docTypeLabel, analysisSummary, note, lang = 'es' }) {
  const T = {
    es: {
      subject: `✅ Documento validado — ${dossier}`,
      title: 'Su documento ha sido validado',
      greeting: `Estimado/a ${patientName},`,
      body: 'El equipo médico de la Clínica Las Calas ha revisado y validado su documento. Queda registrado en su expediente.',
      statusLabel: 'Estado', statusVal: '✅ Validado',
      noteLabel: 'Nota del médico',
      profilBtn: '👤 Ver mi expediente',
      rdvBtn: '📅 Reservar una cita',
      closing: 'Puede consultar todos sus documentos en su espacio personal.',
    },
    en: {
      subject: `✅ Document validated — ${dossier}`,
      title: 'Your document has been validated',
      greeting: `Dear ${patientName},`,
      body: 'The medical team at Clínica Las Calas has reviewed and validated your document. It has been recorded in your file.',
      statusLabel: 'Status', statusVal: '✅ Validated',
      noteLabel: 'Doctor\'s note',
      profilBtn: '👤 View my file',
      rdvBtn: '📅 Book an appointment',
      closing: 'You can view all your documents in your personal space.',
    },
    fr: {
      subject: `✅ Document validé — ${dossier}`,
      title: 'Votre document a été validé',
      greeting: `Cher/Chère ${patientName},`,
      body: 'L\'équipe médicale de la Clínica Las Calas a vérifié et validé votre document. Il est enregistré dans votre dossier.',
      statusLabel: 'Statut', statusVal: '✅ Validé',
      noteLabel: 'Note du médecin',
      profilBtn: '👤 Voir mon dossier',
      rdvBtn: '📅 Prendre rendez-vous',
      closing: 'Vous pouvez consulter tous vos documents dans votre espace personnel.',
    }
  };
  const t = T[lang] || T.es;
  const profilUrl = `${SITE_URL}/profil.html?dossier=${encodeURIComponent(dossier)}&lang=${lang}`;
  const rdvUrl = `${SITE_URL}/rdv.html?lang=${lang}`;

  const content = `
    <div style="background:linear-gradient(135deg,${C.success},#158a5c);border-radius:9px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:8px;">✅</div>
      <div style="font-family:Georgia,serif;font-size:1.2rem;color:#fff;">${t.title}</div>
    </div>

    <p style="font-size:.88rem;color:${C.muted};margin:0 0 6px;">${t.greeting}</p>
    <p style="font-size:.9rem;color:${C.ink};line-height:1.7;margin:0 0 20px;">${t.body}</p>

    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${C.border};border-radius:9px;overflow:hidden;margin-bottom:20px;">
    ${infoRow('Expediente / Dossier', `<strong>${dossier}</strong>`)}
    ${infoRow('Documento', docTypeLabel)}
    ${infoRow(t.statusLabel, badge(t.statusVal, C.success, 'rgba(26,158,107,.1)'))}
    </table>

    ${note ? `
    <div style="background:#f0f9fb;border-left:3px solid ${C.azul};padding:12px 16px;margin-bottom:20px;border-radius:0 7px 7px 0;">
      <div style="font-size:.72rem;font-weight:700;color:${C.azul};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">💬 ${t.noteLabel}</div>
      <div style="font-size:.88rem;color:${C.ink};line-height:1.6;">${note}</div>
    </div>` : ''}

    ${analysisSummary ? `
    <div style="background:#f7f4ef;border:1px solid ${C.border};border-radius:9px;padding:14px;margin-bottom:20px;">
      <div style="font-size:.72rem;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">🔍 Resumen del documento</div>
      <div style="font-size:.83rem;color:${C.ink};line-height:1.6;font-style:italic;">${analysisSummary}</div>
    </div>` : ''}

    ${ctaBtn(profilUrl, t.profilBtn)}

    <p style="font-size:.8rem;color:${C.muted};margin:16px 0 0;">${t.closing}
      <a href="${rdvUrl}" style="color:${C.azul};font-weight:700;">${t.rdvBtn} →</a>
    </p>`;

  return { subject: t.subject, html: layout(content, lang), from: FROM, replyTo: REPLY_TO };
}

// ═══════════════════════════════════════════════════════
// 4. EMAIL PATIENT — Document refusé ❌
// ═══════════════════════════════════════════════════════
export function emailRefusPatient({ patientName, dossier, docTypeLabel, reason, instruction, lang = 'es' }) {
  const T = {
    es: {
      subject: `❌ Documento no aceptado — ${dossier}`,
      title: 'Su documento no ha podido ser aceptado',
      greeting: `Estimado/a ${patientName},`,
      body: 'El equipo médico ha revisado su documento y lamentablemente no ha podido ser aceptado por la siguiente razón:',
      reasonLabel: 'Motivo del rechazo',
      instrLabel: 'Instrucciones para el reenvío',
      uploadBtn: '📎 Enviar nuevo documento',
      profilBtn: '👤 Ver mi expediente',
      help: '¿Necesita ayuda? Contáctenos en',
    },
    en: {
      subject: `❌ Document not accepted — ${dossier}`,
      title: 'Your document could not be accepted',
      greeting: `Dear ${patientName},`,
      body: 'The medical team has reviewed your document and unfortunately it could not be accepted for the following reason:',
      reasonLabel: 'Reason for rejection',
      instrLabel: 'Instructions for resubmission',
      uploadBtn: '📎 Upload new document',
      profilBtn: '👤 View my file',
      help: 'Need help? Contact us at',
    },
    fr: {
      subject: `❌ Document non accepté — ${dossier}`,
      title: 'Votre document n\'a pas pu être accepté',
      greeting: `Cher/Chère ${patientName},`,
      body: 'L\'équipe médicale a vérifié votre document et malheureusement il n\'a pas pu être accepté pour la raison suivante :',
      reasonLabel: 'Motif du refus',
      instrLabel: 'Instructions pour le renvoi',
      uploadBtn: '📎 Envoyer un nouveau document',
      profilBtn: '👤 Voir mon dossier',
      help: 'Besoin d\'aide ? Contactez-nous à',
    }
  };
  const t = T[lang] || T.es;
  const uploadUrl = `${SITE_URL}/upload.html?dossier=${encodeURIComponent(dossier)}&lang=${lang}`;
  const profilUrl = `${SITE_URL}/profil.html?dossier=${encodeURIComponent(dossier)}&lang=${lang}`;

  const content = `
    <div style="background:linear-gradient(135deg,${C.error},#a93226);border-radius:9px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:8px;">❌</div>
      <div style="font-family:Georgia,serif;font-size:1.2rem;color:#fff;">${t.title}</div>
    </div>

    <p style="font-size:.88rem;color:${C.muted};margin:0 0 6px;">${t.greeting}</p>
    <p style="font-size:.9rem;color:${C.ink};line-height:1.7;margin:0 0 20px;">${t.body}</p>

    <div style="background:rgba(192,57,43,.06);border:1.5px solid rgba(192,57,43,.25);border-radius:9px;padding:16px;margin-bottom:20px;">
      <div style="font-size:.72rem;font-weight:700;color:${C.error};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">⚠️ ${t.reasonLabel}</div>
      <div style="font-size:.88rem;color:${C.ink};line-height:1.6;">${reason}</div>
    </div>

    ${instruction ? `
    <div style="background:#f0f9fb;border-left:3px solid ${C.azul};padding:12px 16px;margin-bottom:20px;border-radius:0 7px 7px 0;">
      <div style="font-size:.72rem;font-weight:700;color:${C.azul};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">📋 ${t.instrLabel}</div>
      <div style="font-size:.88rem;color:${C.ink};line-height:1.6;">${instruction}</div>
    </div>` : ''}

    ${ctaBtn(uploadUrl, t.uploadBtn, C.azul)}

    <p style="font-size:.78rem;color:${C.muted};margin:16px 0 0;">
      ${t.help} <a href="mailto:${REPLY_TO}" style="color:${C.azul}">${REPLY_TO}</a> ·
      <a href="${profilUrl}" style="color:${C.azul}">${t.profilBtn}</a>
    </p>`;

  return { subject: t.subject, html: layout(content, lang), from: FROM, replyTo: REPLY_TO };
}

// ═══════════════════════════════════════════════════════
// 5. EMAIL PATIENT — Document supplémentaire demandé 📋
// ═══════════════════════════════════════════════════════
export function emailDocSupplementaire({ patientName, dossier, docRequested, deadline, lang = 'es' }) {
  const T = {
    es: {
      subject: `📋 Documento adicional solicitado — ${dossier}`,
      title: 'El médico solicita un documento adicional',
      greeting: `Estimado/a ${patientName},`,
      body: 'Para completar su expediente y preparar su consulta, el médico necesita el siguiente documento adicional:',
      docLabel: 'Documento solicitado',
      deadlineLabel: 'Plazo sugerido',
      uploadBtn: '📎 Enviar el documento',
      profilBtn: '👤 Ver mi expediente',
      help: '¿Preguntas? Contáctenos en',
    },
    en: {
      subject: `📋 Additional document requested — ${dossier}`,
      title: 'The doctor is requesting an additional document',
      greeting: `Dear ${patientName},`,
      body: 'To complete your file and prepare your consultation, the doctor needs the following additional document:',
      docLabel: 'Document requested',
      deadlineLabel: 'Suggested deadline',
      uploadBtn: '📎 Upload the document',
      profilBtn: '👤 View my file',
      help: 'Questions? Contact us at',
    },
    fr: {
      subject: `📋 Document supplémentaire demandé — ${dossier}`,
      title: 'Le médecin demande un document supplémentaire',
      greeting: `Cher/Chère ${patientName},`,
      body: 'Pour compléter votre dossier et préparer votre consultation, le médecin a besoin du document supplémentaire suivant :',
      docLabel: 'Document demandé',
      deadlineLabel: 'Délai suggéré',
      uploadBtn: '📎 Envoyer le document',
      profilBtn: '👤 Voir mon dossier',
      help: 'Des questions ? Contactez-nous à',
    }
  };
  const t = T[lang] || T.es;
  const uploadUrl = `${SITE_URL}/upload.html?dossier=${encodeURIComponent(dossier)}&lang=${lang}`;
  const profilUrl = `${SITE_URL}/profil.html?dossier=${encodeURIComponent(dossier)}&lang=${lang}`;

  const content = `
    <div style="background:linear-gradient(135deg,${C.warn},#ca6f1e);border-radius:9px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:8px;">📋</div>
      <div style="font-family:Georgia,serif;font-size:1.2rem;color:#fff;">${t.title}</div>
    </div>

    <p style="font-size:.88rem;color:${C.muted};margin:0 0 6px;">${t.greeting}</p>
    <p style="font-size:.9rem;color:${C.ink};line-height:1.7;margin:0 0 20px;">${t.body}</p>

    <div style="background:rgba(230,126,34,.07);border:1.5px solid rgba(230,126,34,.3);border-radius:9px;padding:16px;margin-bottom:20px;">
      <div style="font-size:.72rem;font-weight:700;color:${C.warn};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">📄 ${t.docLabel}</div>
      <div style="font-size:.9rem;color:${C.ink};line-height:1.6;font-weight:600;">${docRequested}</div>
      ${deadline ? `<div style="font-size:.78rem;color:${C.muted};margin-top:8px;">⏰ ${t.deadlineLabel} : <strong>${deadline}</strong></div>` : ''}
    </div>

    ${ctaBtn(uploadUrl, t.uploadBtn)}

    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${C.border};border-radius:9px;overflow:hidden;margin-bottom:16px;">
    ${infoRow('Expediente / Dossier', `<strong>${dossier}</strong>`)}
    ${infoRow('Lien / Enlace', `<a href="${uploadUrl}" style="color:${C.azul}">${uploadUrl}</a>`)}
    </table>

    <p style="font-size:.78rem;color:${C.muted};margin:0;">
      ${t.help} <a href="mailto:${REPLY_TO}" style="color:${C.azul}">${REPLY_TO}</a> ·
      <a href="${profilUrl}" style="color:${C.azul}">${t.profilBtn}</a>
    </p>`;

  return { subject: t.subject, html: layout(content, lang), from: FROM, replyTo: REPLY_TO };
}

// ── EXPORT all as named + default object ──────────────
export default {
  emailUploadPatient,
  emailUploadMedecin,
  emailValidationPatient,
  emailRefusPatient,
  emailDocSupplementaire
};

/**
 * api/chat.js — Clínica Las Calas
 * Claude API endpoint with medical system prompt
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres el asistente virtual de Clínica Las Calas, una clínica médica multiespecialidad ubicada en Alicante, España (Cap de las Huertas / Playa San Juan).

INFORMACIÓN DE LA CLÍNICA:
- Dirección: Cap de las Huertas, Playa San Juan, Alicante, España
- Teléfono: disponible en la web
- Horario: Lunes–Viernes 9:00–20:00, Sábado 9:00–14:00
- Email: info@clinicalascalas.es
- Idiomas: Español, Inglés, Francés, Árabe (DZ/MA/TN), Ruso, Ucraniano, Alemán, Italiano, Chino

ESPECIALIDADES:
- Medicina General (Dr. Carlos Herrera Montoya, Dr. Sophie Marchand, Dr. Olena Kovalenko, Dr. Amir Benali)
- Cardiología (Dr. Elena Vásquez Ruiz, Dr. Thomas Müller)
- Pediatría
- Dermatología
- Ginecología (Dra. Natalia Petrenko, Dra. Yasmine Cherif)
- Diabetología (Dr. Marco Ferretti, Dr. Lin Wei)
- Traumatología
- Medicina del viajero
- Teleconsulta por Microsoft Teams

SERVICIOS:
- Citas online (formulario web → confirmación por email en 2h)
- Teleconsulta Teams (enlace enviado 15 min antes)
- Subida segura de documentos médicos
- Expediente digital (prefijo ClC-001, ClC-002...)
- Aceptamos: efectivo, tarjeta (Visa, Mastercard, Amex), transferencia bancaria
- Trabajamos con las principales aseguradoras

REGLAS ESTRICTAS:
1. NUNCA hagas diagnósticos médicos ni interpretes síntomas de forma diagnóstica
2. NUNCA prescribas medicamentos ni dosificaciones
3. SIEMPRE redirige las consultas médicas específicas a una cita con el médico
4. Para emergencias, indica siempre: llama al 112
5. Sé amable, profesional y empático
6. Responde en el mismo idioma que el usuario
7. Mantén las respuestas concisas (máximo 3–4 párrafos)
8. Cuando alguien quiera una cita, envíalo a /rdv.html

DISCLAIMER OBLIGATORIO (incluir al inicio si el usuario pregunta síntomas):
"⚠️ Este asistente no realiza diagnósticos médicos. Para cualquier consulta médica, te recomendamos reservar una cita con nuestros especialistas."`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, sessionId, lang = 'es', history = [] } = req.body || {};

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (message.length > 1000) {
    return res.status(400).json({ error: 'Message too long' });
  }

  // Build messages array (last 10 exchanges)
  const messages = [];
  const recentHistory = history.slice(-10);
  for (const entry of recentHistory) {
    if (entry.role === 'user' || entry.role === 'assistant') {
      messages.push({ role: entry.role, content: String(entry.content).slice(0, 500) });
    }
  }
  messages.push({ role: 'user', content: message.trim() });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages
    });

    const reply = response.content[0]?.text || 'Lo siento, no pude procesar tu consulta.';
    return res.status(200).json({ reply, sessionId });

  } catch (err) {
    console.error('Claude API error:', err);
    return res.status(500).json({
      error: 'Service unavailable',
      reply: 'Lo siento, el asistente no está disponible en este momento. Por favor, llámanos o escríbenos por WhatsApp.'
    });
  }
}

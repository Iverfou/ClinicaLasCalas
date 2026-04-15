/**
 * chat.js — Clínica Las Calas
 * Floating chatbot widget: open/close, messages, quick buttons, API call
 */

// ─── Config ──────────────────────────────────────────────────────────────────
const CHAT_API_URL = '/api/chat';
const SESSION_KEY  = 'clc_chat_session';

// ─── State ───────────────────────────────────────────────────────────────────
let sessionId = localStorage.getItem(SESSION_KEY) || generateSessionId();
let isOpen    = false;
let isTyping  = false;
let history   = [];

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  localStorage.setItem(SESSION_KEY, sessionId);
  bindEvents();
  showWelcome();
});

// ─── Session ID ───────────────────────────────────────────────────────────────
function generateSessionId() {
  return 'clc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// ─── Event bindings ───────────────────────────────────────────────────────────
function bindEvents() {
  // Toggle button
  const fab = document.querySelector('.chat-fab');
  if (fab) fab.addEventListener('click', toggleChat);

  // Close button
  const closeBtn = document.querySelector('.chat-close');
  if (closeBtn) closeBtn.addEventListener('click', closeChat);

  // Send button
  const sendBtn = document.querySelector('.chat-send');
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);

  // Enter key
  const input = document.querySelector('.chat-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    input.addEventListener('input', () => {
      const sendBtn = document.querySelector('.chat-send');
      if (sendBtn) sendBtn.disabled = input.value.trim().length === 0;
    });
  }

  // Quick buttons
  document.querySelectorAll('.chat-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => handleQuickBtn(btn.dataset.action));
  });
}

// ─── Toggle / Open / Close ────────────────────────────────────────────────────
function toggleChat() {
  isOpen ? closeChat() : openChat();
}

function openChat() {
  isOpen = true;
  const chatWin = document.querySelector('.chat-window');
  const fab     = document.querySelector('.chat-fab');
  if (chatWin) chatWin.classList.remove('hidden');
  if (fab)     fab.classList.add('is-open');
  // Focus input
  setTimeout(() => {
    const input = document.querySelector('.chat-input');
    if (input) input.focus();
  }, 300);
}

function closeChat() {
  isOpen = false;
  const chatWin = document.querySelector('.chat-window');
  const fab     = document.querySelector('.chat-fab');
  if (chatWin) chatWin.classList.add('hidden');
  if (fab)     fab.classList.remove('is-open');
}

// ─── Welcome message ─────────────────────────────────────────────────────────
function showWelcome() {
  const lang = window.getCurrentLang ? window.getCurrentLang() : 'es';
  const welcome = window.t ? window.t('chat.welcome') : getDefaultWelcome();
  // Small delay so lang is loaded
  setTimeout(() => {
    if (document.querySelector('.chat-messages')?.children.length === 0) {
      appendMessage('bot', welcome);
    }
  }, 500);
}

function getDefaultWelcome() {
  return '¡Hola! Soy el asistente de Clínica Las Calas. ¿En qué puedo ayudarte?\n\n⚠️ Recuerda: no realizo diagnósticos médicos.';
}

// ─── Quick buttons ────────────────────────────────────────────────────────────
function handleQuickBtn(action) {
  const actions = {
    rdv:      () => { closeChat(); window.location.href = '/rdv.html'; },
    services: () => sendUserMessage(window.t('chat.quick.services') || '🩺 Servicios'),
    horario:  () => sendUserMessage(window.t('chat.quick.horario')  || '🕐 Horario'),
    price:    () => sendUserMessage(window.t('chat.quick.price')    || '💶 Precios')
  };
  if (actions[action]) actions[action]();
}

function sendUserMessage(text) {
  const input = document.querySelector('.chat-input');
  if (input) input.value = text;
  sendMessage();
}

// ─── Send message ─────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.querySelector('.chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text || isTyping) return;

  input.value = '';
  const sendBtn = document.querySelector('.chat-send');
  if (sendBtn) sendBtn.disabled = true;

  appendMessage('user', escapeHtml(text));
  history.push({ role: 'user', content: text });

  showTyping();
  isTyping = true;

  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        sessionId,
        lang: window.getCurrentLang ? window.getCurrentLang() : 'es',
        history: history.slice(-10)
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const reply = data.reply || data.message || 'Lo siento, ha habido un error.';

    hideTyping();
    appendMessage('bot', formatBotReply(reply));
    history.push({ role: 'assistant', content: reply });

    // Keep history manageable
    if (history.length > 20) history = history.slice(-20);

  } catch (err) {
    hideTyping();
    appendMessage('bot', '⚠️ Lo siento, ha habido un error. Por favor, inténtalo de nuevo o llámanos directamente.');
    console.error('Chat error:', err);
  }

  isTyping = false;
  if (sendBtn) sendBtn.disabled = false;
  input.focus();
}

// ─── Message rendering ────────────────────────────────────────────────────────
function appendMessage(role, content) {
  const container = document.querySelector('.chat-messages');
  if (!container) return;

  const msg = document.createElement('div');
  msg.className = `chat-message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.innerHTML = content;

  const time = document.createElement('span');
  time.className = 'chat-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  msg.appendChild(bubble);
  msg.appendChild(time);
  container.appendChild(msg);

  // Scroll to bottom
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

function formatBotReply(text) {
  // Convert newlines to <br>, URLs to links, and bold **text**
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function showTyping() {
  const container = document.querySelector('.chat-messages');
  if (!container) return;
  const indicator = document.createElement('div');
  indicator.className = 'chat-message bot typing-indicator';
  indicator.id = 'typing-indicator';
  indicator.innerHTML = `<div class="chat-bubble"><span></span><span></span><span></span></div>`;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

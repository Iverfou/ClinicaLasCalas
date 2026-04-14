/**
 * main.js — Clínica Las Calas
 * i18n engine · RTL · navbar · hamburger · AOS · FAQ accordion
 */

// ─── Config ────────────────────────────────────────────────────────────────
const SUPPORTED_LANGS = ['es','en','fr','ar-dz','ar-ma','ar-tn','ru','uk','de','it','zh'];
const RTL_LANGS       = ['ar-dz','ar-ma','ar-tn'];
const DEFAULT_LANG    = 'es';
const LOCALE_PATH     = '/locales/';

// ─── State ──────────────────────────────────────────────────────────────────
let currentLang = DEFAULT_LANG;
let translations = {};

// ─── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const saved = localStorage.getItem('clc_lang');
  const preferred = saved && SUPPORTED_LANGS.includes(saved) ? saved : detectBrowserLang();
  await setLang(preferred);
  initNavbar();
  initHamburger();
  initLangDropdown();
  initFAQ();
  initAOS();
  initWhatsApp();
  markActiveNav();
});

// ─── Language detection ──────────────────────────────────────────────────────
function detectBrowserLang() {
  const bl = (navigator.language || 'es').toLowerCase();
  if (bl.startsWith('ar')) return 'ar-dz';
  if (bl.startsWith('zh')) return 'zh';
  const base = bl.split('-')[0];
  return SUPPORTED_LANGS.includes(base) ? base : DEFAULT_LANG;
}

// ─── Load & apply language ───────────────────────────────────────────────────
async function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
  try {
    const res = await fetch(`${LOCALE_PATH}${lang}.json`);
    if (!res.ok) throw new Error();
    translations = await res.json();
  } catch {
    if (lang !== DEFAULT_LANG) {
      const res = await fetch(`${LOCALE_PATH}${DEFAULT_LANG}.json`);
      translations = await res.json();
      lang = DEFAULT_LANG;
    }
  }
  currentLang = lang;
  localStorage.setItem('clc_lang', lang);

  // RTL
  const isRTL = RTL_LANGS.includes(lang);
  document.documentElement.dir  = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;

  // Apply translations
  applyTranslations();
  updateLangSelector();
}

// ─── Apply data-i18n to DOM ──────────────────────────────────────────────────
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = translations[key];
    if (!val) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.innerHTML = val;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = translations[key];
    if (val) el.placeholder = val;
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const val = translations[key];
    if (val) el.title = val;
  });
}

// ─── Expose t() helper ───────────────────────────────────────────────────────
window.t = function(key, fallback = '') {
  return translations[key] || fallback;
};

window.setLang = setLang;
window.getCurrentLang = () => currentLang;

// ─── Update language selector UI ─────────────────────────────────────────────
function updateLangSelector() {
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.lang === currentLang);
  });
  const flags = {
    es:'🇪🇸', en:'🇬🇧', fr:'🇫🇷',
    'ar-dz':'🇩🇿','ar-ma':'🇲🇦','ar-tn':'🇹🇳',
    ru:'🇷🇺', uk:'🇺🇦', de:'🇩🇪', it:'🇮🇹', zh:'🇨🇳'
  };
  const labels = {
    es:'ES', en:'EN', fr:'FR',
    'ar-dz':'AR', 'ar-ma':'AR', 'ar-tn':'AR',
    ru:'RU', uk:'UK', de:'DE', it:'IT', zh:'ZH'
  };
  const labelEl = document.querySelector('#currentLang');
  if (labelEl) labelEl.textContent = labels[currentLang] || currentLang.toUpperCase();
}

// ─── Language dropdown ────────────────────────────────────────────────────────
function initLangDropdown() {
  const toggle   = document.querySelector('#langBtn') || document.querySelector('.lang-current');
  const dropdown = document.querySelector('#langDropdown') || document.querySelector('.lang-dropdown');
  if (!toggle || !dropdown) return;

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const open = dropdown.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.addEventListener('click', () => {
      setLang(opt.dataset.lang);
      dropdown.classList.remove('open');
    });
  });

  document.addEventListener('click', () => dropdown.classList.remove('open'));
}

// ─── Navbar scroll ────────────────────────────────────────────────────────────
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 50);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ─── Hamburger menu ───────────────────────────────────────────────────────────
function initHamburger() {
  const btn   = document.querySelector('.hamburger');
  const menu  = document.querySelector('.nav-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
    btn.classList.toggle('active', open);
  });

  // Close on nav link click
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      menu.classList.remove('open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', false);
    });
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
      btn.classList.remove('active');
    }
  });
}

// ─── Active nav link ──────────────────────────────────────────────────────────
function markActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = (link.getAttribute('href') || '').split('/').pop();
    link.classList.toggle('active', href === path || (path === '' && href === 'index.html'));
  });
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
function initFAQ() {
  // Category tabs
  document.querySelectorAll('.faq-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.faq-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.faq-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      const target = document.querySelector(`.faq-section[data-cat="${tab.dataset.cat}"]`);
      if (target) target.classList.add('active');
    });
  });

  // Accordion items
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Close all in the same section
      item.closest('.faq-section')?.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

// ─── AOS (Animate On Scroll) — lightweight internal ───────────────────────────
function initAOS() {
  const elements = document.querySelectorAll('[data-aos]');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('aos-animate');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => observer.observe(el));
}

// ─── WhatsApp FAB ─────────────────────────────────────────────────────────────
function initWhatsApp() {
  const fab = document.querySelector('.whatsapp-fab');
  if (!fab) return;
  // Show after 3 seconds
  setTimeout(() => fab.classList.add('visible'), 3000);
}

// ─── Smooth scroll for anchor links ──────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ─── Counter animation for stats ─────────────────────────────────────────────
function animateCounter(el) {
  const target = parseInt(el.dataset.target || el.textContent, 10);
  if (isNaN(target)) return;
  const duration = 1500;
  const step = target / (duration / 16);
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current).toLocaleString();
    if (current >= target) {
      el.textContent = target.toLocaleString() + (el.dataset.suffix || '');
      clearInterval(timer);
    }
  }, 16);
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('[data-target]').forEach(animateCounter);
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.hero-stats, .stats-grid').forEach(el => statsObserver.observe(el));

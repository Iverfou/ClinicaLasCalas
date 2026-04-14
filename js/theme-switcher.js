/**
 * theme-switcher.js — Sélecteur de thème visuel
 * 3 options : Méditerranée · Clinique Moderne · Premium Luxury
 */

const THEMES = [
  {
    id: 'a',
    name: 'Méditerranée',
    colors: ['#1A8FD1', '#C9A84C', '#FFFFFF'],
    desc: 'Bleu azur · Or'
  },
  {
    id: 'b',
    name: 'Clinique Moderne',
    colors: ['#0D9488', '#F59E0B', '#F8FAFC'],
    desc: 'Teal · Amber'
  },
  {
    id: 'c',
    name: 'Premium Luxury',
    colors: ['#1E3A5F', '#D4AF7A', '#FAF8F5'],
    desc: 'Marine · Champagne'
  }
];

export function initThemeSwitcher() {
  // Apply saved or default theme
  const saved = localStorage.getItem('clc_theme') || 'a';
  applyTheme(saved);

  // Build the panel
  const panel = document.createElement('div');
  panel.id = 'theme-switcher';

  panel.innerHTML = `
    <button class="ts-toggle" id="ts-toggle-btn" title="Choisir un thème">🎨</button>
    <div class="ts-label">🎨 Thème</div>
    ${THEMES.map(t => `
      <button class="ts-btn ${saved === t.id ? 'active' : ''}" data-theme="${t.id}">
        <div class="ts-preview">
          ${t.colors.map(c => `<div class="ts-color" style="background:${c};border:1px solid rgba(0,0,0,.08)"></div>`).join('')}
        </div>
        <span>${t.name}</span>
      </button>
    `).join('')}
    <button class="ts-confirm" id="ts-confirm">✓ Valider ce thème</button>
  `;

  document.body.appendChild(panel);

  // Toggle collapse
  let collapsed = false;
  document.getElementById('ts-toggle-btn').addEventListener('click', () => {
    collapsed = !collapsed;
    panel.classList.toggle('collapsed', collapsed);
  });

  // Theme selection
  panel.querySelectorAll('.ts-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      localStorage.setItem('clc_theme', theme);
      panel.querySelectorAll('.ts-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateConfirmButton(theme);
    });
  });

  // Confirm button
  updateConfirmButton(saved);
  document.getElementById('ts-confirm').addEventListener('click', () => {
    const theme = localStorage.getItem('clc_theme') || 'a';
    const themeObj = THEMES.find(t => t.id === theme);
    alert(`✅ Thème "${themeObj?.name}" sélectionné !\n\nCommuniquez ce choix pour finaliser le design.`);
  });
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'a') {
    delete html.dataset.theme;
  } else {
    html.dataset.theme = theme;
  }
}

function updateConfirmButton(theme) {
  const btn = document.getElementById('ts-confirm');
  if (!btn) return;
  const colors = { a: '#1A8FD1', b: '#0D9488', c: '#1E3A5F' };
  btn.style.background = colors[theme] || '#1A8FD1';
  const t = THEMES.find(x => x.id === theme);
  btn.textContent = `✓ "${t?.name}"`;
}

import { COLOR_SCHEMES } from './schemes.js';

const DEFAULT_SCHEME_ID = 'ruby-red';

/**
 * Resolve um esquema de cores a partir do ID com fallback seguro.
 * @param {string|null|undefined} id
 * @returns {import('./schemes.js').ColorScheme}
 */
export function resolveColorScheme(id) {
  if (!id) return getFallback();
  const scheme = COLOR_SCHEMES.find(s => s.id === id);
  return scheme || getFallback();
}

/**
 * Aplica o esquema de cores ao :root do documento e persiste no localStorage.
 * @param {import('./schemes.js').ColorScheme} scheme
 */
export function applyColorScheme(scheme) {
  if (!scheme) return;
  const root = document.documentElement;
  
  const tokens = {
    '--color-primary': scheme.primary,
    '--color-primary-hover': scheme.primaryHover,
    '--color-badge-main': scheme.badgeMain,
    '--color-badge-alt': scheme.badgeAlt,
    '--color-highlight': scheme.highlight,
    '--color-price': scheme.price,
    '--color-chip-bg': scheme.chipBg,
    '--color-chip-text': scheme.chipText,
    '--color-text-on-primary': scheme.textOnPrimary
  };

  // Aplica as variáveis CSS ao :root
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Salva no localStorage para carregamento imediato no head nas próximas visitas
  try {
    localStorage.setItem('imobimaster_theme_tokens', JSON.stringify(tokens));
    localStorage.setItem('imobimaster_theme_id', scheme.id);
  } catch (e) {
    console.warn('Falha ao salvar tema no localStorage', e);
  }
}

function getFallback() {
  return COLOR_SCHEMES.find(s => s.id === DEFAULT_SCHEME_ID) || COLOR_SCHEMES[0];
}

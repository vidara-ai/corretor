
import { supabase } from './supabase.js';
import { COLOR_SCHEMES } from './theme/schemes.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

/**
 * @typedef {import('./theme/schemes.js').ColorScheme} ColorScheme
 */

/** @type {string | null} */
let configuracaoId = null;
/** @type {string | null} */
let currentHeroBgUrl = null;
/** @type {File | null} */
let pendingFile = null;

async function persistColorScheme(schemeId) {
  if (!configuracaoId || !schemeId) return;

  try {
    const { error } = await supabase
      .from('configuracoes_site')
      .update({ color_scheme: schemeId })
      .eq('id', configuracaoId);

    if (error) throw error;
  } catch (err) {
    console.error('Erro ao persistir esquema:', err);
    alert('Erro ao salvar o esquema de cores.');
  }
}

function initColorSchemeSelect() {
  const select = document.getElementById('color_scheme_id');
  if (!select) return;

  select.innerHTML = COLOR_SCHEMES.map(s => 
    `<option value="${s.id}">${s.label}</option>`
  ).join('');

  select.addEventListener('change', async (e) => {
    const target = e.target;
    const schemeId = target.value;
    if (!schemeId) return;
    applyColorScheme(resolveColorScheme(schemeId));
    await persistColorScheme(schemeId);
  });
}

async function loadConfig() {
  try {
    initColorSchemeSelect();

    const { data, error } = await supabase
      .from('configuracoes_site')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      configuracaoId = data.id;

      document.getElementById('c-site-name').value = data.header_nome_site || '';
      document.getElementById('header_whatsapp').value = data.header_whatsapp || '';
      
      if (data.color_scheme) {
        document.getElementById('color_scheme_id').value = data.color_scheme;
        applyColorScheme(resolveColorScheme(data.color_scheme));
      }

      document.getElementById('c-hero-title').value = data.hero_titulo || '';
      document.getElementById('c-hero-subtitle').value = data.hero_subtitulo || '';

      // Footer Fields
      document.getElementById('footer_titulo').value = data.footer_titulo || '';
      document.getElementById('footer_bio').value = data.footer_bio || '';
      document.getElementById('footer_creci').value = data.footer_creci || '';
      document.getElementById('footer_telefone').value = data.footer_telefone || '';
      document.getElementById('footer_instagram').value = data.footer_instagram || '';
      document.getElementById('footer_tiktok').value = data.footer_tiktok || '';
      document.getElementById('footer_x').value = data.footer_x || '';
      document.getElementById('footer_linkedin').value = data.footer_linkedin || '';
      document.getElementById('c-footer-text').value = data.rodape_texto || '';

      currentHeroBgUrl = data.hero_bg_desktop_url;
    }
  } catch (err) {
    console.error('Falha ao carregar configurações:', err);
  }
}

document.getElementById('config-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!configuracaoId) return;

  const btn = document.getElementById('btn-save-config');
  const btnText = document.getElementById('btn-text');
  btn.disabled = true;
  btnText.innerText = 'Salvando...';

  try {
    const payload = {
      header_nome_site: document.getElementById('c-site-name').value,
      header_whatsapp: document.getElementById('header_whatsapp').value || null,
      color_scheme: document.getElementById('color_scheme_id').value,
      hero_titulo: document.getElementById('c-hero-title').value,
      hero_subtitulo: document.getElementById('c-hero-subtitle').value,
      
      // Footer Data
      footer_titulo: document.getElementById('footer_titulo').value || null,
      footer_bio: document.getElementById('footer_bio').value || null,
      footer_creci: document.getElementById('footer_creci').value || null,
      footer_telefone: document.getElementById('footer_telefone').value || null,
      footer_instagram: document.getElementById('footer_instagram').value || null,
      footer_tiktok: document.getElementById('footer_tiktok').value || null,
      footer_x: document.getElementById('footer_x').value || null,
      footer_linkedin: document.getElementById('footer_linkedin').value || null,
      
      rodape_texto: document.getElementById('c-footer-text').value,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('configuracoes_site')
      .update(payload)
      .eq('id', configuracaoId);

    if (error) throw error;
    alert('Configurações salvas com sucesso!');
  } catch (err) {
    console.error('Erro ao salvar:', err);
    alert('Falha ao salvar: ' + err.message);
  } finally {
    btn.disabled = false;
    btnText.innerText = 'Salvar Alterações';
  }
};

document.addEventListener('DOMContentLoaded', loadConfig);

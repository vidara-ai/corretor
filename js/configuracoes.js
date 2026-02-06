
import { supabase } from './supabase.js';
import { COLOR_SCHEMES } from './theme/schemes.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

/**
 * @typedef {import('./theme/schemes.js').ColorScheme} ColorScheme
 */

/** @type {string | null} */
let configuracaoId = null;

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

      // Footer Fields - Mapped to Database Columns
      document.getElementById('footer_titulo').value = data.footer_titulo || '';
      document.getElementById('footer_bio').value = data.footer_bio || '';
      document.getElementById('footer_creci').value = data.footer_creci || '';
      document.getElementById('footer_telefone').value = data.footer_telefone || '';
      
      // Novos campos do formulário
      document.getElementById('titulo_formulario_footer').value = data.titulo_formulario_footer || '';
      document.getElementById('subtitulo_formulario_footer').value = data.subtitulo_formulario_footer || '';

      document.getElementById('footer_instagram_url').value = data.footer_instagram_url || '';
      document.getElementById('footer_tiktok_url').value = data.footer_tiktok_url || '';
      document.getElementById('footer_x_url').value = data.footer_x_url || '';
      document.getElementById('footer_linkedin_url').value = data.footer_linkedin_url || '';
      document.getElementById('footer_copyright').value = data.footer_copyright || data.rodape_texto || '';
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
      
      // Footer Columns mapping
      footer_titulo: document.getElementById('footer_titulo').value || null,
      footer_bio: document.getElementById('footer_bio').value || null,
      footer_creci: document.getElementById('footer_creci').value || null,
      footer_telefone: document.getElementById('footer_telefone').value || null,

      // Novos campos do formulário do footer
      titulo_formulario_footer: document.getElementById('titulo_formulario_footer').value || null,
      subtitulo_formulario_footer: document.getElementById('subtitulo_formulario_footer').value || null,

      footer_instagram_url: document.getElementById('footer_instagram_url').value || null,
      footer_tiktok_url: document.getElementById('footer_tiktok_url').value || null,
      footer_x_url: document.getElementById('footer_x_url').value || null,
      footer_linkedin_url: document.getElementById('footer_linkedin_url').value || null,
      footer_copyright: document.getElementById('footer_copyright').value || null,
      
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

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

/**
 * Persiste apenas o esquema de cores no Supabase de forma imediata.
 * @param {string} schemeId 
 */
async function persistColorScheme(schemeId) {
  if (!configuracaoId || !schemeId) return;

  try {
    const { error } = await supabase
      .from('configuracoes_site')
      .update({ color_scheme: schemeId })
      .eq('id', configuracaoId);

    if (error) throw error;
    console.debug(`Esquema '${schemeId}' persistido com sucesso.`);
  } catch (err) {
    console.error('Erro ao persistir esquema:', err);
    alert('Erro ao salvar o esquema de cores.');
  }
}

/**
 * Inicializa o select de esquemas de cores.
 */
function initColorSchemeSelect() {
  const select = document.getElementById('color_scheme_id');
  if (!select) return;

  // Popula opções dinamicamente a partir de COLOR_SCHEMES
  select.innerHTML = COLOR_SCHEMES.map(s => 
    `<option value="${s.id}">${s.label}</option>`
  ).join('');

  // Salvamento imediato ao alterar o select
  select.addEventListener('change', async (e) => {
    const target = e.target;
    const schemeId = target.value;
    if (!schemeId) return;

    // Feedback visual instantâneo aplicando o tema ao painel admin
    applyColorScheme(resolveColorScheme(schemeId));
    
    // Persistência no banco (Coluna color_scheme)
    await persistColorScheme(schemeId);
  });
}

/**
 * Carrega as configurações globais do Supabase.
 */
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

      // Cabeçalho
      document.getElementById('c-site-name').value = data.header_nome_site || '';
      document.getElementById('header_whatsapp').value = data.header_whatsapp || '';
      
      // Carregamento inicial do Esquema de Cores (Coluna: color_scheme)
      if (data.color_scheme) {
        document.getElementById('color_scheme_id').value = data.color_scheme;
        applyColorScheme(resolveColorScheme(data.color_scheme));
      }

      // Hero
      document.getElementById('c-hero-title').value = data.hero_titulo || '';
      document.getElementById('c-hero-subtitle').value = data.hero_subtitulo || '';
      document.getElementById('c-hero-cta-text').value = data.hero_cta_texto || '';
      document.getElementById('c-hero-cta-link').value = data.hero_cta_link || '';

      // Seções e Rodapé
      document.getElementById('home_titulo_oportunidades').value = data.home_titulo_oportunidades || '';
      document.getElementById('home_subtitulo_oportunidades').value = data.home_subtitulo_oportunidades || '';
      document.getElementById('imovel_cta_texto').value = data.imovel_cta_texto || '';
      document.getElementById('imovel_cta_whatsapp').value = data.imovel_cta_whatsapp || '';
      document.getElementById('c-footer-text').value = data.rodape_texto || '';

      // Imagem Hero
      currentHeroBgUrl = data.hero_bg_desktop_url;
      updateHeroPreview(currentHeroBgUrl);
    }
  } catch (err) {
    console.error('Falha ao carregar configurações:', err);
  }
}

/**
 * Atualiza o preview da imagem hero no painel.
 * @param {string | null} url 
 */
function updateHeroPreview(url) {
  const container = document.getElementById('hero-image-preview-container');
  const img = document.getElementById('hero-image-preview');
  if (url && (url.startsWith('http') || url.startsWith('data:'))) {
    img.src = url;
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

/**
 * Upload de imagem para o bucket assets do Supabase.
 * @param {File} file 
 */
async function uploadHeroImage(file) {
  const ext = file.name.split('.').pop();
  const filePath = `hero/bg-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('assets').upload(filePath, file);
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('assets').getPublicUrl(filePath);
  return data.publicUrl;
}

// Configuração do Dropzone de Imagem para a Hero
const dropzone = document.getElementById('hero-bg-dropzone');
const fileInput = document.getElementById('c-hero-bg-file');

if (dropzone) dropzone.onclick = () => fileInput.click();
if (fileInput) {
  fileInput.onchange = (e) => {
    const target = e.target;
    const file = target.files ? target.files[0] : null;
    if (!file) return;
    pendingFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target ? ev.target.result : null;
      if (typeof result === 'string') updateHeroPreview(result);
    };
    reader.readAsDataURL(file);
  };
}

// Handler do envio do formulário completo
document.getElementById('config-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!configuracaoId) return;

  const btn = document.getElementById('btn-save-config');
  const btnText = document.getElementById('btn-text');
  btn.disabled = true;
  btnText.innerText = 'Salvando...';

  try {
    let finalHeroUrl = currentHeroBgUrl;
    if (pendingFile) finalHeroUrl = await uploadHeroImage(pendingFile);

    const payload = {
      header_nome_site: document.getElementById('c-site-name').value,
      header_whatsapp: document.getElementById('header_whatsapp').value || null,
      color_scheme: document.getElementById('color_scheme_id').value, // Uso correto da coluna color_scheme
      hero_titulo: document.getElementById('c-hero-title').value,
      hero_subtitulo: document.getElementById('c-hero-subtitle').value,
      hero_cta_texto: document.getElementById('c-hero-cta-text').value,
      hero_cta_link: document.getElementById('c-hero-cta-link').value,
      hero_bg_desktop_url: finalHeroUrl,
      home_titulo_oportunidades: document.getElementById('home_titulo_oportunidades').value,
      home_subtitulo_oportunidades: document.getElementById('home_subtitulo_oportunidades').value,
      imovel_cta_texto: document.getElementById('imovel_cta_texto').value,
      imovel_cta_whatsapp: document.getElementById('imovel_cta_whatsapp').value,
      rodape_texto: document.getElementById('c-footer-text').value,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('configuracoes_site')
      .update(payload)
      .eq('id', configuracaoId);

    if (error) throw error;

    pendingFile = null;
    currentHeroBgUrl = finalHeroUrl;
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
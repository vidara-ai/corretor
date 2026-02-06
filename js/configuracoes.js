import { supabase } from './supabase.js';
import { COLOR_SCHEMES } from './theme/schemes.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

/**
 * @typedef {import('./theme/schemes.js').ColorScheme} ColorScheme
 */

/** @type {string | null} */
let configuracaoId = null;

/** @type {File | null} */
let pendingHeroImage = null;

/**
 * Converte imagem para WebP no client-side com hardening.
 */
async function convertToWebP(file) {
  if (file.type === 'image/webp') return file;
  if (!file.type.startsWith('image/')) throw new Error('Arquivo inválido. Apenas imagens são permitidas.');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          // Limpeza de memória do Canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = canvas.height = 0;

          if (!blob) return reject(new Error('Erro ao converter imagem.'));
          
          const fileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
          resolve(new File([blob], fileName, { type: 'image/webp' }));
        }, 'image/webp', 0.8);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

function setupHeroUpload() {
    const input = document.getElementById('hero-image-input');
    const previewImg = document.getElementById('hero-preview-img');
    const placeholder = document.getElementById('hero-preview-placeholder');

    if (!input) return;

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione uma imagem válida.');
            return;
        }

        pendingHeroImage = file;

        // Preview local
        const reader = new FileReader();
        reader.onload = (event) => {
            previewImg.src = event.target.result;
            previewImg.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    });
}

async function loadConfig() {
  try {
    initColorSchemeSelect();
    setupHeroUpload();

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

      // Hero Image Preview
      if (data.hero_bg_desktop_url) {
          const previewImg = document.getElementById('hero-preview-img');
          const placeholder = document.getElementById('hero-preview-placeholder');
          if (previewImg) {
              previewImg.src = data.hero_bg_desktop_url;
              previewImg.classList.remove('hidden');
              placeholder.classList.add('hidden');
          }
      }

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

    // Processamento de Imagem da Hero (se houver alteração)
    if (pendingHeroImage) {
        const webpFile = await convertToWebP(pendingHeroImage);
        const baseUuid = crypto.randomUUID();
        
        // Caminhos Storage
        const originalPath = `assets/hero_raw_${baseUuid}.${pendingHeroImage.name.split('.').pop()}`;
        const webpPath = `assets/hero_${baseUuid}.webp`;

        // Upload Original
        await supabase.storage.from('imoveis').upload(originalPath, pendingHeroImage, { upsert: false, contentType: pendingHeroImage.type });
        
        // Upload WebP
        await supabase.storage.from('imoveis').upload(webpPath, webpFile, { upsert: false, contentType: 'image/webp' });

        const { data: urlData } = supabase.storage.from('imoveis').getPublicUrl(webpPath);
        payload.hero_bg_desktop_url = urlData.publicUrl;
    }

    const { error } = await supabase
      .from('configuracoes_site')
      .update(payload)
      .eq('id', configuracaoId);

    if (error) throw error;
    
    pendingHeroImage = null; // Reseta após sucesso
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
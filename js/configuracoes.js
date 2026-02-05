import { supabase } from './supabase.js';
import { COLOR_SCHEMES } from './theme/schemes.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

/**
 * Estado Local
 */
let currentHeroBgUrl = null;
let pendingFile = null;
let configuracaoId = null;

/**
 * Popula o select de esquemas de cores
 */
function populateColorSchemeSelect() {
    const select = document.getElementById('color_scheme_id');
    if (!select) return;

    select.innerHTML = COLOR_SCHEMES.map(scheme => 
        `<option value="${scheme.id}">${scheme.label}</option>`
    ).join('');

    // Listener para aplicação imediata
    select.addEventListener('change', (e) => {
        const scheme = resolveColorScheme(e.target.value);
        applyColorScheme(scheme);
    });
}

/**
 * Carrega as configurações atuais do banco
 */
async function loadConfig() {
    try {
        populateColorSchemeSelect();

        const { data, error } = await supabase
            .from('configuracoes_site')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Erro ao buscar configurações:', error);
            return;
        }

        if (data) {
            configuracaoId = data.id;

            // Preenche campos de Identidade
            document.getElementById('c-site-name').value = data.header_nome_site || '';
            document.getElementById('header_whatsapp').value = data.header_whatsapp || '';
            
            // Esquema de Cores
            if (data.color_scheme_id) {
                document.getElementById('color_scheme_id').value = data.color_scheme_id;
                const scheme = resolveColorScheme(data.color_scheme_id);
                applyColorScheme(scheme);
            }

            // Preenche campos de Hero
            document.getElementById('c-hero-title').value = data.hero_titulo || '';
            document.getElementById('c-hero-subtitle').value = data.hero_subtitulo || '';
            document.getElementById('c-hero-cta-text').value = data.hero_cta_texto || '';
            document.getElementById('c-hero-cta-link').value = data.hero_cta_link || '';

            // Preenche campos de Oportunidades
            document.getElementById('home_titulo_oportunidades').value = data.home_titulo_oportunidades || '';
            document.getElementById('home_subtitulo_oportunidades').value = data.home_subtitulo_oportunidades || '';

            // Preenche campos de CTA Imóvel
            document.getElementById('imovel_cta_texto').value = data.imovel_cta_texto || '';
            document.getElementById('imovel_cta_whatsapp').value = data.imovel_cta_whatsapp || '';

            // Preenche campos de Rodapé
            document.getElementById('c-footer-text').value = data.rodape_texto || '';

            // Preview da Imagem
            currentHeroBgUrl = data.hero_bg_desktop_url;
            updateHeroPreview(currentHeroBgUrl);
        }

    } catch (err) {
        console.error('Erro crítico ao carregar configurações:', err);
    }
}

/**
 * Atualiza o preview da imagem no formulário
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
 * Lógica de Upload de Asset para o Supabase Storage
 */
async function uploadHeroImage(file) {
    const ext = file.name.split('.').pop();
    const fileName = `hero-desktop-${Date.now()}.${ext}`;
    const filePath = `hero/${fileName}`;

    const { error: uploadError } = await supabase
        .storage
        .from('assets')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase
        .storage
        .from('assets')
        .getPublicUrl(filePath);

    return data.publicUrl;
}

const dropzone = document.getElementById('hero-bg-dropzone');
const fileInput = document.getElementById('c-hero-bg-file');

if (dropzone) dropzone.onclick = () => fileInput.click();
if (fileInput) {
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        pendingFile = file;
        const reader = new FileReader();
        reader.onload = (event) => updateHeroPreview(event.target.result);
        reader.readAsDataURL(file);
    };
}

document.getElementById('config-form').onsubmit = async (e) => {
    e.preventDefault();

    if (!configuracaoId) {
        alert('Erro: ID de configuração não localizado.');
        return;
    }

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
            color_scheme_id: document.getElementById('color_scheme_id').value,
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
        alert('✅ Configurações salvas!');
    } catch (err) {
        console.error('Erro ao salvar:', err);
        alert('❌ Erro: ' + err.message);
    } finally {
        btn.disabled = false;
        btnText.innerText = 'Salvar Alterações';
    }
};

document.addEventListener('DOMContentLoaded', loadConfig);

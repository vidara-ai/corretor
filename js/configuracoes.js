import { supabase } from './supabase.js';

/**
 * Carrega as configurações atuais do banco
 */
async function loadConfig() {
    try {
        // Buscamos o registro de ID 1 (Singleton)
        const { data, error } = await supabase
            .from('configuracoes_site')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('Configuração não encontrada:', error.message);
            return;
        }

        // Preenche o formulário
        document.getElementById('c-site-name').value = data.titulo_header || '';
        document.getElementById('c-contact-email').value = data.email_contato || '';
        document.getElementById('c-hero-title').value = data.hero_titulo || '';
        document.getElementById('c-hero-subtitle').value = data.hero_subtitulo || '';
        document.getElementById('c-hero-image').value = data.hero_imagem_url || '';
        document.getElementById('c-footer-text').value = data.rodape_texto || '';

        updateHeroPreview(data.hero_imagem_url);
    } catch (err) {
        console.error('Erro ao carregar configurações:', err);
    }
}

/**
 * Atualiza o preview da imagem do hero no formulário
 */
function updateHeroPreview(url) {
    const previewContainer = document.getElementById('hero-preview');
    const img = previewContainer.querySelector('img');
    if (url && url.startsWith('http')) {
        img.src = url;
        img.classList.remove('hidden');
    } else {
        img.classList.add('hidden');
    }
}

// Escuta mudanças na URL da imagem para atualizar o preview
document.getElementById('c-hero-image').addEventListener('input', (e) => {
    updateHeroPreview(e.target.value);
});

/**
 * Salva as alterações
 */
document.getElementById('config-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-config');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = 'Salvando...';
    btn.disabled = true;

    const payload = {
        titulo_header: document.getElementById('c-site-name').value,
        email_contato: document.getElementById('c-contact-email').value,
        hero_titulo: document.getElementById('c-hero-title').value,
        hero_subtitulo: document.getElementById('c-hero-subtitle').value,
        hero_imagem_url: document.getElementById('c-hero-image').value,
        rodape_texto: document.getElementById('c-footer-text').value,
        updated_at: new Date()
    };

    try {
        const { error } = await supabase
            .from('configuracoes_site')
            .update(payload)
            .eq('id', 1);

        if (error) throw error;

        alert('Configurações atualizadas com sucesso!');
    } catch (err) {
        alert('Erro ao salvar: ' + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// Inicializa
document.addEventListener('DOMContentLoaded', loadConfig);
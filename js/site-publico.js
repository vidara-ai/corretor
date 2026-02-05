import { supabase } from './supabase.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

// Estado global para a galeria da página de detalhes
let currentPhotos = [];
let currentIndex = 0;

/**
 * Lógica de Tema (Dark/Light Mode)
 */
function initTheme() {
    const toggle = document.getElementById("theme-toggle");
    const body = document.body;
    if (!toggle) return;
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) body.setAttribute("data-theme", savedTheme);
    toggle.addEventListener("click", () => {
        const currentTheme = body.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        body.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    });
}

function formatarBRL(valor) {
    if (!valor || valor === 0) return 'Sob consulta';
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function obterValorImovel(imovel) {
    if (imovel.finalidade === 'Aluguel' || imovel.finalidade === 'aluguel') return imovel.valor_locacao;
    return imovel.valor_venda;
}

/**
 * Liberação Visual Imediata (Render Gate Global)
 */
function unlockUI() {
    if (typeof window.releaseRenderGate === 'function') {
        window.releaseRenderGate();
    }
}

/**
 * Inicialização do Site
 */
function initSite() {
    // 1. LIBERAÇÃO DA ESTRUTURA GLOBAL (Garante que o body seja visível)
    document.documentElement.removeAttribute('data-ui-locked');

    // Suporte para transição de estados de loading/content (conforme imovel.html)
    const loader = document.getElementById('loading-container');
    const content = document.getElementById('content-container');
    if (loader) loader.style.display = 'none';
    if (content) content.style.display = 'block';

    initTheme();

    // 2. CARREGAMENTO EM BACKGROUND
    startDataLoading();
}

/**
 * Processamento assíncrono em background
 */
async function startDataLoading() {
    try {
        const { data: config, error: configError } = await supabase
            .from('configuracoes_site')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (configError) {
            console.warn('Falha ao carregar configurações:', configError.message);
            removeHeroShells();
        } else if (config) {
            applySiteSettings(config);
        } else {
            removeHeroShells();
        }
    } catch (err) {
        console.warn('Erro ao processar configurações:', err);
        removeHeroShells();
    }

    const isDetailPage = window.location.pathname.includes('imovel.html');
    if (!isDetailPage) {
        loadHomeProperties();
    }
}

/**
 * Remove os atributos de shell e limpa classes CSS de shell
 */
function removeHeroShells() {
    document.querySelectorAll('[data-shell]').forEach(el => {
        el.removeAttribute('data-shell');
        el.classList.remove('shell-title', 'shell-subtitle');
    });
}

function applySiteSettings(config) {
    // Aplica o tema
    if (config.color_scheme) {
        const scheme = resolveColorScheme(config.color_scheme);
        applyColorScheme(scheme);
    }

    const logoText = document.getElementById('site-logo-text');
    if (logoText) logoText.innerText = config.header_nome_site || 'ImobiMaster';
    
    // HIDRATAÇÃO DO HERO
    const heroTitle = document.querySelector('header h1');
    if (heroTitle) heroTitle.innerText = config.hero_titulo || 'Encontre o imóvel que combina com sua vida';

    const heroSub = document.querySelector('header p');
    if (heroSub) heroSub.innerText = config.hero_subtitulo || 'Os melhores imóveis em localizações exclusivas com consultoria especializada.';

    // Hidratação da Busca
    const searchContainer = document.querySelector('.hero-search-container');
    if (searchContainer) {
        searchContainer.innerHTML = `
            <input type="text" placeholder="Bairro, cidade ou condomínio..." class="flex-1 px-6 py-4 text-slate-900 outline-none rounded-xl">
            <button class="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-bold transition-all active:scale-95">
                ${config.hero_cta_texto || 'Buscar Agora'}
            </button>
        `;
        searchContainer.classList.remove('shell-search');
    }

    const heroSection = document.querySelector('header.hero-home');
    if (heroSection) {
        if (config.hero_bg_desktop_url) heroSection.style.setProperty('--hero-bg-desktop', `url('${config.hero_bg_desktop_url}')`);
        if (config.hero_bg_mobile_url) heroSection.style.setProperty('--hero-bg-mobile', `url('${config.hero_bg_mobile_url}')`);
    }

    // REMOVER SHELLS
    removeHeroShells();

    const sectionTitle = document.querySelector('#regular-section h2');
    if (sectionTitle && config.home_titulo_oportunidades) sectionTitle.innerText = config.home_titulo_oportunidades;

    const sectionSub = document.querySelector('#regular-section p');
    if (sectionSub && config.home_subtitulo_oportunidades) sectionSub.innerText = config.home_subtitulo_oportunidades;

    const footerText = document.getElementById('footer-copyright-text');
    if (footerText) footerText.innerText = config.rodape_texto || '© ImobiMaster';

    const headerCta = document.getElementById('header-cta-contato');
    if (headerCta) {
        if (config.header_whatsapp) {
            const msg = "Olá, quero receber um contato para sanar algumas dúvidas.";
            const num = config.header_whatsapp.replace(/\D/g, '');
            headerCta.href = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
            headerCta.target = "_blank";
            headerCta.classList.remove('hidden');
        } else {
            headerCta.classList.add('hidden');
        }
    }
}

async function loadHomeProperties() {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;
    try {
        const { data: imoveis, error: imoveisError } = await supabase
          .from('imoveis')
          .select('*')
          .eq('ativo', true)
          .order('destaque', { ascending: false })
          .order('ordem_destaque', { ascending: true, nullsLast: true })
          .order('created_at', { ascending: false });

        if (imoveisError) {
          container.innerHTML = `<p class="col-span-full text-center text-red-500 py-10">Erro: ${imoveisError.message}</p>`;
          return;
        }

        const { data: fotos } = await supabase.from('imoveis_fotos').select('*').eq('is_capa', true);
        const imoveisComFoto = imoveis.map(imovel => {
          const fotoCapa = (fotos || []).find(f => f.imovel_id === imovel.id);
          return { ...imovel, foto_url: fotoCapa ? fotoCapa.url : null };
        });

        if (imoveisComFoto.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-slate-400 py-10">Nenhum imóvel disponível.</p>';
            return;
        }

        container.innerHTML = imoveisComFoto.map(imovel => {
            const precoFormatado = formatarBRL(obterValorImovel(imovel));
            const imagem = imovel.foto_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
            const badgeDestaque = imovel.destaque ? `<div class="badge-destaque">DESTAQUE</div>` : '';
            return `
                <div class="card-imovel" data-id="${imovel.id}">
                    <div class="card-imagem">
                        <img src="${imagem}" alt="${imovel.titulo}">
                        <span class="badge-tipo">${imovel.tipo_imovel || 'Imóvel'}</span>
                        <span class="badge-local">${imovel.cidade}</span>
                        ${badgeDestaque}
                    </div>
                    <div class="card-imovel-body imovel-card-content">
                        <span class="imovel-bairro">${imovel.bairro}</span>
                        <h3 class="imovel-titulo text-center lg:text-left font-bold">${imovel.titulo}</h3>
                        <div class="divisor-card"></div>
                        <div class="preco text-center">
                            <div class="imovel-finalidade text-xs opacity-70">${imovel.finalidade || 'Venda'}</div>
                            <strong>${precoFormatado}</strong>
                        </div>
                        <div class="divisor-card"></div>
                        <div class="imovel-info">
                            <div class="info-icons imovel-info-icons flex justify-center gap-6">
                                <span>🛏 ${imovel.dormitorios || 0}</span>
                                <span>🛁 ${imovel.banheiros || 0}</span>
                                <span>🚗 ${imovel.vagas_garagem || 0}</span>
                            </div>
                            <div class="divisor-card"></div>
                            <div class="imovel-ref-area text-xs opacity-60 text-center">
                                Ref: ${imovel.referencia || 'N/I'} — Área: ${imovel.area_m2 || 0} m²
                            </div>
                        </div>
                        <button class="btn-detalhar w-full mt-4 py-3 font-bold uppercase text-xs">Detalhar</button>
                    </div>
                </div>
            `;
        }).join('');
        setupCardEventListeners();
    } catch (err) {
        console.error('Erro crítico no site público:', err);
    }
}

function setupCardEventListeners() {
    document.querySelectorAll('.card-imovel').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            if (id) window.location.href = `imovel.html?id=${id}`;
        });
    });
}

// EXECUÇÃO IMEDIATA
initSite();
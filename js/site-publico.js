
import { supabase } from './supabase.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

// Estado global para as configurações do site
let siteConfig = null;

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
 * PARSER INTELIGENTE DE BUSCA
 */
function parseSearchQuery(text) {
    const raw = text.toLowerCase().trim();
    if (!raw) return null;

    const filters = {
        referencia: null,
        finalidade: null,
        tipo_imovel: null,
        tokens: []
    };

    const refMatch = raw.match(/([a-z]{1,}-?\d+)/i);
    if (refMatch) {
        filters.referencia = refMatch[0].toUpperCase();
    }

    const words = raw.split(/\s+/);
    const keywordsFinalidade = {
        'Aluguel': ['aluguel', 'alugar', 'locação', 'locacao'],
        'Venda': ['venda', 'vender', 'comprar', 'compra']
    };

    const keywordsTipo = {
        'Casa': ['casa', 'casas'],
        'Apartamento': ['apartamento', 'apto', 'aptos'],
        'Terreno': ['terreno', 'lote'],
        'Comercial': ['comercial', 'sala', 'galpão']
    };

    words.forEach(word => {
        if (filters.referencia && word.toUpperCase() === filters.referencia) return;
        let isKeyword = false;
        for (const [key, aliases] of Object.entries(keywordsFinalidade)) {
            if (aliases.includes(word)) { filters.finalidade = key; isKeyword = true; break; }
        }
        if (!isKeyword) {
            for (const [key, aliases] of Object.entries(keywordsTipo)) {
                if (aliases.includes(word)) { filters.tipo_imovel = key; isKeyword = true; break; }
            }
        }
        if (!isKeyword && word.length >= 2) {
            filters.tokens.push(word);
        }
    });

    return filters;
}

async function initSite() {
    initTheme();
    try {
        const { data: config } = await supabase.from('configuracoes_site').select('*').limit(1).maybeSingle();
        if (config) {
            siteConfig = config;
            applySiteSettings(config);
        }
    } catch (err) { console.error('Config Error:', err); }

    const isDetailPage = window.location.pathname.includes('imovel.html');
    if (!isDetailPage) loadProperties(); 
}

function injectSearchIntoHero() {
    const heroSection = document.querySelector('header.hero-home');
    if (!heroSection) return;
    const contentWrapper = heroSection.querySelector('.hero-content') || heroSection.querySelector('div');
    if (!contentWrapper || heroSection.querySelector('.js-search-form-injected')) return;

    const subtitle = contentWrapper.querySelector('p');
    const form = document.createElement('form');
    form.className = 'js-search-form-injected mt-8 flex flex-col md:flex-row gap-3 w-full max-w-2xl mx-auto';
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const searchText = input.value.trim();
        const filters = parseSearchQuery(searchText);
        const resultsSection = document.getElementById('regular-section');
        if (resultsSection) resultsSection.scrollIntoView({ behavior: 'smooth' });
        loadProperties(filters);
    };

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Ex: Casa venda Bessa ou CS-001';
    input.className = 'flex-1 px-6 py-4 rounded-xl text-slate-900 bg-white border-none shadow-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium';

    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = (siteConfig && siteConfig.hero_cta_texto) ? siteConfig.hero_cta_texto : 'Buscar';
    button.className = 'bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-bold transition-all shadow-xl active:scale-95 text-lg';

    form.appendChild(input);
    form.appendChild(button);
    if (subtitle) subtitle.insertAdjacentElement('afterend', form);
}

function applySiteSettings(config) {
    if (config.color_scheme) applyColorScheme(resolveColorScheme(config.color_scheme));
    
    // 1. Restaurar Logo e Textos
    const logoText = document.getElementById('site-logo-text');
    if (logoText) logoText.innerText = config.header_nome_site || 'ImobiMaster';
    
    // 2. CORREÇÃO: Restaurar Botão CTA do Header
    const headerCta = document.getElementById('header-cta-contato');
    if (headerCta && config.header_whatsapp) {
        headerCta.classList.remove('hidden');
        const waLink = `https://wa.me/${config.header_whatsapp.replace(/\D/g, '')}`;
        headerCta.href = waLink;
        headerCta.textContent = 'Entre em contato';
    }

    const heroTitle = document.querySelector('header h1');
    if (heroTitle && config.hero_titulo) heroTitle.innerText = config.hero_titulo;
    
    const heroSub = document.querySelector('header p');
    if (heroSub && config.hero_subtitulo) heroSub.innerText = config.hero_subtitulo;

    const footerText = document.getElementById('footer-copyright-text');
    if (footerText) footerText.innerText = config.rodape_texto || '© ImobiMaster';

    // WhatsApp Floating Button
    const waButton = document.getElementById('wa-button');
    if (waButton && config.header_whatsapp) {
        waButton.href = `https://wa.me/${config.header_whatsapp.replace(/\D/g, '')}`;
    }

    const heroSection = document.querySelector('header.hero-home');
    if (heroSection && config.hero_bg_desktop_url) {
        heroSection.style.setProperty('--hero-bg-desktop', `url('${config.hero_bg_desktop_url}')`);
    }
}

/**
 * CARGA DE IMÓVEIS (Restauração de Referência e Área)
 */
async function loadProperties(filters = null) {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;

    container.innerHTML = '<div class="col-span-full py-20 text-center animate-pulse text-slate-400">Buscando imóveis...</div>';

    try {
        // Garantir que todos os campos necessários sejam selecionados
        let query = supabase.from('imoveis').select('*').eq('ativo', true);

        if (filters) {
            if (filters.referencia) query = query.ilike('referencia', `%${filters.referencia}%`);
            if (filters.finalidade) query = query.ilike('finalidade', filters.finalidade);
            if (filters.tipo_imovel) query = query.ilike('tipo_imovel', filters.tipo_imovel);

            if (filters.tokens.length > 0) {
                filters.tokens.forEach(token => {
                    const searchFields = ['titulo', 'bairro', 'cidade', 'uf'];
                    const orStr = searchFields.map(field => `${field}.ilike.%${token}%`).join(',');
                    query = query.or(orStr);
                });
            }
        }

        const { data: imoveis, error } = await query
            .order('destaque', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!imoveis || imoveis.length === 0) {
            container.innerHTML = `<div class="col-span-full py-20 text-center"><p class="text-slate-500">Nenhum imóvel encontrado.</p></div>`;
            return;
        }

        const { data: fotos } = await supabase.from('imoveis_fotos').select('*').eq('is_capa', true);
        
        container.innerHTML = imoveis.map(imovel => {
            const foto = (fotos || []).find(f => f.imovel_id === imovel.id);
            const imagem = foto ? foto.url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
            const preco = formatarBRL(obterValorImovel(imovel));
            
            return `
                <div class="card-imovel animate-in fade-in slide-in-from-bottom-4 duration-500" data-id="${imovel.id}">
                    <div class="card-imagem">
                        <img src="${imagem}" alt="${imovel.titulo}" loading="lazy">
                        <span class="badge-tipo">${imovel.tipo_imovel || 'Imóvel'}</span>
                        <span class="badge-local">${imovel.cidade} / ${imovel.uf || ''}</span>
                        ${imovel.destaque ? '<div class="badge-destaque">DESTAQUE</div>' : ''}
                    </div>
                    <div class="card-imovel-body">
                        <span class="imovel-bairro">${imovel.bairro}</span>
                        <h3 class="imovel-titulo font-bold">${imovel.titulo}</h3>
                        
                        <!-- RESTAURAÇÃO DE REFERÊNCIA E ÁREA -->
                        <div class="imovel-ref-area text-xs font-bold text-slate-400 text-center mt-3">
                            REF: ${imovel.referencia || 'N/I'} — ${imovel.area_m2 || 0}M²
                        </div>
                        
                        <div class="divisor-card"></div>
                        <div class="preco text-center">
                            <div class="imovel-finalidade text-xs opacity-70">${imovel.finalidade || 'Venda'}</div>
                            <strong>${preco}</strong>
                        </div>
                        <div class="divisor-card"></div>
                        <div class="imovel-info-icons flex justify-center gap-6 text-sm">
                            <span>🛏 ${imovel.dormitorios || 0}</span>
                            <span>🛁 ${imovel.banheiros || 0}</span>
                            <span>🚗 ${imovel.vagas_garagem || 0}</span>
                        </div>
                        <button class="btn-detalhar w-full mt-6 py-3 font-bold uppercase text-xs">Ver Detalhes</button>
                    </div>
                </div>`;
        }).join('');

        document.querySelectorAll('.card-imovel').forEach(card => {
            card.onclick = () => window.location.href = `imovel.html?id=${card.dataset.id}`;
        });

    } catch (err) {
        console.error("Render Error:", err);
        container.innerHTML = `<p class="col-span-full text-center text-red-500 py-10">Erro ao carregar dados.</p>`;
    }
}

initSite();

window.addEventListener('load', () => {
  injectSearchIntoHero();
  const boot = document.getElementById('boot-screen');
  if (boot) {
    document.body.classList.add('ready');
    boot.remove();
  }
});

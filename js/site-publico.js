
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
 * PARSER INTELIGENTE DE BUSCA (Versão Estável)
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

    // Regex para referências (Ex: CS-001, CS001, C-001)
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
        'Comercial': ['comercial', 'sala']
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
        if (!isKeyword && word.length > 1) {
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
        console.log("🔍 Iniciando busca por:", searchText);
        const filters = parseSearchQuery(searchText);
        const resultsSection = document.getElementById('regular-section');
        if (resultsSection) resultsSection.scrollIntoView({ behavior: 'smooth' });
        loadProperties(filters);
    };

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Referência (CS-001) ou Localização...';
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
    const logoText = document.getElementById('site-logo-text');
    if (logoText) logoText.innerText = config.header_nome_site || 'ImobiMaster';
    const heroTitle = document.querySelector('header h1');
    if (heroTitle && config.hero_titulo) heroTitle.innerText = config.hero_titulo;
    const heroSub = document.querySelector('header p');
    if (heroSub && config.hero_subtitulo) heroSub.innerText = config.hero_subtitulo;
    const footerText = document.getElementById('footer-copyright-text');
    if (footerText) footerText.innerText = config.rodape_texto || '© ImobiMaster';
    const heroSection = document.querySelector('header.hero-home');
    if (heroSection) {
        if (config.hero_bg_desktop_url) heroSection.style.setProperty('--hero-bg-desktop', `url('${config.hero_bg_desktop_url}')`);
    }
}

/**
 * CARGA DE IMÓVEIS (Correção para Incidentes de Busca Vazia)
 */
async function loadProperties(filters = null) {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;

    container.innerHTML = '<div class="col-span-full py-20 text-center animate-pulse text-slate-400">Processando consulta...</div>';

    try {
        // QUERY BUILDER
        let query = supabase.from('imoveis').select('*').eq('ativo', true);

        if (filters) {
            console.log("🛠 Filtros processados:", filters);

            // 1. Busca por Referência (CS-001) - ILIKE para ignorar case
            if (filters.referencia) {
                query = query.ilike('referencia', `%${filters.referencia}%`);
            }

            // 2. Filtros Fixos
            if (filters.finalidade) query = query.ilike('finalidade', filters.finalidade);
            if (filters.tipo_imovel) query = query.ilike('tipo_imovel', filters.tipo_imovel);

            // 3. Busca de Texto Livre (Tokens)
            if (filters.tokens.length > 0) {
                filters.tokens.forEach(token => {
                    // Nota: Apenas colunas garantidas na tabela imoveis.
                    // Se a coluna 'descricao' não existir, a query falhará com 400.
                    const searchFields = ['titulo', 'bairro', 'cidade', 'estado'];
                    const orStr = searchFields.map(field => `${field}.ilike.%${token}%`).join(',');
                    query = query.or(orStr);
                });
            }
        }

        // EXECUÇÃO COM DEBUG DE STATUS
        const startTime = performance.now();
        const { data: imoveis, error, status } = await query
            .order('destaque', { ascending: false })
            .order('created_at', { ascending: false });
        const endTime = performance.now();

        console.debug(`⏱ Consulta concluída em ${(endTime - startTime).toFixed(2)}ms. Status: ${status}`);

        if (error) {
            console.error("❌ Erro Supabase:", error.message, error.details);
            throw error;
        }

        // DIAGNÓSTICO DE RLS: Se data é [], status é 200 e filtros eram nulos, RLS SELECT está bloqueado.
        if (imoveis.length === 0 && !filters) {
            console.warn("⚠️ RLS ALERTA: Nenhum dado retornado na carga inicial. Verifique as Políticas de SELECT no Supabase.");
        }

        if (!imoveis || imoveis.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <p class="text-slate-500 text-lg">Nenhum resultado para esta busca.</p>
                    <button onclick="window.location.reload()" class="mt-4 text-blue-600 font-bold hover:underline">Ver todos os imóveis</button>
                </div>`;
            return;
        }

        // BUSCA FOTOS DE CAPA
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
                        <span class="badge-local">${imovel.cidade}</span>
                        ${imovel.destaque ? '<div class="badge-destaque">DESTAQUE</div>' : ''}
                    </div>
                    <div class="card-imovel-body">
                        <span class="imovel-bairro">${imovel.bairro}</span>
                        <h3 class="imovel-titulo font-bold">${imovel.titulo}</h3>
                        <div class="divisor-card"></div>
                        <div class="preco text-center">
                            <div class="imovel-finalidade text-xs opacity-70">${imovel.finalidade}</div>
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
        console.error("Critical Render Error:", err);
        container.innerHTML = `<p class="col-span-full text-center text-red-500 py-10">Erro ao carregar dados. Tente novamente.</p>`;
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

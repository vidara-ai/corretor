
import { supabase } from './supabase.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

let siteConfig = null;
let currentFinalidade = 'Aluguel'; // Padrão inicial
let allImoveisCache = [];
let allFotosCache = [];
let currentSearchFilters = null;

function initTheme() {
    const body = document.body;
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) body.setAttribute("data-theme", savedTheme);
}

function formatarBRL(valor) {
    if (!valor || valor === 0) return 'Sob consulta';
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function obterValorImovel(imovel) {
    // Normalização para comparar ignorando case
    const fin = (imovel.finalidade || '').toLowerCase();
    if (fin === 'aluguel') return imovel.valor_locacao;
    return imovel.valor_venda;
}

function renderCardList(imoveis, fotos) {
    if (imoveis.length === 0) {
        return `<div class="col-span-full py-20 text-center text-slate-400 font-medium bg-white rounded-[2.5rem] border border-dashed border-slate-200">Nenhum imóvel encontrado nesta categoria.</div>`;
    }

    return imoveis.map(imovel => {
        const foto = (fotos || []).find(f => f.imovel_id === imovel.id);
        const imagem = foto ? foto.url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
        const preco = formatarBRL(obterValorImovel(imovel));
        const finalidade = imovel.finalidade || 'Venda';
        const referencia = imovel.referencia || `#${imovel.id.toString().slice(-4)}`;
        
        const partesLocal = [];
        if (imovel.bairro) partesLocal.push(imovel.bairro);
        
        let cidadeUf = "";
        if (imovel.cidade) cidadeUf += imovel.cidade;
        if (imovel.uf) cidadeUf += (cidadeUf ? '/' : '') + imovel.uf;
        
        if (cidadeUf) partesLocal.push(cidadeUf);
        const localizacao = partesLocal.join(', ') || 'Localização não informada';

        return `
            <div class="card-imovel group bg-white border border-slate-100 rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:-translate-y-3 transition-all duration-500 ease-out overflow-hidden flex flex-col h-full cursor-pointer" data-id="${imovel.id}">
                <div class="relative h-[250px] overflow-hidden shrink-0">
                    <img src="${imagem}" alt="${imovel.titulo}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    <div class="absolute top-5 left-5 flex flex-col gap-2 z-10">
                        <span class="bg-white/95 backdrop-blur text-slate-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                            ${imovel.tipo_imovel || 'Imóvel'}
                        </span>
                    </div>
                    <span class="absolute top-5 right-5 bg-slate-900/80 backdrop-blur text-white px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-widest uppercase z-10 border border-white/20">
                        REF: ${referencia}
                    </span>
                </div>

                <div class="p-8 flex flex-col flex-grow">
                    <div class="mb-5">
                        <span class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block truncate">${localizacao}</span>
                        <h3 class="text-xl font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 h-14">${imovel.titulo}</h3>
                    </div>

                    <div class="grid grid-cols-2 gap-y-3 gap-x-2 border-t border-slate-100 pt-5 pb-5">
                        <div class="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase tracking-tight">
                            <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                            ${imovel.area_m2 || 0} m²
                        </div>
                        <div class="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase tracking-tight">
                            <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                            ${imovel.dormitorios || 0} Qts
                        </div>
                    </div>

                    <div class="border-t border-slate-100 py-5 mt-auto">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">${finalidade}</p>
                        <p class="text-3xl font-black text-blue-600 tracking-tighter">${preco}</p>
                    </div>
                </div>
            </div>`;
    }).join('');
}

/**
 * FILTRO DE FINALIDADE (TOGGLE ARRASTÁVEL)
 */
function initFinalidadeToggle() {
    const container = document.getElementById('toggle-filter-wrapper');
    if (!container) return;

    container.innerHTML = `
        <div class="finalidade-toggle-container" id="finalidade-toggle" data-state="${currentFinalidade}">
            <div class="finalidade-toggle-track">
                <div class="finalidade-toggle-thumb" id="toggle-thumb"></div>
                <div class="finalidade-toggle-label label-venda">Venda</div>
                <div class="finalidade-toggle-label label-aluguel">Aluguel</div>
            </div>
        </div>
    `;

    const toggle = document.getElementById('finalidade-toggle');
    const thumb = document.getElementById('toggle-thumb');

    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const width = toggle.offsetWidth;

    const updateUI = (state) => {
        currentFinalidade = state;
        toggle.setAttribute('data-state', state);
        applyFiltersLocally();
    };

    // Eventos de Clique
    toggle.addEventListener('click', (e) => {
        if (isDragging) return;
        const newState = currentFinalidade === 'Venda' ? 'Aluguel' : 'Venda';
        updateUI(newState);
    });

    // Lógica de Arrastar (Swipe)
    const onStart = (e) => {
        startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
        isDragging = true;
        thumb.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        const x = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
        const walk = x - startX;
        
        // Limita o movimento visual
        let offset = currentFinalidade === 'Venda' ? walk : (width / 2) + walk;
        offset = Math.max(0, Math.min(offset, width / 2));
        
        thumb.style.transform = `translateX(${offset}px)`;
        currentX = walk;
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        thumb.style.transition = '';
        
        // Threshold: 30px de movimento ou 50% da largura
        if (Math.abs(currentX) > 20) {
            const newState = currentX > 0 ? 'Aluguel' : 'Venda';
            updateUI(newState);
        } else {
            // Volta para o estado original se o arraste foi curto
            thumb.style.transform = '';
        }
        
        // Delay curto para evitar que o clique dispare logo após o drag
        setTimeout(() => isDragging = false, 50);
    };

    toggle.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    toggle.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
}

/**
 * APLICA FILTROS LOCALMENTE (Instantâneo)
 */
function applyFiltersLocally() {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;

    // Filtra o cache local
    const filtered = allImoveisCache.filter(imovel => {
        const fin = (imovel.finalidade || '').toLowerCase();
        return fin === currentFinalidade.toLowerCase();
    });

    container.innerHTML = renderCardList(filtered, allFotosCache);
    
    // Reatribui eventos de clique nos cards
    document.querySelectorAll('.card-imovel').forEach(card => {
        card.onclick = () => window.location.href = `imovel.html?id=${card.dataset.id}`;
    });

    // Atualiza o contador ou subtítulo da seção
    const sectionTitle = document.querySelector('#regular-section h2');
    const sectionSub = document.querySelector('#regular-section p');
    if (sectionTitle) sectionTitle.innerText = `Imóveis para ${currentFinalidade}`;
    if (sectionSub) sectionSub.innerText = `${filtered.length} imóveis disponíveis agora`;
}

function mascaraTelefone(valor) {
    if (!valor) return "";
    valor = valor.replace(/\D/g, "");
    valor = valor.replace(/^(\d{2})(\d)/g, "($1) $2");
    valor = valor.replace(/(\d)(\d{4})$/, "$1-$2");
    return valor;
}

function setupLeadModal() {
    const modal = document.getElementById('lead-modal');
    const content = document.getElementById('lead-modal-content');
    const closeBtn = document.getElementById('close-lead-modal');
    const form = document.getElementById('lead-capture-form');

    if (!modal || !content || !form) return;

    const alreadySent = localStorage.getItem('imobi_lead_sent');
    const alreadyShown = localStorage.getItem('imobi_lead_modal_shown');
    if (alreadySent || alreadyShown) return;

    let opened = false;
    const openModal = () => {
        if (opened) return;
        opened = true;
        localStorage.setItem('imobi_lead_modal_shown', 'true');
        modal.classList.remove('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-90', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
        document.removeEventListener('click', interactionTrigger);
        window.removeEventListener('scroll', interactionTrigger);
    };

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-90', 'opacity-0');
    };

    const interactionTrigger = () => openModal();
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    document.addEventListener('click', interactionTrigger);
    window.addEventListener('scroll', interactionTrigger, { passive: true });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const fields = document.getElementById('lead-form-fields');
        const success = document.getElementById('lead-success-msg');
        const nome = document.getElementById('lead-nome').value;
        const telefone = document.getElementById('lead-telefone').value;

        btn.disabled = true;
        btn.innerText = "Enviando...";

        try {
            const { error } = await supabase.from('leads').insert({
                nome, telefone, origem: 'pagina', imovel_interesse: 'Interesse Geral', created_at: new Date().toISOString()
            });
            if (error) throw error;
            if (fields) fields.classList.add('hidden');
            if (success) success.classList.remove('hidden');
            localStorage.setItem('imobi_lead_sent', 'true');
        } catch (err) {
            btn.disabled = false;
            btn.innerText = "Quero Atendimento";
        }
    });
}

function parseSearchQuery(text) {
    const raw = text.toLowerCase().trim();
    if (!raw) return null;
    const filters = { referencia: null, finalidade: null, tipo_imovel: null, tokens: [] };
    const refMatch = raw.match(/([a-z]{1,}-?\d+)/i);
    if (refMatch) filters.referencia = refMatch[0].toUpperCase();
    const words = raw.split(/\s+/);
    words.forEach(word => {
        if (filters.referencia && word.toUpperCase() === filters.referencia) return;
        filters.tokens.push(word);
    });
    return filters;
}

async function loadProperties(filters = null) {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;
    
    currentSearchFilters = filters;

    try {
        let query = supabase.from('imoveis').select('*').eq('ativo', true);
        
        if (filters) {
            if (filters.referencia) query = query.ilike('referencia', `%${filters.referencia}%`);
            if (filters.tipo_imovel) query = query.ilike('tipo_imovel', filters.tipo_imovel);
            // Tokens de busca (título, bairro, cidade)
            if (filters.tokens.length > 0) {
                const search = filters.tokens.join(' ');
                query = query.or(`titulo.ilike.%${search}%,bairro.ilike.%${search}%,cidade.ilike.%${search}%`);
            }
        }

        const { data: imoveis, error } = await query.order('destaque', { ascending: false }).order('created_at', { ascending: false });
        if (error) throw error;

        const { data: fotos } = await supabase.from('imoveis_fotos').select('*').eq('is_capa', true);
        
        // Cacheia os resultados globais para o filtro instantâneo
        allImoveisCache = imoveis || [];
        allFotosCache = fotos || [];

        // Aplica o filtro da finalidade atual
        applyFiltersLocally();

    } catch (err) {
        container.innerHTML = `<p class="col-span-full text-center text-red-500 py-10 font-bold">Erro ao carregar catálogo.</p>`;
    }
}

function applySiteSettings(config) {
    if (config.color_scheme) applyColorScheme(resolveColorScheme(config.color_scheme));
    
    document.getElementById('site-logo-text').innerText = config.header_nome_site || 'ImobiMaster';
    document.getElementById('footer-logo-text-bottom').innerText = config.footer_titulo || config.header_nome_site || 'ImobiMaster';
    document.getElementById('footer-bio-text').innerText = config.footer_bio || 'Especialistas em encontrar o lar dos seus sonhos.';
    document.getElementById('footer-creci-text').innerText = config.footer_creci || '';
    document.getElementById('footer-phone-display').innerText = config.footer_telefone || config.header_whatsapp || '';
    
    const heroTitle = document.querySelector('header h1');
    if (heroTitle && config.hero_titulo) heroTitle.innerText = config.hero_titulo;
    const heroSub = document.querySelector('header p');
    if (heroSub && config.hero_subtitulo) heroSub.innerText = config.hero_subtitulo;

    const heroSection = document.querySelector('header.hero-home');
    if (heroSection && config.hero_bg_desktop_url) {
        heroSection.style.setProperty('--hero-bg-desktop', `url('${config.hero_bg_desktop_url}')`);
    }
}

async function initSite() {
    initTheme();
    setupLeadModal();
    initFinalidadeToggle(); // Inicia o componente de toggle
    
    try {
        const { data: config } = await supabase.from('configuracoes_site').select('*').limit(1).maybeSingle();
        if (config) { 
            siteConfig = config; 
            applySiteSettings(config); 
        }
    } catch (err) { console.error('Config Error:', err); }
    
    loadProperties(); 
}

function injectSearchIntoHero() {
    const heroSearchContainer = document.querySelector('.hero-search-container');
    if (!heroSearchContainer || heroSearchContainer.querySelector('.js-search-form-injected')) return;

    const form = document.createElement('form');
    form.className = 'js-search-form-injected flex flex-col md:flex-row gap-5 w-full mt-4 p-2 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-inner';
    
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
    input.placeholder = 'Ex: Casa no Bessa ou CS-001';
    input.className = 'w-full md:flex-1 px-8 py-6 rounded-3xl text-slate-900 bg-white border-none shadow-2xl outline-none transition-all font-bold text-lg placeholder:text-slate-400 placeholder:font-medium input-search-hero';

    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = 'Buscar';
    button.className = 'w-full md:w-auto btn-search-hero px-14 py-6 rounded-3xl font-black transition-all active:scale-[0.96] text-lg uppercase tracking-widest';

    form.appendChild(input);
    form.appendChild(button);
    heroSearchContainer.appendChild(form);
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

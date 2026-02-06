
import { supabase } from './supabase.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

let siteConfig = null;
let allImoveisCache = [];
let allFotosCache = [];
let currentFinalidade = 'Aluguel'; // Inicial padrão

/**
 * SMART LEAD POPUP LOGIC - REFATORADO
 */
function initSmartPopup() {
    // Verifica se o lead já enviou o formulário anteriormente (localStorage para persistência longa)
    if (localStorage.getItem('smart_popup_completed')) return;

    const showPopup = () => {
        if (document.getElementById('smart-lead-popup')) return;
        
        // Remove listeners para não disparar múltiplas vezes
        document.removeEventListener('click', showPopup);
        document.removeEventListener('touchstart', showPopup);
        clearTimeout(timerTrigger);

        injectPopup();
    };

    // Dispara após 5 segundos ou na primeira interação real
    const timerTrigger = setTimeout(showPopup, 5000);
    document.addEventListener('click', showPopup);
    document.addEventListener('touchstart', showPopup);
}

function injectPopup() {
    const popupHTML = `
        <div id="smart-lead-popup" class="fixed inset-0 z-[300] flex items-end sm:items-center justify-center pointer-events-none">
            <!-- Backdrop -->
            <div id="popup-backdrop" class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm opacity-0 transition-opacity duration-500 pointer-events-auto"></div>
            
            <!-- Content Card -->
            <div id="popup-card" class="relative w-full sm:max-w-[420px] bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 md:p-10 transform translate-y-full sm:translate-y-12 sm:opacity-0 transition-all duration-700 ease-out pointer-events-auto">
                <button id="close-smart-popup" class="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>

                <div id="popup-content-wrapper">
                    <div class="mb-8">
                        <h3 class="text-xl font-black text-slate-900 leading-tight">Para uma melhor experiência, responda as perguntas:</h3>
                    </div>

                    <form id="smart-popup-form" class="space-y-4">
                        <div class="space-y-4">
                            <input type="text" id="pop-nome" required placeholder="Qual é seu nome?" class="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700">
                            <input type="tel" id="pop-telefone" required placeholder="Qual seu contato?" class="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700">
                            
                            <button type="submit" class="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all mt-4">
                                Ver imóveis agora
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', popupHTML);

    // Animar entrada
    const backdrop = document.getElementById('popup-backdrop');
    const card = document.getElementById('popup-card');
    
    requestAnimationFrame(() => {
        backdrop.classList.add('opacity-100');
        card.classList.remove('translate-y-full', 'sm:translate-y-12', 'sm:opacity-0');
        card.classList.add('translate-y-0', 'sm:translate-y-0', 'sm:opacity-100');
    });

    // Função para fechar o popup
    const closePopup = () => {
        backdrop.classList.remove('opacity-100');
        card.classList.add('translate-y-full', 'sm:translate-y-12', 'sm:opacity-0');
        setTimeout(() => {
            const el = document.getElementById('smart-lead-popup');
            if (el) el.remove();
            document.body.style.overflow = ''; // Garante liberação do scroll
        }, 700);
    };

    document.getElementById('close-smart-popup').onclick = closePopup;
    backdrop.onclick = closePopup;

    // Mascara telefone
    document.getElementById('pop-telefone').oninput = (e) => {
        e.target.value = mascaraTelefone(e.target.value);
    };

    // Submissão do Formulário
    document.getElementById('smart-popup-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const wrapper = document.getElementById('popup-content-wrapper');

        btn.disabled = true;
        btn.innerText = "Processando...";

        try {
            const { error } = await supabase.from('leads').insert({
                nome: document.getElementById('pop-nome').value,
                telefone: document.getElementById('pop-telefone').value,
                imovel_interesse: 'Interesse via Popup Inteligente',
                origem: 'popup',
                created_at: new Date().toISOString()
            });

            if (error) throw error;

            // Sucesso: Persiste que o usuário já converteu
            localStorage.setItem('smart_popup_completed', 'true');

            // Feedback Visual de Sucesso (Premium)
            wrapper.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in duration-300">
                    <div class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <h3 class="text-2xl font-black text-slate-900 tracking-tight">Experiência Premium Desbloqueada</h3>
                </div>
            `;
            
            // Aguarda 0.8s e executa as ações finais
            setTimeout(() => {
                closePopup();
                // Scroll para a Hero (topo da página)
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 800);

        } catch (err) {
            console.error('Erro no popup:', err);
            btn.disabled = false;
            btn.innerText = "Tentar novamente";
        }
    };
}

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
    const fin = (imovel.finalidade || '').toLowerCase();
    if (fin === 'aluguel') return imovel.valor_locacao;
    return imovel.valor_venda;
}

function renderCardList(imoveis, fotos) {
    if (imoveis.length === 0) {
        return `<div class="col-span-full py-20 text-center text-slate-400 font-medium bg-white rounded-[2.5rem] border border-dashed border-slate-200">Não encontramos imóveis nesta categoria no momento.</div>`;
    }

    return imoveis.map(imovel => {
        const foto = (fotos || []).find(f => f.imovel_id === imovel.id);
        const imagem = foto ? foto.url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
        const preco = formatarBRL(obterValorImovel(imovel));
        const finalidade = imovel.finalidade || 'Venda';
        const referencia = imovel.referencia || `#${imovel.id.toString().slice(-4)}`;
        
        const localParts = [];
        if (imovel.bairro) localParts.push(imovel.bairro);
        let cidadeUf = "";
        if (imovel.cidade) cidadeUf += imovel.cidade;
        if (imovel.uf) cidadeUf += (cidadeUf ? '/' : '') + imovel.uf;
        if (cidadeUf) localParts.push(cidadeUf);
        const localizacao = localParts.join(', ') || 'Localização não informada';

        const specs = [];
        if (imovel.area_m2 > 0) specs.push(`<div class="flex items-center gap-2.5"><svg class="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg> ${imovel.area_m2}m²</div>`);
        if (imovel.dormitorios > 0) specs.push(`<div class="flex items-center gap-2.5"><svg class="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> ${imovel.dormitorios} Qts</div>`);
        if (imovel.suites > 0) specs.push(`<div class="flex items-center gap-2.5"><svg class="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z"/></svg> ${imovel.suites} Ste</div>`);
        if (imovel.banheiros > 0) specs.push(`<div class="flex items-center gap-2.5"><svg class="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg> ${imovel.banheiros} Banh</div>`);
        if (imovel.vagas_garagem > 0) specs.push(`<div class="flex items-center gap-2.5"><svg class="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg> ${imovel.vagas_garagem} Vag</div>`);

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
                    ${imovel.destaque ? '<div class="absolute bottom-5 left-5 bg-amber-400 text-slate-900 font-black text-[10px] px-4 py-2 rounded-full shadow-lg z-10 tracking-widest uppercase animate-pulse">Destaque</div>' : ''}
                </div>

                <div class="p-8 flex flex-col flex-grow">
                    <div class="mb-5">
                        <div class="flex items-center gap-2 mb-2">
                             <span class="inline-flex bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-blue-100/50">
                                ${imovel.cidade}/${imovel.uf || 'PB'}
                             </span>
                             <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">${imovel.bairro || ''}</span>
                        </div>
                        <h3 class="text-xl font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 h-14">${imovel.titulo}</h3>
                    </div>

                    <div class="grid grid-cols-2 gap-y-4 gap-x-2 border-t border-slate-100 pt-6 pb-6 text-slate-600 text-[12px] font-bold uppercase tracking-tight">
                        ${specs.join('')}
                    </div>

                    <div class="border-t border-slate-100 py-6 mt-auto">
                        <p class="text-[11px] font-black text-blue-600/60 uppercase tracking-[0.2em] mb-1">${finalidade}</p>
                        <p class="text-3xl font-black text-blue-600 tracking-tighter">${preco}</p>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function initFilterBadges() {
    const container = document.getElementById('filter-badges-container');
    if (!container) return;

    const renderBadges = () => {
        container.innerHTML = `
            <button class="filter-badge ${currentFinalidade === 'Venda' ? 'filter-badge-active' : 'filter-badge-inactive'}" data-value="Venda">Venda</button>
            <button class="filter-badge ${currentFinalidade === 'Aluguel' ? 'filter-badge-active' : 'filter-badge-inactive'}" data-value="Aluguel">Aluguel</button>
        `;

        container.querySelectorAll('.filter-badge').forEach(btn => {
            btn.onclick = () => {
                const val = btn.dataset.value;
                if (currentFinalidade !== val) {
                    currentFinalidade = val;
                    renderBadges();
                    applyFiltersLocally();
                }
            };
        });
    };

    renderBadges();
}

function applyFiltersLocally() {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;

    const filtered = allImoveisCache.filter(imovel => {
        const fin = (imovel.finalidade || '').toLowerCase();
        return fin === currentFinalidade.toLowerCase();
    });

    container.innerHTML = renderCardList(filtered, allFotosCache);
    
    document.querySelectorAll('.card-imovel').forEach(card => {
        card.onclick = () => window.location.href = `imovel.html?id=${card.dataset.id}`;
    });

    const title = document.querySelector('#regular-section h2');
    if (title) title.innerText = `Imóveis para ${currentFinalidade}`;
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
    };

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-90', 'opacity-0');
    };

    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

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
            setTimeout(closeModal, 2000);
        } catch (err) {
            btn.disabled = false;
            btn.innerText = "Quero Atendimento";
        }
    });
}

function setupFooterLeadForm() {
    const form = document.getElementById('footer-lead-form');
    const inputTelefone = document.getElementById('footer-telefone');
    if (!form || !inputTelefone) return;
    inputTelefone.addEventListener('input', (e) => { e.target.value = mascaraTelefone(e.target.value); });
    form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-footer-submit');
        const fields = document.getElementById('footer-form-fields');
        const success = document.getElementById('footer-success-msg');
        btn.disabled = true;
        btn.innerText = "Enviando...";
        try {
            const { error } = await supabase.from('leads').insert({
                nome: document.getElementById('footer-nome').value,
                email: document.getElementById('footer-email').value,
                telefone: inputTelefone.value,
                mensagem: document.getElementById('footer-mensagem').value,
                origem: 'footer',
                imovel_interesse: 'Footer',
                created_at: new Date().toISOString()
            });
            if (error) throw error;
            fields.classList.add('hidden');
            success.classList.remove('hidden');
            form.reset();
        } catch (err) {
            btn.disabled = false;
            btn.innerText = "Enviar Mensagem";
        }
    };
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

async function initSite() {
    initTheme();
    setupLeadModal();
    setupFooterLeadForm();
    initFilterBadges();
    
    // Inicia o Popup Inteligente (Lead Magnets)
    initSmartPopup();
    
    try {
        const { data: config } = await supabase.from('configuracoes_site').select('*').limit(1).maybeSingle();
        if (config) { siteConfig = config; applySiteSettings(config); }
    } catch (err) { console.error('Config Error:', err); }
    
    const isDetailPage = window.location.pathname.includes('imovel.html');
    if (!isDetailPage) loadProperties(); 
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
    input.placeholder = 'Ex: Casa venda Bessa ou CS-001';
    input.className = 'w-full md:flex-1 px-8 py-6 rounded-3xl text-slate-900 bg-white border-none shadow-2xl outline-none transition-all font-bold text-lg placeholder:text-slate-400 placeholder:font-medium input-search-hero';
    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = (siteConfig && siteConfig.hero_cta_texto) ? siteConfig.hero_cta_texto : 'Buscar';
    button.className = 'w-full md:w-auto btn-search-hero px-14 py-6 rounded-3xl font-black transition-all active:scale-[0.96] text-lg uppercase tracking-widest';
    form.appendChild(input);
    form.appendChild(button);
    heroSearchContainer.appendChild(form);
}

const SOCIAL_ICONS_MAP = {
  footer_instagram_url: `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  footer_tiktok_url: `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31 0 2.591.214 3.75.606V5.32c-1.027-.308-2.127-.47-3.262-.47-3.141 0-5.69 2.548-5.69 5.69 0 3.14 2.549 5.688 5.69 5.688 3.14 0 5.688-2.548 5.688-5.688v-4.72c1.472.932 3.155 1.54 4.975 1.705V2.32c-2.12 0-3.84-1.72-3.84-3.84V0h-3.46v14.12c0 2.148-1.742 3.89-3.89 3.89-2.147 0-3.89-1.742-3.89-3.89s1.743-3.89 3.89-3.89c.358 0 .703.048 1.03.14V6.7c-2.583.56-4.522 2.857-4.522 5.587 0 3.142 2.548 5.69 5.69 5.69 3.142 0 5.69-2.548 5.69-5.69V0h-3.75z"/></svg>`,
  footer_x_url: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>`,
  footer_linkedin_url: `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`
};

function applySiteSettings(config) {
    if (config.color_scheme) applyColorScheme(resolveColorScheme(config.color_scheme));
    const logoText = document.getElementById('site-logo-text');
    if (logoText) logoText.innerText = config.header_nome_site || 'ImobiMaster';
    const footerLogo = document.getElementById('footer-logo-text-bottom');
    if (footerLogo) footerLogo.innerText = config.footer_titulo || config.header_nome_site || 'ImobiMaster';
    const footerBio = document.getElementById('footer-bio-text');
    if (footerBio) footerBio.innerText = config.footer_bio || 'Especialistas em encontrar o lar dos seus sonhos.';
    const footerCreci = document.getElementById('footer-creci-text');
    if (footerCreci) footerCreci.innerText = config.footer_creci || '';
    const footerPhone = document.getElementById('footer-phone-display');
    if (footerPhone) footerPhone.innerText = config.footer_telefone || config.header_whatsapp || '';
    const socialContainer = document.getElementById('footer-social-links');
    if (socialContainer) {
        socialContainer.innerHTML = '';
        Object.keys(SOCIAL_ICONS_MAP).forEach(key => {
            const url = config[key];
            if (url && url.trim().length > 0) {
                const a = document.createElement('a');
                a.href = url.startsWith('http') ? url : `https://${url}`;
                a.target = '_blank';
                a.className = 'text-slate-400 hover:text-blue-600 transition-all hover:scale-110 active:scale-95';
                a.innerHTML = SOCIAL_ICONS_MAP[key];
                socialContainer.appendChild(a);
            }
        });
    }
    const headerCta = document.getElementById('header-cta-contato');
    if (headerCta && config.header_whatsapp) {
        headerCta.classList.remove('hidden');
        headerCta.href = `https://wa.me/${config.header_whatsapp.replace(/\D/g, '')}`;
        headerCta.textContent = 'Entre em contato';
    }
    const heroTitle = document.querySelector('header h1');
    if (heroTitle && config.hero_titulo) heroTitle.innerText = config.hero_titulo;
    const heroSub = document.querySelector('header p');
    if (heroSub && config.hero_subtitulo) heroSub.innerText = config.hero_subtitulo;
    const footerCopy = document.getElementById('footer-copyright-text');
    if (footerCopy) { footerCopy.innerText = config.footer_copyright || config.rodape_texto || `© ${new Date().getFullYear()} ${config.header_nome_site || 'ImobiMaster'}`; }
    const waButton = document.getElementById('wa-button');
    if (waButton && config.header_whatsapp) { waButton.href = `https://wa.me/${config.header_whatsapp.replace(/\D/g, '')}`; }
    const heroSection = document.querySelector('header.hero-home');
    if (heroSection && config.hero_bg_desktop_url) { heroSection.style.setProperty('--hero-bg-desktop', `url('${config.hero_bg_desktop_url}')`); }
}

async function loadProperties(filters = null) {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;
    try {
        let query = supabase.from('imoveis').select('*').eq('ativo', true);
        if (filters) {
            if (filters.referencia) query = query.ilike('referencia', `%${filters.referencia}%`);
            if (filters.tipo_imovel) query = query.ilike('tipo_imovel', filters.tipo_imovel);
            if (filters.tokens && filters.tokens.length > 0) {
              const search = filters.tokens.join(' ');
              query = query.or(`titulo.ilike.%${search}%,bairro.ilike.%${search}%,cidade.ilike.%${search}%`);
            }
        }
        let { data: imoveis, error } = await query.order('destaque', { ascending: false }).order('created_at', { ascending: false });
        if (error) throw error;
        const { data: fotos } = await supabase.from('imis_fotos').select('*').eq('is_capa', true);
        
        allImoveisCache = imoveis || [];
        allFotosCache = fotos || [];
        
        applyFiltersLocally();
    } catch (err) {
        container.innerHTML = `<p class="col-span-full text-center text-red-500 py-10 font-bold">Erro ao carregar imóveis.</p>`;
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

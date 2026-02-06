
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
 * GERA HTML DOS CARDS (Restaurado e Completo)
 */
function renderCardList(imoveis, fotos) {
    return imoveis.map(imovel => {
        const foto = (fotos || []).find(f => f.imovel_id === imovel.id);
        const imagem = foto ? foto.url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
        const preco = formatarBRL(obterValorImovel(imovel));
        const finalidade = imovel.finalidade || 'Venda';
        const referencia = imovel.referencia || `#${imovel.id.toString().slice(-4)}`;
        
        return `
            <div class="card-imovel group bg-white border border-slate-100 rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:-translate-y-3 transition-all duration-500 ease-out overflow-hidden flex flex-col h-full" data-id="${imovel.id}">
                <!-- Container da Imagem -->
                <div class="relative h-[250px] overflow-hidden shrink-0">
                    <img src="${imagem}" alt="${imovel.titulo}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    
                    <!-- Tags Superior Esquerda -->
                    <div class="absolute top-5 left-5 flex flex-col gap-2 z-10">
                        <span class="bg-white/95 backdrop-blur text-slate-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                            ${imovel.tipo_imovel || 'Imóvel'}
                        </span>
                        <span class="bg-blue-600/90 backdrop-blur text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                            ${imovel.cidade} / ${imovel.uf || '..'}
                        </span>
                    </div>

                    <!-- Referência Superior Direita -->
                    <span class="absolute top-5 right-5 bg-slate-900/80 backdrop-blur text-white px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-widest uppercase z-10 border border-white/20">
                        REF: ${referencia}
                    </span>
                    
                    ${imovel.destaque ? '<div class="absolute bottom-5 left-5 bg-amber-400 text-slate-900 font-black text-[10px] px-4 py-2 rounded-full shadow-lg z-10 tracking-widest uppercase animate-pulse">Destaque</div>' : ''}
                </div>
                
                <!-- Conteúdo do Card -->
                <div class="p-8 flex flex-col flex-grow">
                    <!-- Título e Bairro -->
                    <div class="mb-5">
                        <span class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">${imovel.bairro}</span>
                        <h3 class="text-xl font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 h-14">${imovel.titulo}</h3>
                    </div>

                    <!-- Preço e Finalidade -->
                    <div class="border-t border-slate-100 py-5">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">${finalidade}</p>
                        <p class="text-3xl font-black text-blue-600 tracking-tighter">${preco}</p>
                    </div>

                    <!-- Atributos Técnicos Grid -->
                    <div class="grid grid-cols-4 gap-2 border-t border-slate-100 pt-6 pb-2">
                        <div class="flex flex-col items-center gap-1.5 group/icon">
                            <div class="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 group-hover/icon:bg-blue-50 group-hover/icon:text-blue-600 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                            </div>
                            <span class="text-xs font-bold text-slate-700">${imovel.dormitorios || 0}</span>
                        </div>
                        <div class="flex flex-col items-center gap-1.5 group/icon">
                            <div class="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 group-hover/icon:bg-blue-50 group-hover/icon:text-blue-600 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v.01M12 14v.01M16 14v.01M21 12c0 1.657-1.007 3-2.25 3H5.25C4.007 15 3 13.657 3 12c0-1.657 1.007-3 2.25-3h13.5C19.993 9 21 10.343 21 12z"/></svg>
                            </div>
                            <span class="text-xs font-bold text-slate-700">${imovel.banheiros || 0}</span>
                        </div>
                        <div class="flex flex-col items-center gap-1.5 group/icon">
                            <div class="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 group-hover/icon:bg-blue-50 group-hover/icon:text-blue-600 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                            </div>
                            <span class="text-xs font-bold text-slate-700">${imovel.vagas_garagem || 0}</span>
                        </div>
                        <div class="flex flex-col items-center gap-1.5 group/icon">
                            <div class="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 group-hover/icon:bg-blue-50 group-hover/icon:text-blue-600 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"/></svg>
                            </div>
                            <span class="text-xs font-bold text-slate-700">${imovel.area_m2 || 0}m²</span>
                        </div>
                    </div>

                    <!-- Botão CTA Final -->
                    <div class="mt-auto pt-6">
                        <button class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] group-hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200 group-hover:shadow-blue-200">
                            Ver Detalhes
                            <svg class="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                        </button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

/**
 * MÁSCARA DE TELEFONE (JS Puro)
 */
function mascaraTelefone(valor) {
    if (!valor) return "";
    valor = valor.replace(/\D/g, "");
    valor = valor.replace(/^(\d{2})(\d)/g, "($1) $2");
    valor = valor.replace(/(\d)(\d{4})$/, "$1-$2");
    return valor;
}

/**
 * GESTÃO DO MODAL DE LEADS
 */
function setupLeadModal() {
    const modal = document.getElementById('lead-modal');
    const content = document.getElementById('lead-modal-content');
    const closeBtn = document.getElementById('close-lead-modal');
    const form = document.getElementById('lead-capture-form');
    const inputTelefone = document.getElementById('lead-telefone');

    if (!modal) return;

    inputTelefone.addEventListener('input', (e) => {
        e.target.value = mascaraTelefone(e.target.value);
    });

    const openModal = () => {
        if (localStorage.getItem('imobi_lead_sent')) return;
        modal.classList.remove('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-90', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    };

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-90', 'opacity-0');
    };

    closeBtn.onclick = closeModal;
    setTimeout(openModal, 4000);

    form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-lead');
        const fields = document.getElementById('lead-form-fields');
        const success = document.getElementById('lead-success-msg');
        const nome = document.getElementById('lead-nome').value;
        const telefone = inputTelefone.value;

        btn.disabled = true;
        btn.innerText = "Enviando...";

        try {
            const { error } = await supabase.from('leads').insert({
                nome: nome,
                telefone: telefone,
                origem: 'pagina',
                imovel_interesse: 'Interesse Geral (Captura Automática)',
                created_at: new Date().toISOString()
            });
            if (error) throw error;
            fields.classList.add('hidden');
            success.classList.remove('hidden');
            localStorage.setItem('imobi_lead_sent', 'true');
            setTimeout(closeModal, 2500);
        } catch (err) {
            console.error("Lead Error details:", err);
            alert(`Erro ao enviar: ${err.message || 'Verifique sua conexão.'}`);
            btn.disabled = false;
            btn.innerText = "Quero Atendimento";
        }
    };
}

/**
 * GESTÃO DO FORMULÁRIO DE LEADS NO RODAPÉ
 */
function setupFooterLeadForm() {
    const form = document.getElementById('footer-lead-form');
    const inputTelefone = document.getElementById('footer-telefone');
    
    if (!form || !inputTelefone) return;

    inputTelefone.addEventListener('input', (e) => {
        e.target.value = mascaraTelefone(e.target.value);
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('btn-footer-submit');
        const fields = document.getElementById('footer-form-fields');
        const success = document.getElementById('footer-success-msg');
        
        const nome = document.getElementById('footer-nome').value;
        const email = document.getElementById('footer-email').value;
        const telefone = inputTelefone.value;
        const mensagem = document.getElementById('footer-mensagem').value;

        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerText = "Enviando...";

        try {
            const { error } = await supabase.from('leads').insert({
                nome: nome,
                email: email,
                telefone: telefone,
                mensagem: mensagem,
                origem: 'Footer - Imóvel desejado',
                imovel_interesse: 'Busca personalizada (Footer)',
                created_at: new Date().toISOString()
            });

            if (error) throw error;

            fields.classList.add('hidden');
            success.classList.remove('hidden');
            form.reset();

        } catch (err) {
            console.error("Footer Lead Error details:", err);
            alert(`Não foi possível enviar: ${err.message || 'Erro de rede.'}`);
            btn.disabled = false;
            btn.innerText = originalText;
        }
    };
}

/**
 * PARSER INTELIGENTE DE BUSCA
 */
function parseSearchQuery(text) {
    const raw = text.toLowerCase().trim();
    if (!raw) return null;
    const filters = { referencia: null, finalidade: null, tipo_imovel: null, tokens: [] };
    const refMatch = raw.match(/([a-z]{1,}-?\d+)/i);
    if (refMatch) filters.referencia = refMatch[0].toUpperCase();
    const words = raw.split(/\s+/);
    const keywordsFinalidade = { 'Aluguel': ['aluguel', 'alugar', 'locação', 'locacao'], 'Venda': ['venda', 'vender', 'comprar', 'compra'] };
    const keywordsTipo = { 'Casa': ['casa', 'casas'], 'Apartamento': ['apartamento', 'apto', 'aptos'], 'Terreno': ['terreno', 'lote'], 'Comercial': ['comercial', 'sala', 'galpão'] };
    words.forEach(word => {
        if (filters.referencia && word.toUpperCase() === filters.referencia) return;
        let isKeyword = false;
        for (const [key, aliases] of Object.entries(keywordsFinalidade)) { if (aliases.includes(word)) { filters.finalidade = key; isKeyword = true; break; } }
        if (!isKeyword) { for (const [key, aliases] of Object.entries(keywordsTipo)) { if (aliases.includes(word)) { filters.tipo_imovel = key; isKeyword = true; break; } } }
        if (!isKeyword && word.length >= 2) filters.tokens.push(word);
    });
    return filters;
}

async function initSite() {
    initTheme();
    setupLeadModal();
    setupFooterLeadForm();
    try {
        const { data: config } = await supabase.from('configuracoes_site').select('*').limit(1).maybeSingle();
        if (config) { siteConfig = config; applySiteSettings(config); }
    } catch (err) { console.error('Config Error:', err); }
    const isDetailPage = window.location.pathname.includes('imovel.html');
    if (!isDetailPage) loadProperties(); 
}

/**
 * INJEÇÃO DE BUSCA MODERNIZADA
 */
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
    input.className = 'w-full md:flex-1 px-8 py-6 rounded-3xl text-slate-900 bg-white border-none shadow-2xl outline-none focus:ring-4 focus:ring-red-500/20 transition-all font-bold text-lg placeholder:text-slate-400 placeholder:font-medium';

    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = (siteConfig && siteConfig.hero_cta_texto) ? siteConfig.hero_cta_texto : 'Buscar';
    button.className = 'w-full md:w-auto bg-red-600 hover:bg-red-700 text-white px-14 py-6 rounded-3xl font-black transition-all shadow-2xl shadow-red-500/30 active:scale-[0.96] text-lg uppercase tracking-widest';

    form.appendChild(input);
    form.appendChild(button);
    heroSearchContainer.appendChild(form);
}

function applySiteSettings(config) {
    if (config.color_scheme) applyColorScheme(resolveColorScheme(config.color_scheme));
    const logoText = document.getElementById('site-logo-text');
    if (logoText) logoText.innerText = config.header_nome_site || 'ImobiMaster';
    
    // Logo rodapé
    const footerLogo = document.getElementById('footer-logo-text-bottom');
    if (footerLogo) footerLogo.innerText = config.header_nome_site || 'ImobiMaster';

    const headerCta = document.getElementById('header-cta-contato');
    if (headerCta && config.header_whatsapp) {
        headerCta.classList.remove('hidden');
        const waLink = `https://wa.me/${config.header_whatsapp.replace(/\D/g, '')}`;
        headerCta.href = waLink;
        headerCta.textContent = 'Entre em contato';
    }
    const heroTitle = document.querySelector('header h1');
    if (heroTitle && config.hero_titulo) heroTitle.innerText = config.hero_titulo;
    const heroTitleValue = config.hero_titulo || 'Encontre seu imóvel';
    if (heroTitle) heroTitle.innerText = heroTitleValue;

    const heroSub = document.querySelector('header p');
    if (heroSub && config.hero_subtitulo) heroSub.innerText = config.hero_subtitulo;
    const footerText = document.getElementById('footer-copyright-text');
    if (footerText) footerText.innerText = config.rodape_texto || '© ImobiMaster';
    
    const waButton = document.getElementById('wa-button');
    if (waButton) {
        if (config.header_whatsapp) {
            const num = config.header_whatsapp.replace(/\D/g, '');
            waButton.href = `https://wa.me/${num}?text=${encodeURIComponent("Olá! Gostaria de mais informações sobre os imóveis.")}`;
            waButton.parentElement.classList.remove('hidden');
        } else {
            waButton.parentElement.classList.add('hidden');
        }
    }

    const heroSection = document.querySelector('header.hero-home');
    if (heroSection && config.hero_bg_desktop_url) {
        heroSection.style.setProperty('--hero-bg-desktop', `url('${config.hero_bg_desktop_url}')`);
    }
}

async function loadProperties(filters = null) {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;
    container.innerHTML = '<div class="col-span-full py-20 text-center animate-pulse text-slate-400 font-bold tracking-widest uppercase text-sm">Acessando Banco de Dados...</div>';
    try {
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
        let { data: imoveis, error } = await query.order('destaque', { ascending: false }).order('created_at', { ascending: false });
        if (error) throw error;
        if (filters && (!imoveis || imoveis.length === 0)) {
            const { data: destaques } = await supabase.from('imoveis').select('*').eq('ativo', true).eq('destaque', true).order('created_at', { ascending: false });
            imoveis = destaques || [];
        }
        if (!imoveis || imoveis.length === 0) {
            container.innerHTML = `<div class="col-span-full py-20 text-center"><p class="text-slate-500 font-bold">Nenhum imóvel disponível para os critérios selecionados.</p></div>`;
            return;
        }
        const { data: fotos } = await supabase.from('imoveis_fotos').select('*').eq('is_capa', true);
        container.innerHTML = renderCardList(imoveis, fotos);
        document.querySelectorAll('.card-imovel').forEach(card => {
            card.onclick = () => window.location.href = `imovel.html?id=${card.dataset.id}`;
        });
    } catch (err) {
        console.error("Critical Load Error:", err);
        container.innerHTML = `<p class="col-span-full text-center text-red-500 py-10 font-bold">Erro de conexão com o servidor.</p>`;
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

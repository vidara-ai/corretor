import { supabase } from './supabase.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

let siteConfig = null;
let allImoveisCache = [];
let allFotosCache = [];
let currentFinalidade = 'Todos'; 
let isDestaqueOnly = false; 
let searchState = { intent: null, tokens: [] };
let debounceTimer;

const STOPWORDS = [
    'a', 'o', 'e', 'ou', 'nem', 'de', 'da', 'do', 'em', 'para', 'com', 'um', 'uma', 'os', 'as', 'no', 'na', 
    'por', 'dos', 'das', 'ao', 'aos', 'pelo', 'pela', 'num', 'numa', 'quero', 'busco', 'procurando', 'estou', 'interessado'
];

const INTENT_VENDA = ['comprar', 'compra', 'venda', 'vender', 'vende'];
const INTENT_ALUGUEL = ['alugar', 'aluguel', 'locacao', 'locar', 'aluga', 'alugo'];

/**
 * Função única para geração de links do WhatsApp com suporte a variáveis e fallbacks.
 */
function buildWhatsAppLink({ numero, mensagem }, imovel = {}) {
  if (!numero) return null;

  const cleanNumber = numero.replace(/\D/g, '');
  if (cleanNumber.length < 8) return null;

  const texto = (mensagem || '')
    .replace(/{{titulo}}/g, imovel.titulo || '')
    .replace(/{{referencia}}/g, imovel.referencia || imovel.id || '')
    .replace(/{{bairro}}/g, imovel.bairro || '')
    .replace(/{{cidade}}/g, imovel.cidade || '')
    .replace(/{{valor}}/g, '');

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(texto)}`;
}

/**
 * Normaliza texto: remove acentos e converte para minúsculas
 */
function normalizeText(text) {
    if (!text) return "";
    return text.toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/**
 * Debounce helper para busca em tempo real
 */
function debounce(func, timeout = 300) {
    return (...args) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { func.apply(this, args); }, timeout);
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
    if (imoveis.length === 0) return "";
    return imoveis.map(imovel => {
        const foto = (fotos || []).find(f => f.imovel_id === imovel.id);
        const imagem = foto ? foto.url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
        const preco = formatarBRL(obterValorImovel(imovel));
        const finalidade = imovel.finalidade || 'Venda';
        const referencia = imovel.referencia || `#${imovel.id.toString().slice(-4)}`;
        const specs = [];
        const area = imovel.area_m2 || imovel.area_privativa;
        if (area > 0) specs.push(`<div class="whitespace-nowrap">Área: ${area} m²</div>`);
        if (imovel.dormitorios > 0) specs.push(`<div class="whitespace-nowrap">Quartos: ${imovel.dormitorios}</div>`);
        if (imovel.suites > 0) specs.push(`<div class="whitespace-nowrap">Suítes: ${imovel.suites}</div>`);
        if (imovel.banheiros > 0) specs.push(`<div class="whitespace-nowrap">Banheiros: ${imovel.banheiros}</div>`);
        if (imovel.vagas_garagem > 0) specs.push(`<div class="whitespace-nowrap">Vagas: ${imovel.vagas_garagem}</div>`);

        return `
            <div class="card-imovel group bg-white border border-slate-100 rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:-translate-y-3 transition-all duration-500 ease-out overflow-hidden flex flex-col h-full cursor-pointer" data-id="${imovel.id}">
                <div class="relative h-[250px] overflow-hidden shrink-0">
                    <img src="${imagem}" alt="${imovel.titulo}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    <div class="absolute top-5 left-5 flex flex-col gap-2 z-10">
                        <span class="bg-white/95 backdrop-blur text-slate-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">${imovel.tipo_imovel || 'Imóvel'}</span>
                    </div>
                    <span class="absolute top-5 right-5 bg-slate-900/80 backdrop-blur text-white px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-widest uppercase z-10 border border-white/20">REF: ${referencia}</span>
                    ${imovel.destaque ? '<div class="absolute bottom-5 left-5 bg-amber-400 text-slate-900 font-black text-[10px] px-4 py-2 rounded-full shadow-lg z-10 tracking-widest uppercase animate-pulse">Destaque</div>' : ''}
                </div>
                <div class="p-8 flex flex-col flex-grow">
                    <div class="mb-5">
                        <div class="flex items-center gap-2 mb-2">
                             <span class="inline-flex bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-blue-100/50">${imovel.cidade}/${imovel.uf || 'PB'}</span>
                             <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">${imovel.bairro || ''}</span>
                        </div>
                        <h3 class="text-xl font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 h-14">${imovel.titulo}</h3>
                    </div>
                    <div class="grid grid-cols-2 gap-y-4 gap-x-2 border-t border-slate-100 pt-6 pb-6 text-slate-600 text-[11px] font-bold uppercase tracking-tight">${specs.join('')}</div>
                    <div class="border-t border-slate-100 py-6 mt-auto flex flex-col gap-5">
                        <div>
                            <p class="text-[11px] font-black text-blue-600/60 uppercase tracking-[0.2em] mb-1">${finalidade}</p>
                            <p class="text-3xl font-black text-blue-600 tracking-tighter">${preco}</p>
                        </div>
                        <div class="pt-2">
                             <span class="inline-flex items-center justify-center w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-100/50">Ver detalhes</span>
                        </div>
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
            <button class="filter-badge ${currentFinalidade === 'Todos' && !isDestaqueOnly ? 'filter-badge-active' : 'filter-badge-inactive'}" data-type="finalidade" data-value="Todos">Todos</button>
            <button class="filter-badge ${currentFinalidade === 'Venda' ? 'filter-badge-active' : 'filter-badge-inactive'}" data-type="finalidade" data-value="Venda">Venda</button>
            <button class="filter-badge ${currentFinalidade === 'Aluguel' ? 'filter-badge-active' : 'filter-badge-inactive'}" data-type="finalidade" data-value="Aluguel">Aluguel</button>
            <button class="filter-badge ${isDestaqueOnly ? 'filter-badge-active' : 'filter-badge-inactive'}" data-type="destaque" data-value="true">Destaque</button>
        `;
        container.querySelectorAll('.filter-badge').forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.type;
                const val = btn.dataset.value;
                if (type === 'finalidade') {
                    if (val === 'Todos') { currentFinalidade = 'Todos'; isDestaqueOnly = false; } else { currentFinalidade = val; }
                } else if (type === 'destaque') { isDestaqueOnly = !isDestaqueOnly; }
                renderBadges();
                applyFiltersLocally();
            };
        });
    };
    renderBadges();
}

/**
 * Lógica principal de filtragem com suporte a Intenção Semântica, OR Inteligente e Fallback
 */
function applyFiltersLocally() {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;

    let filtered = allImoveisCache.filter(imovel => {
        const imovelFinalidade = (imovel.finalidade || '').toLowerCase();
        
        // 1. Prioridade Semântica (Se o usuário quer comprar ou alugar)
        if (searchState.intent && imovelFinalidade !== searchState.intent) {
            return false;
        }

        // 2. Filtro de Categorias (Badges) - Se intent estiver setada, anula o filtro manual do badge de finalidade para dar prioridade à busca
        if (!searchState.intent) {
            const finMatch = currentFinalidade === 'Todos' || imovelFinalidade === currentFinalidade.toLowerCase();
            if (!finMatch) return false;
        }

        // 3. Filtro de Botão Destaque (Badge lateral)
        const destaqueMatch = !isDestaqueOnly || imovel.destaque === true;
        if (!destaqueMatch) return false;

        // 4. Lógica de Busca por Termos (OR Inteligente nos termos restantes)
        if (searchState.tokens.length > 0) {
            const fieldsToSearch = [
                normalizeText(imovel.titulo),
                normalizeText(imovel.tipo_imovel),
                normalizeText(imovel.finalidade),
                normalizeText(imovel.bairro),
                normalizeText(imovel.cidade),
                normalizeText(imovel.referencia)
            ];
            
            // Verifica se QUALQUER (OR) dos tokens existem em QUALQUER um dos campos
            const hasMatch = searchState.tokens.some(token => 
                fieldsToSearch.some(field => field.includes(token))
            );
            if (!hasMatch) return false;
        }
        
        return true;
    });

    // TRATAMENTO DE FALLBACK (Mensagem + Destaques)
    const isSearching = searchState.intent || searchState.tokens.length > 0;
    if (filtered.length === 0 && isSearching) {
        const destaques = allImoveisCache.filter(im => im.destaque);
        container.innerHTML = `
            <div class="col-span-full mb-12 animate-in fade-in duration-700">
                <div class="bg-amber-50 border border-amber-100 p-10 rounded-[2.5rem] text-center shadow-sm">
                    <p class="text-amber-900 font-extrabold text-xl leading-relaxed">
                        Não encontramos registros para o termo consultado, mas temos esses imóveis que podem ser do seu interesse.
                    </p>
                </div>
            </div>
            ${renderCardList(destaques, allFotosCache)}
        `;
    } else {
        container.innerHTML = renderCardList(filtered, allFotosCache) || `<div class="col-span-full py-20 text-center text-slate-400 font-medium bg-white rounded-[2.5rem] border border-dashed border-slate-200">Não encontramos imóveis nesta categoria no momento.</div>`;
    }
    
    document.querySelectorAll('.card-imovel').forEach(card => {
        card.onclick = () => window.location.href = `imovel.html?id=${card.dataset.id}`;
    });

    const title = document.querySelector('#regular-section h2');
    if (title) {
        let label = currentFinalidade === 'Todos' ? 'Todos os Imóveis' : `Imóveis para ${currentFinalidade}`;
        if (isDestaqueOnly) label += ' em Destaque';
        if (isSearching) label = 'Resultados da busca';
        title.innerText = label;
    }
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
    const alreadyShownThisSession = sessionStorage.getItem('lead_modal_shown');
    
    if (alreadySent === 'true' || alreadyShownThisSession === 'true') return;
    
    let opened = false;
    
    const openModal = () => {
        if (opened) return; 
        opened = true;

        // Limpa ouvintes para evitar disparos duplicados
        document.removeEventListener('click', openModal);
        document.removeEventListener('scroll', openModal);
        if (typeof timerTrigger !== 'undefined') clearTimeout(timerTrigger);

        modal.classList.remove('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-90', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');

        sessionStorage.setItem('lead_modal_shown', 'true');
    };

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-90', 'opacity-0');
    };

    // Disparadores (Timer de 5s e primeira interação)
    const timerTrigger = setTimeout(openModal, 5000);
    document.addEventListener('click', openModal, { once: true });
    document.addEventListener('scroll', openModal, { once: true });

    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const fields = document.getElementById('lead-form-fields');
        const success = document.getElementById('lead-success-msg');
        btn.disabled = true;
        btn.innerText = "Enviando...";
        try {
            const { error } = await supabase.from('leads').insert({
                nome: document.getElementById('lead-nome').value,
                telefone: document.getElementById('lead-telefone').value,
                origem: 'pagina', imovel_interesse: 'Interesse Geral', created_at: new Date().toISOString()
            });
            if (error) throw error;
            if (fields) fields.classList.add('hidden');
            if (success) success.classList.remove('hidden');
            localStorage.setItem('imobi_lead_sent', 'true');
            setTimeout(closeModal, 2000);
        } catch (err) { btn.disabled = false; btn.innerText = "Quero Atendimento"; }
    });
}

function setupFooterLeadForm() {
    const form = document.getElementById('footer-lead-form');
    const inputTelefone = document.getElementById('footer-telefone');
    const checkboxes = document.querySelectorAll('input[name="footer-intent"]');
    const checkboxContainer = document.getElementById('footer-checkbox-container');
    const checkboxError = document.getElementById('footer-checkbox-error');

    if (!form || !inputTelefone) return;

    // Mascara de telefone
    inputTelefone.addEventListener('input', (e) => { e.target.value = mascaraTelefone(e.target.value); });

    // Listener para limpar erros ao marcar checkbox
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const isAnyChecked = Array.from(checkboxes).some(c => c.checked);
            if (isAnyChecked) {
                checkboxContainer.classList.remove('border-red-400', 'ring-2', 'ring-red-100');
                checkboxError.classList.add('hidden');
            }
        });
    });

    form.onsubmit = async (e) => {
        e.preventDefault();

        // Validação de Checkboxes
        const selectedIntents = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        if (selectedIntents.length === 0) {
            checkboxContainer.classList.add('border-red-400', 'ring-2', 'ring-red-100');
            checkboxError.classList.remove('hidden');
            checkboxContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

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
                origem: `footer - ${selectedIntents.join(' / ')}`,
                imovel_interesse: selectedIntents.join(' / '),
                created_at: new Date().toISOString()
            });

            if (error) throw error;

            // Sucesso: Exibe mensagem por 0.5s
            fields.classList.add('hidden');
            success.classList.remove('hidden');

            setTimeout(() => {
                // Reset e Retorno ao Topo após 0.5s
                form.reset();
                success.classList.add('hidden');
                fields.classList.remove('hidden');
                
                // RESTAURAÇÃO DO BOTÃO PARA NOVO ENVIO
                btn.disabled = false;
                btn.innerText = "Enviar Mensagem";
                
                // Reset visual dos checkboxes
                checkboxContainer.classList.remove('border-red-400', 'ring-2', 'ring-red-100');
                checkboxError.classList.add('hidden');

                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 500);

        } catch (err) {
            console.error('Erro ao enviar form footer:', err);
            btn.disabled = false;
            btn.innerText = "Enviar Mensagem";
        }
    };
}

/**
 * Parse semântico da query: detecta intenção e filtra termos relevantes
 */
function parseSearchQuery(text) {
    if (!text) return { intent: null, tokens: [] };
    
    const normalized = normalizeText(text);
    const rawWords = normalized.split(/\s+/).filter(word => word.length > 1);
    
    let intent = null;
    const tokens = [];

    for (const word of rawWords) {
        // Detecta intenção de VENDA
        if (INTENT_VENDA.includes(word)) {
            intent = 'venda';
            continue;
        }
        // Detecta intenção de ALGUEL
        if (INTENT_ALUGUEL.includes(word)) {
            intent = 'aluguel';
            continue;
        }
        // Mantém apenas palavras que não são stopwords
        if (!STOPWORDS.includes(word)) {
            tokens.push(word);
        }
    }

    return { intent, tokens };
}

async function initSite() {
    initTheme();
    setupLeadModal();
    setupFooterLeadForm();
    initFilterBadges();
    try {
        const { data: config } = await supabase.from('configuracoes_site').select('*').limit(1).maybeSingle();
        if (config) { siteConfig = config; applySiteSettings(config); }
    } catch (err) { console.error('Config Error:', err); }
    loadProperties(); 
}

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
    
    // RENDERIZAÇÃO DINÂMICA DO FORMULÁRIO DO FOOTER COM VERIFICAÇÃO DEFENSIVA
    const formTitle = document.getElementById('footer-form-title');
    if (formTitle && config.titulo_formulario_footer && config.titulo_formulario_footer.trim() !== "") {
        formTitle.innerText = config.titulo_formulario_footer;
    }
    
    const formSubtitle = document.getElementById('footer-form-subtitle');
    if (formSubtitle && config.subtitulo_formulario_footer && config.subtitulo_formulario_footer.trim() !== "") {
        formSubtitle.innerText = config.subtitulo_formulario_footer;
    }

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

    // APLICAÇÃO DINÂMICA DO WHATSAPP DO HEADER
    const headerCta = document.getElementById('header-cta-contato');
    if (headerCta) {
        const waNum = config.whatsapp_header;
        const waMsg = config.whatsapp_msg_header || "Olá! Vim pelo seu site e gostaria de mais informações.";
        const link = buildWhatsAppLink({ numero: waNum, mensagem: waMsg });
        if (link) {
            headerCta.classList.remove('hidden');
            headerCta.href = link;
        } else {
            headerCta.classList.add('hidden');
        }
    }

    const heroTitle = document.querySelector('header h1');
    if (heroTitle && config.hero_titulo) heroTitle.innerText = config.hero_titulo;
    const heroSub = document.querySelector('header p');
    if (heroSub && config.hero_subtitulo) heroSub.innerText = config.hero_subtitulo;
    const footerCopy = document.getElementById('footer-copyright-text');
    if (footerCopy) { footerCopy.innerText = config.footer_copyright || config.rodape_texto || `© ${new Date().getFullYear()} ${config.header_nome_site || 'ImobiMaster'}`; }
    
    // APLICAÇÃO DINÂMICA DO BOTÃO FLUTUANTE
    const waBtn = document.getElementById('whatsapp-floating-btn');
    if (waBtn) {
        const waNum = config.whatsapp_floating || config.whatsapp_header;
        const waMsg = config.whatsapp_msg_floating || "Olá! Quero falar com um corretor agora.";
        const link = buildWhatsAppLink({ numero: waNum, mensagem: waMsg });
        if (link) {
            waBtn.href = link;
            waBtn.style.display = 'flex';
        } else {
            waBtn.style.display = 'none';
        }
    }

    const heroSection = document.querySelector('header.hero-home');
    if (heroSection && config.hero_bg_desktop_url) { heroSection.style.setProperty('--hero-bg-desktop', `url('${config.hero_bg_desktop_url}')`); }
}

function injectSearchIntoHero() {
    const heroSearchContainer = document.querySelector('.hero-search-container');
    if (!heroSearchContainer || heroSearchContainer.querySelector('.js-search-form-injected')) return;
    
    const form = document.createElement('form');
    form.className = 'js-search-form-injected flex flex-col md:flex-row gap-5 w-full mt-4 p-2 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-inner';
    
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Ex: Comprar casa no Bessa ou alugar apto';
    input.className = 'w-full md:flex-1 px-8 py-6 rounded-3xl text-slate-900 bg-white border-none shadow-2xl outline-none transition-all font-bold text-lg placeholder:text-slate-400 placeholder:font-medium input-search-hero';
    
    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = (siteConfig && siteConfig.hero_cta_texto) ? siteConfig.hero_cta_texto : 'Buscar';
    button.className = 'w-full md:w-auto btn-search-hero px-14 py-6 rounded-3xl font-black transition-all active:scale-[0.96] text-lg uppercase tracking-widest';

    // Lógica de Live Search com Debounce
    const handleInput = debounce((val) => {
        searchState = parseSearchQuery(val);
        applyFiltersLocally();
    }, 300);

    input.addEventListener('input', (e) => handleInput(e.target.value));

    form.onsubmit = (e) => {
        e.preventDefault();
        const resultsSection = document.getElementById('regular-section');
        if (resultsSection) resultsSection.scrollIntoView({ behavior: 'smooth' });
    };

    form.appendChild(input);
    form.appendChild(button);
    heroSearchContainer.appendChild(form);
}

const SOCIAL_ICONS_MAP = {
  footer_instagram_url: `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  footer_tiktok_url: `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 448 512"><path d="M448 209.91a210.06 210.06 0 0 1-122.77-39.25V349.38A162.55 162.55 0 1 1 185 188.31V278.2a74.62 74.62 0 1 0 52.23 71.18V0l88 0a121.18 121.18 0 0 0 1.86 22.17h0A122.18 122.18 0 0 0 381 102.39a121.43 121.43 0 0 0 67 20.14z"/></svg>`,
  footer_x_url: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-80.4 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>`,
  footer_linkedin_url: `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`
};

async function loadProperties() {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;
    try {
        const { data: imoveis, error } = await supabase.from('imoveis').select('*').eq('ativo', true);
        if (error) throw error;
        const { data: fotos } = await supabase.from('imoveis_fotos').select('*').eq('is_capa', true);
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
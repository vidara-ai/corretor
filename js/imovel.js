
import { supabase } from './supabase.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

/**
 * Global Gallery State
 */
let currentPhotos = [];
let currentIndex = 0;

/**
 * Mapeamentos de Labels Humanas
 */
const LABELS_PAGAMENTO = {
    financiamento: "Financiamento",
    fgts: "Uso de FGTS",
    cartao: "Cartão de crédito",
    permuta: "Aceita permuta",
    carta_credito: "Carta de Crédito",
    caucao: "Depósito Caução",
    fiador: "Fiador"
};

const LABELS_GARANTIAS = {
    fiador: "Fiador",
    caucao: "Depósito caução",
    seguro: "Seguro fiança"
};

/**
 * NORMALIZADOR DE DADOS (Shape Fix)
 */
function ensureArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try { return JSON.parse(trimmed); } catch (e) { return []; }
        }
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            return trimmed.slice(1, -1).split(',')
                .map(s => s.trim().replace(/^"|"$/g, ''))
                .filter(s => s !== "");
        }
        if (trimmed.includes(',')) {
            return trimmed.split(',').map(s => s.trim());
        }
        return [trimmed];
    }
    if (typeof val === 'object') {
        return Object.entries(val)
            .filter(([_, active]) => active === true || active === 'true')
            .map(([key]) => key);
    }
    return [];
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
 * FULLSCREEN LIGHTBOX ENGINE
 */
function initLightbox() {
    let modal = document.getElementById('lightbox-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lightbox-modal';
        modal.className = 'fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center opacity-0 pointer-events-none transition-opacity duration-300';
        modal.innerHTML = `
            <button id="lb-close" class="absolute top-6 right-6 text-white hover:text-gray-300 z-[210] p-2">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <button id="lb-prev" class="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition p-4 z-[210]">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button id="lb-next" class="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition p-4 z-[210]">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
            <div class="w-full h-full flex items-center justify-center p-4 md:p-12">
                <img id="lb-img" src="" class="max-w-full max-h-full object-contain shadow-2xl select-none transition-transform duration-300">
            </div>
            <div id="lb-counter" class="absolute bottom-6 text-white/60 font-medium text-sm tracking-widest uppercase"></div>
        `;
        document.body.appendChild(modal);

        // Eventos do Modal
        const closeBtn = modal.querySelector('#lb-close');
        const prevBtn = modal.querySelector('#lb-prev');
        const nextBtn = modal.querySelector('#lb-next');

        const close = () => {
            modal.classList.add('opacity-0', 'pointer-events-none');
            document.body.style.overflow = '';
        };

        const navigate = (dir) => {
            currentIndex = (currentIndex + dir + currentPhotos.length) % currentPhotos.length;
            updateLightboxContent();
            atualizarExibicaoGaleria(); // Sincroniza galeria da página
        };

        closeBtn.onclick = close;
        prevBtn.onclick = (e) => { e.stopPropagation(); navigate(-1); };
        nextBtn.onclick = (e) => { e.stopPropagation(); navigate(1); };
        modal.onclick = (e) => { if(e.target === modal || e.target.id === 'lb-img' || e.target.parentElement.id === 'lb-img') return; close(); };

        document.addEventListener('keydown', (e) => {
            if (modal.classList.contains('pointer-events-none')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') navigate(-1);
            if (e.key === 'ArrowRight') navigate(1);
        });
    }
}

function openLightbox(index) {
    const modal = document.getElementById('lightbox-modal');
    if (!modal) return;
    currentIndex = index;
    updateLightboxContent();
    modal.classList.remove('opacity-0', 'pointer-events-none');
    document.body.style.overflow = 'hidden';
}

function updateLightboxContent() {
    const img = document.getElementById('lb-img');
    const counter = document.getElementById('lb-counter');
    if (img && currentPhotos[currentIndex]) {
        img.src = currentPhotos[currentIndex].url;
        counter.textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
    }
}

async function iniciarPaginaImovel() {
    const params = new URLSearchParams(window.location.search);
    const imovelId = params.get('id');
    if (!imovelId) {
        mostrarErro('Código do imóvel inválido.');
        return;
    }

    try {
        const { data: imovel, error: imovelError } = await supabase.from('imoveis').select('*').eq('id', imovelId).single();
        if (imovelError || !imovel) {
            mostrarErro('Não conseguimos localizar este imóvel.');
            return;
        }

        const { data: fotos } = await supabase.from('imoveis_fotos').select('*').eq('imovel_id', imovelId).order('ordem', { ascending: true });
        currentPhotos = fotos || [];
        currentIndex = 0;

        const { data: config } = await supabase.from('configuracoes_site').select('*').limit(1).maybeSingle();
        if (config && config.color_scheme) {
            applyColorScheme(resolveColorScheme(config.color_scheme));
        }

        renderizarImovel(imovel, config || {});
        initLightbox(); // Prepara o modal
        setupGalleryEvents();
        finalizarLoading();
    } catch (err) {
        mostrarErro('Erro ao carregar dados.');
    }
}

function renderizarImovel(p, config) {
    const container = document.getElementById('content-container');
    if (!container) return;

    const mainPhotoUrl = currentPhotos.length > 0 ? currentPhotos[0].url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
    const precoFormatado = formatarBRL(obterValorImovel(p));
    const whatsappNum = config.imovel_cta_whatsapp || '5500000000000';
    const ctaTexto = config.imovel_cta_texto || 'Quero Agendar uma Visita';
    const msgText = `Olá!\nTenho interesse no imóvel Ref: ${p.referencia || p.id}`;
    const whatsappLink = `https://wa.me/${whatsappNum.replace(/\D/g, '')}?text=${encodeURIComponent(msgText)}`;

    const imovelFeatures = ensureArray(p.caracteristicas_imovel);
    const condoFeatures = ensureArray(p.caracteristicas_condominio);
    const pagamentos = ensureArray(p.opcoes_pagamento);
    const garantias = ensureArray(p.garantias_locacao);

    // Formatação da Localização
    const localizacao = `${p.bairro || ''}, ${p.cidade || ''}${p.uf ? '/' + p.uf : ''}`;

    container.innerHTML = `
        <div class="animate-in fade-in duration-700">
            <div class="galeria-imovel mb-8 group">
                ${currentPhotos.length > 1 ? `
                    <button id="btn-prev" class="galeria-btn galeria-prev opacity-0 group-hover:opacity-100 transition-opacity">‹</button>
                    <button id="btn-next" class="galeria-btn galeria-next opacity-0 group-hover:opacity-100 transition-opacity">›</button>
                ` : ''}
                <img id="galeria-foto-principal" src="${mainPhotoUrl}" alt="${p.titulo}" class="cursor-zoom-in transition-transform hover:scale-[1.01]">
                ${currentPhotos.length > 1 ? `
                    <div class="galeria-miniaturas no-scrollbar" id="galeria-miniaturas">
                        ${currentPhotos.map((f, idx) => `
                            <img src="${f.url}" class="miniatura-item ${idx === 0 ? 'border-blue-600 ring-2 ring-blue-100' : ''}" data-index="${idx}">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mt-12">
                <div class="space-y-6">
                    <div class="flex flex-wrap gap-2">
                        <span class="inline-block bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">${p.tipo_imovel || 'Imóvel'}</span>
                        ${p.destaque ? '<span class="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">Destaque</span>' : ''}
                        ${p.finalidade ? `<span class="bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider badge-finalidade-detalhe">Para ${p.finalidade}</span>` : ''}
                    </div>
                    
                    <h1 class="text-4xl md:text-5xl font-black text-slate-900 leading-tight">${p.titulo}</h1>
                    <p class="text-4xl text-blue-600 font-black">${precoFormatado}</p>
                    
                    <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <h3 class="font-bold text-slate-800 text-xl border-b pb-4">Descrição</h3>
                        <div class="prose prose-slate max-w-none text-slate-600 text-lg whitespace-pre-line leading-relaxed">${p.descricao || 'Sem descrição.'}</div>
                    </div>

                    ${imovelFeatures.length > 0 ? `
                        <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 class="font-bold text-slate-800 text-xl mb-6">Características do Imóvel</h3>
                            <div class="flex flex-wrap gap-2">
                                ${imovelFeatures.map(f => `<span class="bg-slate-50 border border-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium">${f}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${condoFeatures.length > 0 ? `
                        <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 class="font-bold text-slate-800 text-xl mb-6">Características do Condomínio</h3>
                            <div class="flex flex-wrap gap-2">
                                ${condoFeatures.map(f => `<span class="bg-blue-50 border border-blue-100 text-blue-700 px-4 py-2 rounded-xl text-sm font-medium">${f}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${(pagamentos.length > 0 || garantias.length > 0) ? `
                        <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8">
                            ${pagamentos.length > 0 ? `
                                <div>
                                    <h3 class="font-bold text-slate-800 text-xl mb-4">Opções de Pagamento</h3>
                                    <div class="flex flex-wrap gap-2">
                                        ${pagamentos.map(key => `<span class="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-semibold border border-emerald-100">${LABELS_PAGAMENTO[key] || key}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            ${garantias.length > 0 ? `
                                <div>
                                    <h3 class="font-bold text-slate-800 text-xl mb-4">Garantias de Locação</h3>
                                    <div class="flex flex-wrap gap-2">
                                        ${garantias.map(key => `<span class="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200">${LABELS_GARANTIAS[key] || key}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>

                <div class="space-y-8 sticky top-24">
                    <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-6">
                        <h3 class="font-bold text-slate-900 text-xl text-center">Ficha Técnica</h3>
                        <div class="grid grid-cols-2 gap-4 text-center">
                            <div class="bg-slate-50 p-4 rounded-2xl">
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Dormitórios</p>
                                <p class="text-slate-900 font-bold text-lg">${p.dormitorios || 0}</p>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-2xl">
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Suítes</p>
                                <p class="text-slate-900 font-bold text-lg">${p.suites || 0}</p>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-2xl">
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Banheiros</p>
                                <p class="text-slate-900 font-bold text-lg">${p.banheiros || 0}</p>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-2xl">
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Vagas</p>
                                <p class="text-slate-900 font-bold text-lg">${p.vagas_garagem || 0}</p>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-2xl col-span-2">
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Área Total</p>
                                <p class="text-slate-900 font-bold text-lg">${p.area_m2 || 0} m²</p>
                            </div>
                        </div>
                        <div class="space-y-3 pt-4 text-center">
                            <p class="text-sm font-bold text-slate-400 uppercase tracking-widest">Localização</p>
                            <p class="text-slate-700 font-medium">${localizacao}</p>
                        </div>
                        <a href="${whatsappLink}" target="_blank" class="block w-full text-center bg-emerald-500 text-white py-5 rounded-[2rem] font-bold text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100">
                            ${ctaTexto}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function setupGalleryEvents() {
    const mainImg = document.getElementById('galeria-foto-principal');
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const thumbnails = document.querySelectorAll('.miniatura-item');

    if (mainImg) {
        mainImg.addEventListener('click', () => openLightbox(currentIndex));
    }

    if (btnNext) btnNext.addEventListener('click', (e) => { e.stopPropagation(); currentIndex = (currentIndex + 1) % currentPhotos.length; atualizarExibicaoGaleria(); });
    if (btnPrev) btnPrev.addEventListener('click', (e) => { e.stopPropagation(); currentIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length; atualizarExibicaoGaleria(); });
    
    thumbnails.forEach(thumb => thumb.addEventListener('click', (e) => { 
        e.stopPropagation();
        currentIndex = parseInt(thumb.dataset.index); 
        atualizarExibicaoGaleria(); 
    }));
}

function atualizarExibicaoGaleria() {
    const mainImg = document.getElementById('galeria-foto-principal');
    const thumbnails = document.querySelectorAll('.miniatura-item');
    if (mainImg && currentPhotos[currentIndex]) mainImg.src = currentPhotos[currentIndex].url;
    thumbnails.forEach((thumb, idx) => {
        if (idx === currentIndex) thumb.classList.add('border-blue-600', 'ring-2', 'ring-blue-100');
        else thumb.classList.remove('border-blue-600', 'ring-2', 'ring-blue-100');
    });
}

function finalizarLoading() {
    const loader = document.getElementById('loading-container');
    const content = document.getElementById('content-container');
    if (loader) loader.style.display = 'none';
    if (content) content.style.display = 'block';
}

function mostrarErro(msg) {
    const container = document.getElementById('property-detail');
    if (container) container.innerHTML = `<div class="text-center py-20"><p class="text-slate-500 font-medium">${msg}</p></div>`;
}

document.addEventListener('DOMContentLoaded', iniciarPaginaImovel);

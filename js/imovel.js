
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
 * NORMALIZADOR DE DADOS
 */
function ensureArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            if (val.startsWith('[') || val.startsWith('{')) return JSON.parse(val);
        } catch (e) {}
        return val.split(',').map(s => s.trim()).filter(Boolean);
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
            <div class="w-full h-full flex items-center justify-center p-4">
                <img id="lb-img" src="" class="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-300">
            </div>
            <div id="lb-counter" class="absolute bottom-6 text-white/60 font-medium text-sm tracking-widest uppercase"></div>
        `;
        document.body.appendChild(modal);

        const close = () => {
            modal.classList.add('opacity-0', 'pointer-events-none');
            document.body.style.overflow = '';
        };

        const navigate = (dir) => {
            currentIndex = (currentIndex + dir + currentPhotos.length) % currentPhotos.length;
            updateLightboxContent();
            atualizarExibicaoGaleria();
        };

        modal.querySelector('#lb-close').onclick = close;
        modal.querySelector('#lb-prev').onclick = (e) => { e.stopPropagation(); navigate(-1); };
        modal.querySelector('#lb-next').onclick = (e) => { e.stopPropagation(); navigate(1); };
        modal.onclick = (e) => { if(e.target.id === 'lightbox-modal') close(); };

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
    if (!imovelId) return mostrarErro('Código do imóvel inválido.');

    try {
        const { data: imovel, error: imovelError } = await supabase.from('imoveis').select('*').eq('id', imovelId).single();
        if (imovelError || !imovel) return mostrarErro('Não conseguimos localizar este imóvel.');

        const { data: fotos } = await supabase.from('imoveis_fotos').select('*').eq('imovel_id', imovelId).order('ordem', { ascending: true });
        currentPhotos = fotos || [];
        currentIndex = 0;

        const { data: config } = await supabase.from('configuracoes_site').select('*').limit(1).maybeSingle();
        if (config && config.color_scheme) applyColorScheme(resolveColorScheme(config.color_scheme));

        renderizarImovel(imovel, config || {});
        initLightbox();
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

    container.innerHTML = `
        <div class="animate-in fade-in duration-700">
            <!-- Galeria Restaurada -->
            <div class="galeria-imovel mb-8 group">
                ${currentPhotos.length > 1 ? `
                    <button id="btn-prev" class="galeria-btn galeria-prev opacity-0 group-hover:opacity-100 transition-opacity">‹</button>
                    <button id="btn-next" class="galeria-btn galeria-next opacity-0 group-hover:opacity-100 transition-opacity">›</button>
                ` : ''}
                <img id="galeria-foto-principal" src="${mainPhotoUrl}" class="cursor-zoom-in">
                
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
                        <span class="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">${p.tipo_imovel || 'Imóvel'}</span>
                        ${p.destaque ? '<span class="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">Destaque</span>' : ''}
                        <span class="bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">Para ${p.finalidade || 'Venda'}</span>
                    </div>
                    <h1 class="text-4xl md:text-5xl font-black text-slate-900 leading-tight">${p.titulo}</h1>
                    <p class="text-4xl text-blue-600 font-black">${precoFormatado}</p>
                    
                    <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <h3 class="font-bold text-slate-800 text-xl border-b pb-4 mb-4">Descrição</h3>
                        <p class="text-slate-600 text-lg whitespace-pre-line leading-relaxed">${p.descricao || 'Sem descrição.'}</p>
                    </div>
                </div>

                <div class="space-y-8 sticky top-24">
                    <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-6">
                        <h3 class="font-bold text-slate-900 text-xl text-center">Ficha Técnica</h3>
                        <div class="grid grid-cols-2 gap-4 text-center">
                            <div class="bg-slate-50 p-4 rounded-2xl"><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Quartos</p><p class="text-slate-900 font-bold text-lg">${p.dormitorios || 0}</p></div>
                            <div class="bg-slate-50 p-4 rounded-2xl"><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Área</p><p class="text-slate-900 font-bold text-lg">${p.area_m2 || 0}m²</p></div>
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
    if (!mainImg) return;

    mainImg.onclick = () => openLightbox(currentIndex);

    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');

    if (btnNext) btnNext.onclick = (e) => { e.stopPropagation(); currentIndex = (currentIndex + 1) % currentPhotos.length; atualizarExibicaoGaleria(); };
    if (btnPrev) btnPrev.onclick = (e) => { e.stopPropagation(); currentIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length; atualizarExibicaoGaleria(); };

    document.querySelectorAll('.miniatura-item').forEach(thumb => {
        thumb.onclick = (e) => {
            e.stopPropagation();
            currentIndex = parseInt(thumb.dataset.index);
            atualizarExibicaoGaleria();
        };
    });
}

function atualizarExibicaoGaleria() {
    const mainImg = document.getElementById('galeria-foto-principal');
    const thumbnails = document.querySelectorAll('.miniatura-item');
    if (mainImg && currentPhotos[currentIndex]) {
        mainImg.src = currentPhotos[currentIndex].url;
    }
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
    if (container) container.innerHTML = `<div class="text-center py-20 text-slate-500 font-medium">${msg}</div>`;
}

document.addEventListener('DOMContentLoaded', iniciarPaginaImovel);

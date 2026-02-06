
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
        modal.className = 'fixed inset-0 z-[200] bg-black/98 flex flex-col items-center justify-center opacity-0 pointer-events-none transition-opacity duration-300';
        modal.innerHTML = `
            <button id="lb-close" class="absolute top-6 right-6 text-white hover:text-red-500 z-[210] p-2 transition-colors">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <button id="lb-prev" class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition p-4 z-[210]">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button id="lb-next" class="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition p-4 z-[210]">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
            </button>
            <div class="w-full h-full flex items-center justify-center p-4">
                <img id="lb-img" src="" class="max-w-full max-h-[85vh] object-contain shadow-2xl transition-all duration-300 select-none">
            </div>
            <div id="lb-counter" class="absolute bottom-10 text-white/60 font-black text-xs tracking-[0.3em] uppercase"></div>
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
        if (config) {
            if (config.color_scheme) applyColorScheme(resolveColorScheme(config.color_scheme));
            if (config.rodape_texto) document.getElementById('footer-copyright-text').innerText = config.rodape_texto;
        }

        renderizarImovel(imovel, config || {});
        initLightbox();
        setupGalleryEvents();
        finalizarLoading();
    } catch (err) {
        console.error(err);
        mostrarErro('Erro ao carregar dados do imóvel.');
    }
}

function renderizarImovel(p, config) {
    const container = document.getElementById('content-container');
    if (!container) return;

    const mainPhotoUrl = currentPhotos.length > 0 ? currentPhotos[0].url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
    const precoFormatado = formatarBRL(obterValorImovel(p));
    const whatsappNum = config.imovel_cta_whatsapp || '5500000000000';
    const ctaTexto = config.imovel_cta_texto || 'Agendar Visita via WhatsApp';
    const msgText = `Olá! Vi o imóvel "${p.titulo}" (Ref: ${p.referencia || p.id}) no site e gostaria de mais informações.`;
    const whatsappLink = `https://wa.me/${whatsappNum.replace(/\D/g, '')}?text=${encodeURIComponent(msgText)}`;

    const caracImovel = ensureArray(p.caracteristicas_imovel);
    const caracCondo = ensureArray(p.caracteristicas_condominio);
    
    // Processamento de Opções de Negociação
    const negopay = ensureArray(p.opcoes_pagamento);
    const negogua = ensureArray(p.garantias_locacao);
    const hasNegotiation = negopay.length > 0 || negogua.length > 0;

    container.innerHTML = `
        <div class="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            
            <!-- HEADER INFO -->
            <div class="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div class="flex-1 space-y-3">
                    <div class="flex flex-wrap gap-2">
                        <span class="bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                            ${p.tipo_imovel || 'Imóvel'}
                        </span>
                        ${p.destaque ? '<span class="bg-amber-400 text-slate-900 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">Destaque</span>' : ''}
                        <span class="bg-slate-900 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                            ${p.finalidade || 'Venda'}
                        </span>
                    </div>
                    <h1 class="text-3xl md:text-5xl font-black text-slate-900 leading-tight tracking-tighter">${p.titulo}</h1>
                    <p class="text-slate-500 font-medium flex items-center gap-2">
                        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        ${p.bairro}, ${p.cidade} - ${p.uf}
                    </p>
                </div>
                <div class="text-left md:text-right space-y-1">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Referência: ${p.referencia || p.id}</p>
                    <p class="text-4xl md:text-5xl font-black text-blue-600 tracking-tighter">${precoFormatado}</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
                
                <!-- COLUNA ESQUERDA: GALERIA E DESCRIÇÃO -->
                <div class="lg:col-span-2 space-y-12">
                    
                    <!-- GALERIA CARROSSEL -->
                    <div class="galeria-imovel group shadow-2xl">
                        ${currentPhotos.length > 1 ? `
                            <button id="btn-prev" class="galeria-btn galeria-prev opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90">‹</button>
                            <button id="btn-next" class="galeria-btn galeria-next opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90">›</button>
                        ` : ''}
                        
                        <div class="relative overflow-hidden aspect-video">
                            <img id="galeria-foto-principal" src="${mainPhotoUrl}" class="cursor-zoom-in w-full h-full object-cover transition-transform duration-500 hover:scale-105">
                        </div>

                        ${currentPhotos.length > 1 ? `
                            <div class="galeria-miniaturas no-scrollbar bg-slate-50/50 backdrop-blur" id="galeria-miniaturas">
                                ${currentPhotos.map((f, idx) => `
                                    <img src="${f.url}" class="miniatura-item transition-all ${idx === 0 ? 'border-blue-600 ring-4 ring-blue-100' : 'opacity-60 hover:opacity-100'}" data-index="${idx}">
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>

                    <!-- DESCRIÇÃO -->
                    <div class="bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h2 class="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <span class="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                            Sobre o imóvel
                        </h2>
                        <p class="text-slate-600 text-lg leading-relaxed whitespace-pre-line font-medium">${p.descricao || 'Este imóvel não possui uma descrição detalhada cadastrada.'}</p>
                    </div>

                    <!-- CARACTERÍSTICAS -->
                    ${caracImovel.length > 0 ? `
                    <div class="space-y-6">
                        <h2 class="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <span class="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                            Características do imóvel
                        </h2>
                        <div class="flex flex-wrap gap-3">
                            ${caracImovel.map(c => `<span class="bg-white border border-slate-100 px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-700 shadow-sm">${c}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}

                    ${caracCondo.length > 0 ? `
                    <div class="space-y-6">
                        <h2 class="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <span class="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                            O condomínio oferece
                        </h2>
                        <div class="flex flex-wrap gap-3">
                            ${caracCondo.map(c => `<span class="bg-white border border-slate-100 px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-700 shadow-sm">${c}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- OPÇÕES DE NEGOCIAÇÃO (NOVA SEÇÃO) -->
                    ${hasNegotiation ? `
                    <div class="space-y-8 bg-slate-50/50 p-8 md:p-12 rounded-[2.5rem] border border-slate-100">
                        <h2 class="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <span class="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                            Opções de Negociação
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            ${negopay.length > 0 ? `
                            <div class="space-y-4">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pagamento</p>
                                <ul class="space-y-3">
                                    ${negopay.map(opt => `
                                        <li class="flex items-center gap-3 text-slate-700 font-bold text-sm">
                                            <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                                            ${LABELS_PAGAMENTO[opt] || opt}
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                            ` : ''}
                            ${negogua.length > 0 ? `
                            <div class="space-y-4">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Garantias (Locação)</p>
                                <ul class="space-y-3">
                                    ${negogua.map(opt => `
                                        <li class="flex items-center gap-3 text-slate-700 font-bold text-sm">
                                            <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                                            ${LABELS_PAGAMENTO[opt] || opt}
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- COLUNA DIREITA: FICHA TÉCNICA E CTA -->
                <div class="space-y-8 sticky top-28">
                    <div class="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-2xl space-y-8">
                        <div class="text-center space-y-1">
                            <h3 class="font-black text-slate-900 text-2xl">Ficha Técnica</h3>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Informações confirmadas</p>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-slate-50 p-5 rounded-3xl flex flex-col items-center justify-center text-center">
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Área Útil</span>
                                <span class="text-slate-900 font-black text-xl">${p.area_m2 || 0} m²</span>
                            </div>
                            <div class="bg-slate-50 p-5 rounded-3xl flex flex-col items-center justify-center text-center">
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quartos</span>
                                <span class="text-slate-900 font-black text-xl">${p.dormitorios || 0}</span>
                            </div>
                            <div class="bg-slate-50 p-5 rounded-3xl flex flex-col items-center justify-center text-center">
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Suítes</span>
                                <span class="text-slate-900 font-black text-xl">${p.suites || 0}</span>
                            </div>
                            <div class="bg-slate-50 p-5 rounded-3xl flex flex-col items-center justify-center text-center">
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Banheiros</span>
                                <span class="text-slate-900 font-black text-xl">${p.banheiros || 0}</span>
                            </div>
                            <div class="col-span-2 bg-slate-50 p-5 rounded-3xl flex flex-col items-center justify-center text-center">
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vagas Garagem</span>
                                <span class="text-slate-900 font-black text-xl">${p.vagas_garagem || 0}</span>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <a href="${whatsappLink}" target="_blank" class="flex items-center justify-center gap-3 w-full bg-emerald-500 text-white py-6 rounded-[2rem] font-black text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100 hover:-translate-y-1 active:scale-95">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.417-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.305 1.652zm6.599-3.835c1.405.836 2.755 1.28 4.301 1.281 5.177 0 9.389-4.213 9.391-9.391 0-2.512-.975-4.87-2.747-6.645s-4.131-2.744-6.641-2.745c-5.181 0-9.392 4.213-9.395 9.393 0 1.608.434 3.182 1.258 4.587l-.937 3.421 3.49-.916zm11.22-7.259c.302-.15.302-.501.05-.651-.251-.151-1.488-.732-1.714-.813-.226-.082-.389-.121-.55.121s-.622.772-.763.933c-.14.161-.282.181-.582.031s-1.266-.467-2.411-1.487c-.891-.793-1.492-1.773-1.667-2.074-.176-.301-.019-.464.131-.614.135-.135.301-.351.452-.527.151-.176.201-.292.301-.482.1-.191.05-.361-.026-.511-.076-.151-.55-1.328-.753-1.817-.197-.474-.4-.41-.55-.418s-.311-.008-.477-.008-.437.061-.664.311c-.226.251-.865.842-.865 2.05s.879 2.373 1.005 2.541c.125.168 1.733 2.646 4.197 3.711.586.254 1.044.405 1.401.518.589.187 1.125.161 1.549.098.473-.07 1.488-.607 1.701-1.192.214-.584.214-1.085.15-1.192-.063-.107-.226-.171-.528-.221z"/></svg>
                                ${ctaTexto}
                            </a>
                            <p class="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest px-6 leading-relaxed">Resposta rápida em horário comercial</p>
                        </div>
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

    if (btnNext) btnNext.onclick = (e) => { e.stopPropagation(); navigateGallery(1); };
    if (btnPrev) btnPrev.onclick = (e) => { e.stopPropagation(); navigateGallery(-1); };

    document.querySelectorAll('.miniatura-item').forEach(thumb => {
        thumb.onclick = (e) => {
            e.stopPropagation();
            currentIndex = parseInt(thumb.dataset.index);
            atualizarExibicaoGaleria();
        };
    });
}

function navigateGallery(dir) {
    currentIndex = (currentIndex + dir + currentPhotos.length) % currentPhotos.length;
    atualizarExibicaoGaleria();
}

function atualizarExibicaoGaleria() {
    const mainImg = document.getElementById('galeria-foto-principal');
    const thumbnails = document.querySelectorAll('.miniatura-item');
    if (mainImg && currentPhotos[currentIndex]) {
        mainImg.src = currentPhotos[currentIndex].url;
    }
    thumbnails.forEach((thumb, idx) => {
        if (idx === currentIndex) {
            thumb.classList.add('border-blue-600', 'ring-4', 'ring-blue-100', 'opacity-100');
            thumb.classList.remove('opacity-60');
        } else {
            thumb.classList.remove('border-blue-600', 'ring-4', 'ring-blue-100', 'opacity-100');
            thumb.classList.add('opacity-60');
        }
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
    if (container) container.innerHTML = `<div class="text-center py-20 bg-white rounded-[2.5rem] shadow-sm border border-slate-100"><p class="text-slate-500 font-black text-xl">${msg}</p><a href="index.html" class="mt-4 inline-block text-blue-600 font-bold hover:underline">Voltar para a página inicial</a></div>`;
}

document.addEventListener('DOMContentLoaded', iniciarPaginaImovel);

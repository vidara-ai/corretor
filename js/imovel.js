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
    carta_credito: "Carta de Crédito"
};

const LABELS_GARANTIAS = {
    fiador: "Fiador",
    caucao: "Depósito Caução",
    seguro_fianca: "Seguro Fiança"
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
    const fin = (imovel.finalidade || '').toLowerCase();
    if (fin === 'aluguel') return imovel.valor_locacao;
    return imovel.valor_venda;
}

/**
 * FULLSCREEN LIGHTBOX ENGINE (Refatorado para Carrossel Contínuo)
 */
function initLightbox() {
    let modal = document.getElementById('lightbox-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lightbox-modal';
        modal.className = 'fixed inset-0 z-[1000] bg-black/95 flex flex-col items-center justify-center opacity-0 pointer-events-none transition-opacity duration-300 select-none';
        modal.innerHTML = `
            <!-- Botão Fechar -->
            <button id="lb-close" class="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md rounded-full z-[1010] p-4 transition-all hover:scale-110 active:scale-90 flex items-center justify-center shadow-2xl" aria-label="Fechar galeria">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            
            <!-- Navegação Lateral (Visível em Mobile e Desktop) -->
            <button id="lb-prev" class="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-white bg-white/5 hover:bg-white/20 p-4 rounded-full z-[1010] transition-all active:scale-90 shadow-xl border border-white/5">
                <svg class="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button id="lb-next" class="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-white bg-white/5 hover:bg-white/20 p-4 rounded-full z-[1010] transition-all active:scale-90 shadow-xl border border-white/5">
                <svg class="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
            </button>
            
            <!-- Área da Imagem -->
            <div class="w-full h-full flex items-center justify-center p-4 md:p-12 overflow-hidden">
                <img id="lb-img" src="" class="max-w-full max-h-[85vh] object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-300 opacity-0 transform scale-95" alt="Visualização expandida">
            </div>
            
            <!-- Contador -->
            <div id="lb-counter" class="absolute bottom-8 md:bottom-12 text-white/50 font-black text-[10px] tracking-[0.4em] uppercase bg-black/20 backdrop-blur px-4 py-1.5 rounded-full"></div>
        `;
        document.body.appendChild(modal);

        const close = () => {
            modal.classList.add('opacity-0', 'pointer-events-none');
            document.body.style.overflow = '';
        };

        const navigate = (dir) => {
            const imgEl = document.getElementById('lb-img');
            imgEl.classList.add('opacity-0', 'scale-95'); // Efeito de transição
            
            setTimeout(() => {
                currentIndex = (currentIndex + dir + currentPhotos.length) % currentPhotos.length;
                updateLightboxContent();
                atualizarExibicaoGaleria(); // Sincroniza a galeria da página
                imgEl.classList.remove('opacity-0', 'scale-95');
            }, 150);
        };

        modal.querySelector('#lb-close').onclick = (e) => { e.stopPropagation(); close(); };
        modal.querySelector('#lb-prev').onclick = (e) => { e.stopPropagation(); navigate(-1); };
        modal.querySelector('#lb-next').onclick = (e) => { e.stopPropagation(); navigate(1); };
        
        // Fechar ao clicar fora da imagem ou no fundo
        modal.onclick = (e) => { 
            if(e.target.id === 'lightbox-modal' || e.target.tagName === 'DIV') close(); 
        };

        // Teclado
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
    const imgEl = document.getElementById('lb-img');
    imgEl.classList.remove('opacity-0', 'scale-95');
    
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
            
            // Task 1: Update Footer Copyright Dynamic Text
            const footerCopy = document.getElementById('footer-copyright-text');
            if (footerCopy) {
                const copyText = config.texto_copyright_final || config.footer_copyright || '';
                if (copyText) {
                    footerCopy.innerText = copyText;
                } else {
                    footerCopy.style.display = 'none';
                }
            }

            // Atualização do Botão WhatsApp Nativo
            const waBtn = document.getElementById('whatsapp-floating-btn');
            if (waBtn) {
                const whatsappValue = config.whatsapp_header || config.header_whatsapp;
                if (whatsappValue) {
                    const cleanNumber = whatsappValue.replace(/\D/g, '');
                    if (cleanNumber.length >= 8) {
                        waBtn.href = `https://wa.me/${cleanNumber}`;
                        waBtn.style.display = 'block';
                    }
                } else {
                    waBtn.style.display = 'none';
                }
            }
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
    const finalidadeLower = (p.finalidade || '').toLowerCase();
    const isAluguel = finalidadeLower === 'aluguel';

    const whatsappNum = config.whatsapp_header || config.header_whatsapp || '5500000000000';
    const refLabel = p.referencia || p.id;
    const msgText = `Olá! Vi o imóvel ${p.titulo} - ${refLabel} na sua vitrine digital e gostaria de agendar uma visita.`;
    const whatsappLink = `https://wa.me/${whatsappNum.replace(/\D/g, '')}?text=${encodeURIComponent(msgText)}`;

    const caracImovel = ensureArray(p.caracteristicas_imovel);
    const caracCondo = ensureArray(p.caracteristicas_condominio);
    
    // Processamento de Negociação e Garantias
    const negopay = ensureArray(p.opcoes_pagamento);
    const garantiasArray = ensureArray(p.garantias_locacao);
    
    // Suporte a campos booleanos explícitos
    if (p.fiador && !garantiasArray.includes('fiador')) garantiasArray.push('fiador');
    if (p.deposito_caucao && !garantiasArray.includes('caucao')) garantiasArray.push('caucao');

    // Construção dinâmica das especificações
    const area = p.area_m2 || p.area_privativa;
    const specItems = [];
    if (area > 0) specItems.push(`<div class="bg-slate-50 p-5 rounded-3xl text-center flex items-center justify-center min-h-[80px]"><span class="text-slate-900 font-black text-sm">Área: ${area} m²</span></div>`);
    if (p.dormitorios > 0) specItems.push(`<div class="bg-slate-50 p-5 rounded-3xl text-center flex items-center justify-center min-h-[80px]"><span class="text-slate-900 font-black text-sm">Quartos: ${p.dormitorios}</span></div>`);
    if (p.suites > 0) specItems.push(`<div class="bg-slate-50 p-5 rounded-3xl text-center flex items-center justify-center min-h-[80px]"><span class="text-slate-900 font-black text-sm">Suítes: ${p.suites}</span></div>`);
    if (p.banheiros > 0) specItems.push(`<div class="bg-slate-50 p-5 rounded-3xl text-center flex items-center justify-center min-h-[80px]"><span class="text-slate-900 font-black text-sm">Banheiros: ${p.banheiros}</span></div>`);
    if (p.vagas_garagem > 0) specItems.push(`<div class="bg-slate-50 p-5 rounded-3xl text-center flex items-center justify-center min-h-[80px]"><span class="text-slate-900 font-black text-sm">Vagas: ${p.vagas_garagem}</span></div>`);

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
                <div class="lg:col-span-2 space-y-12">
                    <!-- CARROSSEL PRINCIPAL -->
                    <div class="galeria-imovel group relative shadow-2xl rounded-[2.5rem] overflow-hidden bg-slate-100 aspect-video">
                        <button id="btn-prev" class="absolute left-6 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-slate-900 w-12 h-12 rounded-full flex items-center justify-center shadow-xl z-20 md:opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        <button id="btn-next" class="absolute right-6 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-slate-900 w-12 h-12 rounded-full flex items-center justify-center shadow-xl z-20 md:opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"/></svg>
                        </button>
                        
                        <img id="galeria-foto-principal" src="${mainPhotoUrl}" class="cursor-zoom-in w-full h-full object-cover transition-all duration-700 hover:scale-105" alt="Foto principal">
                        
                        <div class="absolute bottom-6 right-6 bg-slate-900/80 backdrop-blur text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest z-20">
                            Clique para ampliar
                        </div>
                    </div>

                    ${currentPhotos.length > 1 ? `
                        <div class="flex gap-4 overflow-x-auto no-scrollbar pb-2" id="galeria-miniaturas">
                            ${currentPhotos.map((f, idx) => `
                                <img src="${f.url}" class="miniatura-item w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover cursor-pointer transition-all shrink-0 ${idx === 0 ? 'ring-4 ring-blue-600 scale-95 border-2 border-white opacity-100' : 'opacity-40 hover:opacity-100'}" data-index="${idx}" alt="Miniatura ${idx + 1}">
                            `).join('')}
                        </div>
                    ` : ''}

                    <div class="bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h2 class="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <span class="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                            Sobre o imóvel
                        </h2>
                        <p class="text-slate-600 text-lg leading-relaxed whitespace-pre-line font-medium">${p.descricao || 'Descrição em breve...'}</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
                        ${caracImovel.length > 0 ? `
                        <div class="space-y-6">
                            <h2 class="text-xl font-black text-slate-900 flex items-center gap-3">
                                <span class="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                                Características
                            </h2>
                            <div class="flex flex-wrap gap-2">
                                ${caracImovel.map(c => `<span class="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl text-xs font-bold text-slate-600">${c}</span>`).join('')}
                            </div>
                        </div>` : ''}
                        
                        ${caracCondo.length > 0 ? `
                        <div class="space-y-6">
                            <h2 class="text-xl font-black text-slate-900 flex items-center gap-3">
                                <span class="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                                Lazer e Condomínio
                            </h2>
                            <div class="flex flex-wrap gap-2">
                                ${caracCondo.map(c => `<span class="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl text-xs font-bold text-slate-600">${c}</span>`).join('')}
                            </div>
                        </div>` : ''}
                    </div>

                    ${(negopay.length > 0 || (isAluguel && garantiasArray.length > 0)) ? `
                    <div class="space-y-8 bg-slate-50/50 p-8 md:p-12 rounded-[2.5rem] border border-slate-100">
                        <h2 class="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <span class="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                            Negociação
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            ${negopay.length > 0 ? `
                            <div class="space-y-4">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pagamento</p>
                                <ul class="space-y-3">
                                    ${negopay.map(opt => `
                                        <li class="flex items-center gap-3 text-slate-700 font-bold text-sm">
                                            <div class="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center"><svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></div>
                                            ${LABELS_PAGAMENTO[opt] || opt}
                                        </li>`).join('')}
                                </ul>
                            </div>` : ''}

                            ${(isAluguel && garantiasArray.length > 0) ? `
                            <div class="space-y-4">
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Garantias (Locação)</p>
                                <ul class="space-y-3">
                                    ${garantiasArray.map(opt => `
                                        <li class="flex items-center gap-3 text-slate-700 font-bold text-sm">
                                            <div class="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></div>
                                            ${LABELS_GARANTIAS[opt] || opt}
                                        </li>`).join('')}
                                </ul>
                            </div>` : ''}
                        </div>
                    </div>` : ''}
                </div>

                <div class="space-y-8 sticky top-28">
                    <div class="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-2xl space-y-8">
                        <div class="text-center space-y-1">
                            <h3 class="font-black text-slate-900 text-2xl">Especificações</h3>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ficha técnica</p>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            ${specItems.join('')}
                        </div>

                        <div class="space-y-4">
                            <a href="${whatsappLink}" target="_blank" class="flex items-center justify-center w-full bg-blue-600 text-white py-6 rounded-xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95 uppercase tracking-tight">
                                Agendar visita agora
                            </a>
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
            thumb.classList.add('ring-4', 'ring-blue-600', 'scale-95', 'opacity-100', 'border-2', 'border-white');
            thumb.classList.remove('opacity-40');
        } else {
            thumb.classList.remove('ring-4', 'ring-blue-600', 'scale-95', 'opacity-100', 'border-2', 'border-white');
            thumb.classList.add('opacity-40');
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
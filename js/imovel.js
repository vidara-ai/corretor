import { supabase } from './supabase.js';
import { resolveColorScheme, applyColorScheme } from './theme/engine.js';

/**
 * Global Gallery State
 */
let currentPhotos = [];
let currentIndex = 0;

function formatarBRL(valor) {
    if (!valor || valor === 0) return 'Sob consulta';
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function obterValorImovel(imovel) {
    if (imovel.finalidade === 'Aluguel' || imovel.finalidade === 'aluguel') return imovel.valor_locacao;
    return imovel.valor_venda;
}

async function iniciarPaginaImovel() {
    const params = new URLSearchParams(window.location.search);
    const imovelId = params.get('id');
    if (!imovelId) {
        mostrarErro('Código do imóvel inválido ou não informado.');
        return;
    }

    try {
        const { data: imovel, error: imovelError } = await supabase
            .from('imoveis')
            .select('*')
            .eq('id', imovelId)
            .single();

        if (imovelError || !imovel) {
            mostrarErro('Não conseguimos localizar este imóvel.');
            return;
        }

        const { data: fotos } = await supabase
            .from('imoveis_fotos')
            .select('*')
            .eq('imovel_id', imovelId)
            .order('ordem', { ascending: true });

        currentPhotos = fotos || [];
        currentIndex = 0;

        const { data: config } = await supabase
            .from('configuracoes_site')
            .select('*')
            .limit(1)
            .maybeSingle();

        // Aplica o tema
        if (config && config.color_scheme_id) {
            const scheme = resolveColorScheme(config.color_scheme_id);
            applyColorScheme(scheme);
        }

        renderizarImovel(imovel, config || {});
        setupGalleryEvents();
        finalizarLoading();
    } catch (err) {
        mostrarErro('Erro ao processar dados.');
    }
}

function renderizarImovel(p, config) {
    const container = document.getElementById('content-container');
    if (!container) return;

    const mainPhotoUrl = currentPhotos.length > 0 ? currentPhotos[0].url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
    const precoFormatado = formatarBRL(obterValorImovel(p));
    const whatsappNum = config.imovel_cta_whatsapp || '5500000000000';
    const ctaTexto = config.imovel_cta_texto || 'Quero Agendar uma Visita';
    const referencia = p.referencia || p.id;
    const msgText = `Olá!\nTenho interesse no imóvel Ref: ${referencia}`;
    const whatsappLink = `https://wa.me/${whatsappNum.replace(/\D/g, '')}?text=${encodeURIComponent(msgText)}`;

    container.innerHTML = `
        <div class="animate-in fade-in duration-700">
            <div class="galeria-imovel mb-8">
                ${currentPhotos.length > 1 ? `
                    <button id="btn-prev" class="galeria-btn galeria-prev">‹</button>
                    <button id="btn-next" class="galeria-btn galeria-next">›</button>
                ` : ''}
                <img id="galeria-foto-principal" src="${mainPhotoUrl}" alt="${p.titulo}">
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
                    ${p.caracteristicas_imovel && p.caracteristicas_imovel.length > 0 ? `
                        <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 class="font-bold text-slate-800 text-xl mb-6">Características</h3>
                            <div class="flex flex-wrap gap-2">
                                ${p.caracteristicas_imovel.map(feat => `<span class="bg-slate-50 border border-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium">${feat}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="space-y-8 sticky top-24">
                    <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-6">
                        <h3 class="font-bold text-slate-900 text-xl">Ficha Técnica</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-slate-50 p-4 rounded-2xl"><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Dormitórios</p><p class="text-slate-900 font-bold text-lg">${p.dormitorios || 0}</p></div>
                            <div class="bg-slate-50 p-4 rounded-2xl"><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Área</p><p class="text-slate-900 font-bold text-lg">${p.area_m2 || 0} m²</p></div>
                        </div>
                        <div class="space-y-3 pt-4">
                            <p class="text-sm font-bold text-slate-400 uppercase tracking-widest">Localização</p>
                            <p class="text-slate-700 font-medium">${p.bairro || ''}, ${p.cidade || ''}</p>
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
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const thumbnails = document.querySelectorAll('.miniatura-item');
    if (btnNext) btnNext.addEventListener('click', () => { currentIndex = (currentIndex + 1) % currentPhotos.length; atualizarExibicaoGaleria(); });
    if (btnPrev) btnPrev.addEventListener('click', () => { currentIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length; atualizarExibicaoGaleria(); });
    thumbnails.forEach(thumb => thumb.addEventListener('click', () => { currentIndex = parseInt(thumb.dataset.index); atualizarExibicaoGaleria(); }));
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
    if (container) container.innerHTML = `<div class="text-center py-20"><p>${msg}</p></div>`;
}

document.addEventListener('DOMContentLoaded', iniciarPaginaImovel);

import { supabase } from './supabase.js';

/**
 * Global Gallery State
 */
let currentPhotos = [];
let currentIndex = 0;

/**
 * Initializes the property detail page
 */
async function iniciarPaginaImovel() {
    // 1. Get ID from URL
    const params = new URLSearchParams(window.location.search);
    const imovelId = params.get('id');

    console.log('ID do imóvel detectado:', imovelId);

    if (!imovelId) {
        console.error('ID do imóvel não informado na URL');
        mostrarErro('Código do imóvel inválido ou não informado.');
        return;
    }

    try {
        // 2. Fetch Property Data
        const { data: imovel, error: imovelError } = await supabase
            .from('imoveis')
            .select('*')
            .eq('id', imovelId)
            .single();

        if (imovelError || !imovel) {
            console.error('Erro ao buscar imóvel:', imovelError);
            mostrarErro('Não conseguimos localizar este imóvel em nossa base de dados.');
            return;
        }

        // 3. Fetch Photos
        const { data: fotos, error: fotosError } = await supabase
            .from('imoveis_fotos')
            .select('*')
            .eq('imovel_id', imovelId)
            .order('ordem', { ascending: true })
            .order('created_at', { ascending: true });

        currentPhotos = fotos || [];
        currentIndex = 0;

        // 4. Render Data
        renderizarImovel(imovel);

        // 5. Setup Gallery Listeners
        setupGalleryEvents();

        // 6. Cleanup UI State
        finalizarLoading();

    } catch (err) {
        console.error('Erro crítico ao carregar página:', err);
        mostrarErro('Ocorreu um problema técnico ao processar os dados do imóvel.');
    }
}

/**
 * Renders the property HTML into the container
 */
function renderizarImovel(p) {
    const container = document.getElementById('content-container');
    if (!container) return;

    const mainPhotoUrl = currentPhotos.length > 0 ? currentPhotos[0].url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
    const formattedPrice = Number(p.valor_venda || p.valor_locacao || 0).toLocaleString('pt-BR');

    container.innerHTML = `
        <div class="animate-in fade-in duration-700">
            <!-- Property Gallery -->
            <div class="galeria-imovel mb-8">
                ${currentPhotos.length > 1 ? `
                    <button id="btn-prev" class="galeria-btn galeria-prev">‹</button>
                    <button id="btn-next" class="galeria-btn galeria-next">›</button>
                ` : ''}

                <img id="galeria-foto-principal" src="${mainPhotoUrl}" alt="${p.titulo}">

                ${currentPhotos.length > 1 ? `
                    <div class="galeria-miniaturas no-scrollbar" id="galeria-miniaturas">
                        ${currentPhotos.map((f, idx) => `
                            <img src="${f.url}" 
                                 class="miniatura-item ${idx === 0 ? 'border-blue-600 ring-2 ring-blue-100' : ''}" 
                                 data-index="${idx}">
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <!-- Content Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mt-12">
                <div class="space-y-6">
                    <div class="flex flex-wrap gap-2">
                        <span class="inline-block bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                            ${p.tipo_imovel || 'Imóvel'}
                        </span>
                        ${p.destaque ? '<span class="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">Destaque</span>' : ''}
                    </div>
                    
                    <h1 class="text-4xl md:text-5xl font-black text-slate-900 leading-tight">${p.titulo}</h1>
                    <p class="text-4xl text-blue-600 font-black">R$ ${formattedPrice}</p>
                    
                    <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <h3 class="font-bold text-slate-800 text-xl border-b pb-4">Descrição do Imóvel</h3>
                        <div class="prose prose-slate max-w-none text-slate-600 text-lg whitespace-pre-line leading-relaxed">
                            ${p.descricao || 'Nenhuma descrição adicional foi informada.'}
                        </div>
                    </div>

                    ${p.caracteristicas_imovel && p.caracteristicas_imovel.length > 0 ? `
                        <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 class="font-bold text-slate-800 text-xl mb-6">Características do Imóvel</h3>
                            <div class="flex flex-wrap gap-2">
                                ${p.caracteristicas_imovel.map(feat => `
                                    <span class="bg-slate-50 border border-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium">
                                        ${feat}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${p.caracteristicas_condominio && p.caracteristicas_condominio.length > 0 ? `
                        <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 class="font-bold text-slate-800 text-xl mb-6">Lazer e Condomínio</h3>
                            <div class="flex flex-wrap gap-2">
                                ${p.caracteristicas_condominio.map(feat => `
                                    <span class="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-sm font-medium">
                                        ${feat}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Detalhes Card -->
                <div class="space-y-8 sticky top-24">
                    <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-6">
                        <h3 class="font-bold text-slate-900 text-xl">Ficha Técnica</h3>
                        <div class="grid grid-cols-2 gap-4">
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
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Área Total</p>
                                <p class="text-slate-900 font-bold text-lg">${p.area_m2 || 0} m²</p>
                            </div>
                        </div>

                        <div class="space-y-3 pt-4">
                            <p class="text-sm font-bold text-slate-400 uppercase tracking-widest">Localização</p>
                            <p class="text-slate-700 font-medium">${p.bairro || ''}, ${p.cidade || ''} - ${p.uf || ''}</p>
                            <p class="text-xs text-slate-400">Referência: ${p.referencia || 'N/I'}</p>
                        </div>

                        <a href="https://wa.me/5500000000000?text=Olá, tenho interesse no imóvel Ref ${p.referencia || p.id}: ${p.titulo}" 
                           target="_blank" 
                           class="block w-full text-center bg-emerald-500 text-white py-5 rounded-[2rem] font-bold text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100 active:scale-95">
                            Tenho Interesse via WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Gallery Navigation Logic
 */
function setupGalleryEvents() {
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const thumbnails = document.querySelectorAll('.miniatura-item');

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % currentPhotos.length;
            atualizarExibicaoGaleria();
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length;
            atualizarExibicaoGaleria();
        });
    }

    thumbnails.forEach(thumb => {
        thumb.addEventListener('click', () => {
            currentIndex = parseInt(thumb.dataset.index);
            atualizarExibicaoGaleria();
        });
    });
}

function atualizarExibicaoGaleria() {
    const mainImg = document.getElementById('galeria-foto-principal');
    const thumbnails = document.querySelectorAll('.miniatura-item');

    if (mainImg && currentPhotos[currentIndex]) {
        mainImg.src = currentPhotos[currentIndex].url;
    }

    thumbnails.forEach((thumb, idx) => {
        if (idx === currentIndex) {
            thumb.classList.add('border-blue-600', 'ring-2', 'ring-blue-100');
        } else {
            thumb.classList.remove('border-blue-600', 'ring-2', 'ring-blue-100');
        }
    });
}

/**
 * UI State Helpers
 */
function finalizarLoading() {
    const loader = document.getElementById('loading-container');
    const content = document.getElementById('content-container');
    
    if (loader) loader.style.display = 'none';
    if (content) content.style.display = 'block';
}

function mostrarErro(msg) {
    const container = document.getElementById('property-detail');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-20">
                <div class="bg-red-50 text-red-600 p-8 rounded-3xl inline-block max-w-md">
                    <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <h2 class="text-xl font-bold mb-2">Ops! Ocorreu um erro</h2>
                    <p class="text-sm opacity-80 mb-6">${msg}</p>
                    <a href="index.html" class="bg-red-600 text-white px-6 py-2 rounded-full font-bold text-xs uppercase tracking-widest">Voltar para a Home</a>
                </div>
            </div>
        `;
    }
}

// Start execution
document.addEventListener('DOMContentLoaded', iniciarPaginaImovel);

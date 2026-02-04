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

        // 5. Cleanup UI State
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
                            <h3 class="font-bold text-slate-800 text-xl mb-6">Características</h3>
                            <div class="flex flex-
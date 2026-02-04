import { supabase } from './supabase.js';

// Estado global para a galeria da página de detalhes
let currentPhotos = [];
let currentIndex = 0;

/**
 * Helpers para formatação de valores
 */
function formatarBRL(valor) {
    if (!valor || valor === 0) return 'Sob consulta';
    return Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function obterValorImovel(imovel) {
    if (imovel.finalidade === 'Aluguel' || imovel.finalidade === 'aluguel') {
        return imovel.valor_locacao;
    }
    return imovel.valor_venda;
}

/**
 * Inicialização do Site Público
 * Gerencia tanto a Home (lista) quanto a página de Detalhes
 */
async function initSite() {
    const params = new URLSearchParams(window.location.search);
    const propertyId = params.get('id');
    const isDetailPage = window.location.pathname.includes('imovel.html');

    // TAREFA 1: Carregar configurações do site (Safe mode)
    try {
        const { data: config, error: configError } = await supabase
            .from('configuracoes_site')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (configError) {
            console.warn('Aviso: Não foi possível carregar as configurações do site:', configError.message);
        } else if (config) {
            applySiteSettings(config);
        }
    } catch (err) {
        console.warn('Erro silencioso ao processar configurações:', err);
    }

    // TAREFA 2: Carregar Conteúdo (Home ou Detalhe)
    if (isDetailPage && propertyId) {
        loadPropertyDetail(propertyId);
    } else {
        loadHomeProperties();
    }
}

/**
 * Aplica as configurações visuais ao site
 */
function applySiteSettings(config) {
    const logoText = document.getElementById('site-logo-text');
    if (logoText) logoText.innerText = config.titulo_header || 'ImobiMaster';
    
    const heroTitle = document.querySelector('header h1');
    if (heroTitle && config.hero_titulo) heroTitle.innerText = config.hero_titulo;

    const heroSub = document.querySelector('header p');
    if (heroSub && config.hero_subtitulo) heroSub.innerText = config.hero_subtitulo;

    const heroSection = document.querySelector('header');
    if (heroSection && config.hero_imagem_url) {
        heroSection.style.backgroundImage = `linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.8)), url('${config.hero_imagem_url}')`;
        heroSection.style.backgroundSize = 'cover';
        heroSection.style.backgroundPosition = 'center';
    }

    const footerText = document.getElementById('footer-copyright-text');
    if (footerText) footerText.innerText = config.rodape_texto || '© ImobiMaster';
}

/**
 * Carrega a lista de imóveis na Home
 */
async function loadHomeProperties() {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;

    try {
        const { data: imoveis, error: imoveisError } = await supabase
          .from('imoveis')
          .select('*')
          .eq('ativo', true)
          .order('destaque', { ascending: false })
          .order('ordem_destaque', { ascending: true, nullsLast: true })
          .order('created_at', { ascending: false });

        if (imoveisError) {
          console.error('Erro ao buscar imóveis:', imoveisError);
          container.innerHTML = `<p class="col-span-full text-center text-red-500 py-10">Erro: ${imoveisError.message}</p>`;
          return;
        }

        const { data: fotos, error: fotosError } = await supabase
          .from('imoveis_fotos')
          .select('*')
          .eq('is_capa', true);

        if (fotosError) {
          console.error('Erro ao buscar fotos:', fotosError);
        }

        const imoveisComFoto = imoveis.map(imovel => {
          const fotoCapa = (fotos || []).find(f => f.imovel_id === imovel.id);
          return {
            ...imovel,
            foto_url: fotoCapa ? fotoCapa.url : null
          };
        });

        if (imoveisComFoto.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-slate-400 py-10">Nenhum imóvel disponível no momento.</p>';
            return;
        }

        container.innerHTML = imoveisComFoto.map(imovel => {
            const precoFormatado = formatarBRL(obterValorImovel(imovel));
            const imagem = imovel.foto_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
            const badgeDestaque = imovel.destaque ? `<div class="badge-destaque">DESTAQUE</div>` : '';

            return `
                <div class="card-imovel" data-id="${imovel.id}">
                    <div class="card-imagem">
                        <img src="${imagem}" alt="${imovel.titulo}">
                        <span class="badge-tipo">${imovel.tipo_imovel || 'Imóvel'}</span>
                        <span class="badge-local">${imovel.cidade}</span>
                        ${badgeDestaque}
                    </div>

                    <div class="card-imovel-body imovel-card-content">
                        <span class="imovel-bairro">${imovel.bairro}</span>
                        <h3 class="imovel-titulo text-center lg:text-left">${imovel.titulo}</h3>
                        
                        <div class="divisor-card"></div>

                        <div class="preco text-center">
                            <div class="imovel-finalidade">${imovel.finalidade || 'Venda'}</div>
                            <strong>${precoFormatado}</strong>
                        </div>

                        <div class="divisor-card"></div>

                        <div class="imovel-info">
                            <div class="info-icons imovel-info-icons">
                                <span>🛏 ${imovel.dormitorios || 0}</span>
                                <span>🛁 ${imovel.banheiros || 0}</span>
                                <span>🚗 ${imovel.vagas_garagem || 0}</span>
                            </div>

                            <div class="divisor-card"></div>

                            <div class="imovel-ref-area">
                                Ref: ${imovel.referencia || 'N/I'} — Área: ${imovel.area_m2 || 0} m²
                            </div>
                        </div>

                        <button class="btn-detalhar">
                            Detalhar
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Configurar listeners de clique nos cards e botões
        setupCardEventListeners();

    } catch (err) {
        console.error('Erro crítico no site público:', err);
    }
}

/**
 * Configura os eventos de clique para os cards e botões de detalhar
 */
function setupCardEventListeners() {
    // Clique no card inteiro
    document.querySelectorAll('.card-imovel').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            if (id) {
                window.location.href = `imovel.html?id=${id}`;
            }
        });
    });

    // Clique no botão detalhar (com stopPropagation)
    document.querySelectorAll('.btn-detalhar').forEach(botao => {
        botao.addEventListener('click', (event) => {
            event.stopPropagation();
            const card = botao.closest('.card-imovel');
            const id = card ? card.dataset.id : null;
            if (id) {
                window.location.href = `imovel.html?id=${id}`;
            }
        });
    });
}

/**
 * Funções da Galeria (Globais para acesso via onclick)
 */
window.nextPhoto = () => {
    if (currentPhotos.length <= 1) return;
    currentIndex = (currentIndex + 1) % currentPhotos.length;
    updateGalleryDisplay();
};

window.prevPhoto = () => {
    if (currentPhotos.length <= 1) return;
    currentIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length;
    updateGalleryDisplay();
};

window.setPhoto = (index) => {
    currentIndex = index;
    updateGalleryDisplay();
};

function updateGalleryDisplay() {
    const mainImg = document.getElementById('galeria-foto-principal');
    if (mainImg && currentPhotos[currentIndex]) {
        mainImg.src = currentPhotos[currentIndex].url;
    }

    // Atualiza classes das miniaturas
    document.querySelectorAll('.miniatura-item').forEach((thumb, idx) => {
        if (idx === currentIndex) {
            thumb.classList.add('border-blue-600', 'ring-2', 'ring-blue-100');
        } else {
            thumb.classList.remove('border-blue-600', 'ring-2', 'ring-blue-100');
        }
    });
}

/**
 * Carrega os detalhes de um imóvel específico
 */
async function loadPropertyDetail(id) {
    const container = document.getElementById('property-detail');
    if (!container) return;

    try {
        const { data: p, error: pError } = await supabase
            .from('imoveis')
            .select('*')
            .eq('id', id)
            .single();

        if (pError) throw pError;
        if (!p) {
            container.innerHTML = '<p class="text-center py-20 text-slate-500">Imóvel não encontrado.</p>';
            return;
        }

        // Busca fotos com ordenação específica
        const { data: fotos, error: fError } = await supabase
            .from('imoveis_fotos')
            .select('*')
            .eq('imovel_id', id)
            .order('ordem', { ascending: true })
            .order('created_at', { ascending: true });

        currentPhotos = fotos || [];
        currentIndex = 0;

        const mainPhotoUrl = currentPhotos.length > 0 ? currentPhotos[0].url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
        const precoFormatado = formatarBRL(obterValorImovel(p));

        // Construção do HTML com a Galeria no Topo
        container.innerHTML = `
            <div class="animate-in fade-in duration-700">
                <!-- ETAPA 1: Container da Galeria -->
                <div class="galeria-imovel mb-8">
                    ${currentPhotos.length > 1 ? `
                        <button onclick="window.prevPhoto()" class="galeria-btn galeria-prev">‹</button>
                        <button onclick="window.nextPhoto()" class="galeria-btn galeria-next">›</button>
                    ` : ''}

                    <img id="galeria-foto-principal" src="${mainPhotoUrl}" alt="${p.titulo}">

                    ${currentPhotos.length > 1 ? `
                        <div class="galeria-miniaturas no-scrollbar" id="galeria-miniaturas">
                            ${currentPhotos.map((f, idx) => `
                                <img src="${f.url}" 
                                     class="miniatura-item ${idx === 0 ? 'border-blue-600 ring-2 ring-blue-100' : ''}" 
                                     onclick="window.setPhoto(${idx})">
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <!-- Conteúdo Abaixo da Galeria -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mt-12">
                    <div class="space-y-6">
                        <div class="inline-block bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                            ${p.tipo_imovel || 'Imóvel'}
                        </div>
                        <h1 class="text-4xl md:text-5xl font-black text-slate-900 leading-tight">${p.titulo}</h1>
                        
                        <div>
                            <div class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">${p.finalidade || 'Venda'}</div>
                            <p class="text-4xl text-blue-600 font-black">${precoFormatado}</p>
                        </div>
                        
                        <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                            <h3 class="font-bold text-slate-800 text-lg border-b pb-3">Sobre este imóvel</h3>
                            <div class="prose prose-slate max-w-none text-slate-600 text-lg whitespace-pre-line leading-relaxed">
                                ${p.descricao || 'Sem descrição disponível.'}
                            </div>
                        </div>
                    </div>

                    <div class="space-y-8">
                        <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-6">
                            <h3 class="font-bold text-slate-900 text-xl">Detalhes</h3>
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
                                <p class="text-slate-700 font-medium">${p.bairro}, ${p.cidade} - ${p.uf}</p>
                                <p class="text-xs text-slate-400">Referência: ${p.referencia || 'N/I'}</p>
                            </div>

                            <a href="https://wa.me/5500000000000?text=Olá, tenho interesse no imóvel Ref ${p.referencia}: ${p.titulo}" 
                               target="_blank" 
                               class="block w-full text-center bg-emerald-500 text-white py-5 rounded-[2rem] font-bold text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100 active:scale-95">
                                Tenho Interesse via WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Erro ao carregar detalhe do imóvel:', err);
        container.innerHTML = '<p class="text-center py-20 text-red-500">Erro ao carregar detalhes do imóvel.</p>';
    }
}

document.addEventListener('DOMContentLoaded', initSite);
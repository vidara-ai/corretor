import { supabase } from './supabase.js';

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
        // PASSO 5 — CONSULTA DE IMÓVEIS (SEM EMBED)
        const { data: imoveis, error: imoveisError } = await supabase
          .from('imoveis')
          .select('*')
          .eq('ativo', true)
          .order('ordem_destaque', { ascending: true, nullsLast: true });

        if (imoveisError) {
          console.error('Erro ao buscar imóveis:', imoveisError);
          container.innerHTML = `<p class="col-span-full text-center text-red-500 py-10">Erro: ${imoveisError.message}</p>`;
          return;
        }

        // PASSO 6 — BUSCAR FOTOS (QUERY SEPARADA)
        const { data: fotos, error: fotosError } = await supabase
          .from('imoveis_fotos')
          .select('*')
          .eq('is_capa', true);

        if (fotosError) {
          console.error('Erro ao buscar fotos:', fotosError);
        }

        // PASSO 7 — MERGE MANUAL (SEM SUPABASE EMBED)
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

        // RENDERIZAÇÃO: Template do card ajustado conforme especificações de portal imobiliário
        container.innerHTML = imoveisComFoto.map(imovel => {
            // PASSO 3 — PREÇO (USAR APENAS CAMPOS EXISTENTES)
            const preco = imovel.valor_venda
              ? `R$ ${Number(imovel.valor_venda).toLocaleString('pt-BR')}`
              : (imovel.valor_locacao ? `R$ ${Number(imovel.valor_locacao).toLocaleString('pt-BR')}` : 'Sob consulta');

            // PASSO 8 — USAR A IMAGEM NO CARD
            const imagem = imovel.foto_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';

            return `
                <div class="card-imovel">
                    <div class="card-imagem">
                        <img src="${imagem}" alt="${imovel.titulo}">
                        <span class="badge-tipo">${imovel.tipo_imovel || 'Imóvel'}</span>
                        <span class="badge-local">${imovel.cidade}</span>
                    </div>

                    <div class="card-imovel-body imovel-card-content">
                        <span class="imovel-bairro">${imovel.bairro}</span>
                        <h3 class="imovel-titulo">${imovel.titulo}</h3>
                        
                        <div class="preco">
                            <strong>${preco}</strong>
                        </div>

                        <div class="imovel-info">
                            <div class="info-icons imovel-info-icons">
                                <span>🛏 ${imovel.dormitorios || 0}</span>
                                <span>🛁 ${imovel.banheiros || 0}</span>
                                <span>🚗 ${imovel.vagas_garagem || 0}</span>
                            </div>

                            <div class="imovel-ref-area">
                                Ref: ${imovel.referencia || 'N/I'} — Área: ${imovel.area_m2 || 0} m²
                            </div>
                        </div>

                        <a href="imovel.html?id=${imovel.id}" class="btn-detalhar">
                            Detalhar
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Erro crítico no site público:', err);
    }
}

/**
 * Carrega os detalhes de um imóvel específico
 */
async function loadPropertyDetail(id) {
    const container = document.getElementById('property-detail');
    if (!container) return;

    try {
        // Query de imóvel sem embed para evitar erro PGRST201
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

        // Busca fotos separadamente
        const { data: fotos, error: fError } = await supabase
            .from('imoveis_fotos')
            .select('*')
            .eq('imovel_id', id)
            .order('ordem', { ascending: true });

        const coverPhoto = fotos?.find(f => f.is_capa)?.url || fotos?.[0]?.url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
        const preco = p.valor_venda || p.valor_locacao || 0;

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start animate-in fade-in duration-700">
                <div class="space-y-4">
                    <img src="${coverPhoto}" class="w-full rounded-[2.5rem] shadow-2xl aspect-video object-cover" id="main-photo">
                    <div class="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                        ${fotos ? fotos.map(f => `
                            <img src="${f.url}" loading="lazy" class="rounded-2xl h-24 w-32 shrink-0 object-cover border-2 border-transparent hover:border-blue-600 cursor-pointer transition-all" onclick="document.getElementById('main-photo').src=this.src">
                        `).join('') : ''}
                    </div>
                </div>
                <div class="space-y-8">
                    <div class="inline-block bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                        ${p.tipo_imovel || 'Imóvel'}
                    </div>
                    <h1 class="text-4xl md:text-5xl font-black text-slate-900 leading-tight">${p.titulo}</h1>
                    <p class="text-4xl text-blue-600 font-black">R$ ${preco.toLocaleString('pt-BR')}</p>
                    <div class="prose prose-slate max-w-none text-slate-600 text-lg whitespace-pre-line leading-relaxed">
                        ${p.descricao || 'Sem descrição disponível.'}
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 pt-6">
                         <div class="bg-slate-50 p-4 rounded-2xl">
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Dormitórios</p>
                            <p class="text-slate-900 font-bold">${p.dormitorios || 0}</p>
                         </div>
                         <div class="bg-slate-50 p-4 rounded-2xl">
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Suítes</p>
                            <p class="text-slate-900 font-bold">${p.suites || 0}</p>
                         </div>
                    </div>

                    <a href="https://wa.me/5500000000000?text=Olá, tenho interesse no imóvel Ref ${p.referencia}: ${p.titulo}" target="_blank" class="block w-full text-center bg-emerald-500 text-white py-5 rounded-[2rem] font-bold text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100">
                        Tenho Interesse via WhatsApp
                    </a>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Erro ao carregar detalhe do imóvel:', err);
        container.innerHTML = '<p class="text-center py-20 text-red-500">Erro ao carregar detalhes do imóvel.</p>';
    }
}

document.addEventListener('DOMContentLoaded', initSite);
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
        // CORREÇÃO: Query atualizada para buscar todos os campos necessários para o card
        const { data: imoveis, error } = await supabase
            .from('imoveis')
            .select(`
                id,
                titulo,
                descricao,
                tipo_imovel,
                cidade,
                uf,
                valor_venda,
                valor_locacao,
                dormitorios,
                banheiros,
                vagas_garagem,
                area_m2,
                referencia
            `)
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(6);

        if (error) {
            console.error('Erro ao buscar imóveis:', error);
            container.innerHTML = `<p class="col-span-full text-center text-red-500 py-10">Erro ao carregar catálogo: ${error.message}</p>`;
            return;
        }

        if (!imoveis || imoveis.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-slate-400 py-10">Nenhum imóvel disponível no momento.</p>';
            return;
        }

        const imovelIds = imoveis.map(i => i.id);

        const { data: fotosData } = await supabase
          .from('imoveis_fotos')
          .select('imovel_id, url, is_capa')
          .in('imovel_id', imovelIds);

        const fotosPorImovel = {};
        fotosData?.forEach(f => {
          if (!fotosPorImovel[f.imovel_id]) {
            fotosPorImovel[f.imovel_id] = [];
          }
          fotosPorImovel[f.imovel_id].push(f);
        });

        // RENDERIZAÇÃO: Template do card ajustado conforme especificações de portal imobiliário
        container.innerHTML = imoveis.map(imovel => {
            const fotos = fotosPorImovel[imovel.id] || [];
            const capa = fotos.find(f => f.is_capa)?.url || 
                         fotos[0]?.url || 
                         'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
            
            const preco = imovel.valor_venda || imovel.valor_locacao || 0;
            const precoFormatado = preco > 0 ? `R$ ${preco.toLocaleString('pt-BR')}` : 'Sob consulta';

            return `
                <div class="card-imovel">
                    <div class="card-imagem">
                        <img src="${capa}" alt="${imovel.titulo}">
                        <span class="badge-tipo">${imovel.tipo_imovel || 'Imóvel'}</span>
                        <span class="badge-local">${imovel.cidade || 'Localização'} - ${imovel.uf || 'UF'}</span>
                    </div>

                    <div class="card-imovel-body">
                        <h3 class="titulo">${imovel.titulo}</h3>
                        
                        <div class="preco">
                            <strong>${precoFormatado}</strong>
                        </div>

                        <div class="info-icons">
                            🛏 ${imovel.dormitorios || 0} | 🛁 ${imovel.banheiros || 0} | 🚗 ${imovel.vagas_garagem || 0}
                        </div>

                        <div class="info-extra">
                            Ref: ${imovel.referencia || 'N/I'} — Área: ${imovel.area_m2 || 0} m²
                        </div>

                        <p class="descricao">${imovel.descricao || ''}</p>

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
        const { data: p, error } = await supabase
            .from('imoveis')
            .select(`
                *, 
                imoveis_fotos:imoveis_fotos!imoveis_fotos_imovel_fk (*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!p) {
            container.innerHTML = '<p class="text-center py-20 text-slate-500">Imóvel não encontrado.</p>';
            return;
        }

        const coverPhoto = p.imoveis_fotos?.find(f => f.is_capa)?.url || p.imoveis_fotos?.[0]?.url || '';
        const preco = p.valor_venda || p.valor_locacao || 0;

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start animate-in fade-in duration-700">
                <div class="space-y-4">
                    <img src="${coverPhoto}" class="w-full rounded-[2.5rem] shadow-2xl aspect-video object-cover" id="main-photo">
                    <div class="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                        ${p.imoveis_fotos ? p.imoveis_fotos.map(f => `
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
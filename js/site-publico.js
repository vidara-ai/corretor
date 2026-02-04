import { supabase } from './supabase.js';

/**
 * Inicialização do Site Público
 */
async function initSite() {
    const params = new URLSearchParams(window.location.search);
    const propertyId = params.get('id');
    const isDetailPage = window.location.pathname.includes('imovel.html');

    try {
        const { data: config, error: configError } = await supabase
            .from('configuracoes_site')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (config && !configError) {
            applySiteSettings(config);
        }
    } catch (err) {
        console.warn('Erro nas configurações:', err);
    }

    if (isDetailPage && propertyId) {
        loadPropertyDetail(propertyId);
    } else {
        loadHomeProperties();
    }
}

function applySiteSettings(config) {
    const logoText = document.getElementById('site-logo-text');
    if (logoText) logoText.innerText = config.titulo_header || 'ImobiMaster';
    
    const heroTitle = document.querySelector('header h1');
    if (heroTitle && config.hero_titulo) heroTitle.innerText = config.hero_titulo;

    const heroSub = document.querySelector('header p');
    if (heroSub && config.hero_subtitulo) heroSub.innerText = config.hero_subtitulo;

    const footerText = document.getElementById('footer-copyright-text');
    if (footerText) footerText.innerText = config.rodape_texto || '© ImobiMaster';
}

async function loadHomeProperties() {
    const container = document.getElementById('lista-imoveis');
    if (!container) return;

    try {
        const { data: imoveis, error } = await supabase
            .from('imoveis')
            .select(`
                id,
                titulo,
                descricao,
                tipo_imovel,
                cidade,
                uf,
                dormitorios,
                banheiros,
                vagas_garagem,
                area_m2,
                referencia,
                valor_venda,
                valor_locacao,
                ativo
            `)
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(6);

        if (error) throw error;

        const imovelIds = imoveis.map(i => i.id);
        const { data: fotosData } = await supabase
          .from('imoveis_fotos')
          .select('imovel_id, url, is_capa')
          .in('imovel_id', imovelIds);

        const fotosPorImovel = {};
        fotosData?.forEach(f => {
          if (!fotosPorImovel[f.imovel_id]) fotosPorImovel[f.imovel_id] = [];
          fotosPorImovel[f.imovel_id].push(f);
        });

        container.innerHTML = imoveis.map(imovel => {
            const fotos = fotosPorImovel[imovel.id] || [];
            const capaUrl = fotos.find(f => f.is_capa)?.url || 
                            fotos[0]?.url || 
                            'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';
            
            const valor = imovel.valor_venda || imovel.valor_locacao || 0;
            const finalidade = imovel.valor_venda ? 'VENDA' : 'LOCAÇÃO';

            return `
                <div class="card-imovel">
                  <div class="card-imovel-img">
                    <img src="${capaUrl}" alt="${imovel.titulo}">
                    <span class="tag-tipo">${imovel.tipo_imovel || 'Imóvel'}</span>
                    <span class="tag-local">${imovel.cidade || 'Localização'} - ${imovel.uf || 'UF'}</span>
                  </div>

                  <div class="card-imovel-body">
                    <h3 class="titulo">${imovel.titulo}</h3>
                    <p class="descricao">${imovel.descricao || ''}</p>

                    <div class="info-icons">
                      <span>🛏 ${imovel.dormitorios || 0}</span>
                      <span>🛁 ${imovel.banheiros || 0}</span>
                      <span>🚗 ${imovel.vagas_garagem || 0}</span>
                    </div>

                    <div class="info-extra">
                      <span>Ref: ${imovel.referencia || 'N/I'}</span>
                      <span>Área: ${imovel.area_m2 || 0} m²</span>
                    </div>

                    <div class="preco">
                      <span class="finalidade">${finalidade}</span>
                      <strong>R$ ${valor.toLocaleString('pt-BR')}</strong>
                    </div>

                    <a href="imovel.html?id=${imovel.id}" class="btn-detalhar">
                      Detalhar
                    </a>
                  </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Erro ao carregar imóveis:', err);
    }
}

async function loadPropertyDetail(id) {
    const container = document.getElementById('property-detail');
    if (!container) return;

    try {
        const { data: p, error } = await supabase
            .from('imoveis')
            .select(`*, imoveis_fotos:imoveis_fotos!imoveis_fotos_imovel_fk (*)`)
            .eq('id', id)
            .single();

        if (error || !p) return;

        const coverPhoto = p.imoveis_fotos?.find(f => f.is_capa)?.url || p.imoveis_fotos?.[0]?.url || '';
        const preco = p.valor_venda || p.valor_locacao || 0;

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                <div class="space-y-4">
                    <img src="${coverPhoto}" class="w-full rounded-[2.5rem] shadow-2xl aspect-video object-cover" id="main-photo">
                    <div class="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                        ${p.imoveis_fotos ? p.imoveis_fotos.map(f => `
                            <img src="${f.url}" class="rounded-2xl h-24 w-32 shrink-0 object-cover border-2 border-transparent hover:border-blue-600 cursor-pointer transition-all" onclick="document.getElementById('main-photo').src=this.src">
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
                        ${p.descricao || ''}
                    </div>
                    <a href="https://wa.me/5500000000000?text=Olá, tenho interesse no imóvel Ref ${p.referencia}: ${p.titulo}" target="_blank" class="block w-full text-center bg-emerald-500 text-white py-5 rounded-[2rem] font-bold text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100">
                        Tenho Interesse via WhatsApp
                    </a>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Erro:', err);
    }
}

document.addEventListener('DOMContentLoaded', initSite);
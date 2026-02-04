import { supabase } from './supabase.js';

function setMeta(name, content) {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
    if (!el) {
        el = document.createElement('meta');
        if (name.startsWith('og:')) el.setAttribute('property', name);
        else el.setAttribute('name', name);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

function applySiteSettings(data) {
    if (!data) return;
    const logoContainer = document.querySelector('nav a[href="index.html"]');
    if (logoContainer) {
        logoContainer.innerHTML = `<span class="bg-blue-600 p-1.5 rounded text-white font-serif">I</span> ${data.titulo_header}`;
    }
    const heroTitle = document.querySelector('header h1');
    const heroSub = document.querySelector('header p');
    const heroSection = document.querySelector('header');
    if (heroTitle) heroTitle.innerText = data.hero_titulo;
    if (heroSub) heroSub.innerText = data.hero_subtitulo;
    if (heroSection && data.hero_imagem_url) {
        heroSection.style.backgroundImage = `linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.8)), url('${data.hero_imagem_url}')`;
        heroSection.style.backgroundSize = 'cover';
        heroSection.style.backgroundPosition = 'center';
    }
    const footerText = document.getElementById('footer-copyright-text');
    if (footerText) footerText.innerText = data.rodape_texto;
}

/**
 * 1️⃣ NOVO HTML GERADO PARA O CARD (FORMATO EXATO)
 */
function createPropertyCard(imovel) {
    const capa = imovel.imoveis_fotos?.find(f => f.is_capa)?.url || 
                 imovel.imoveis_fotos?.[0]?.url || 
                 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=600';

    return `
      <article class="card-imovel">
        <div class="card-img">
          <img src="${capa}" alt="${imovel.titulo}">
          <span class="badge tipo">${imovel.tipo_imovel}</span>
          <span class="badge cidade">${imovel.cidade || ''}</span>
        </div>

        <div class="card-body">
          <h4 class="nome">${imovel.titulo}</h4>
          <p class="descricao">${imovel.descricao || ''}</p>

          <div class="icons">
            <span>🛏 ${imovel.dormitorios || 0}</span>
            <span>🛁 ${imovel.suites || 0}</span>
            <span>🚗 ${imovel.vagas_garagem || 0}</span>
          </div>

          <div class="meta">
            <span>Ref: <strong>${imovel.referencia || ''}</strong></span>
            <span>Área: <strong>${imovel.area_m2 || 0}m²</strong></span>
          </div>

          <div class="preco">
            ${imovel.valor_venda
              ? `VENDA<br><strong>R$ ${imovel.valor_venda.toLocaleString('pt-BR')}</strong>`
              : ''}
          </div>

          <a href="imovel.html?slug=${imovel.slug}" class="btn-detalhar">
            Detalhar
          </a>
        </div>
      </article>
    `;
}

function displayPropertyDetail(p) {
    const container = document.getElementById('property-detail');
    if (!container || !p) return;
    
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
                <h1 class="text-4xl md:text-5xl font-black text-slate-900 leading-tight">${p.titulo}</h1>
                <p class="text-4xl text-blue-600 font-black">R$ ${preco.toLocaleString('pt-BR')}</p>
                <div class="prose prose-slate max-w-none text-slate-600 text-lg whitespace-pre-line">${p.descricao}</div>
            </div>
        </div>
    `;
}

/**
 * 2️⃣ GARANTA QUE O SELECT TRAGA TODOS OS CAMPOS E USE O GRID CORRETO
 */
async function initSite() {
    const isDetail = window.location.pathname.includes('imovel.html');
    const params = new URLSearchParams(window.location.search);
    const detailId = params.get('id');
    const slug = params.get('slug');

    try {
        const promises = [supabase.from('configuracoes_site').select('*').eq('id', 1).single()];
        
        // SELECT REQUISITADO
        const selectFields = `
          id,
          titulo,
          slug,
          descricao,
          tipo_imovel,
          cidade,
          dormitorios,
          suites,
          vagas_garagem,
          referencia,
          area_m2,
          valor_venda,
          imoveis_fotos (
            url,
            is_capa
          )
        `;

        if (isDetail) {
            if (slug) {
                promises.push(supabase.from('imoveis').select(selectFields).eq('slug', slug).single());
            } else if (detailId) {
                promises.push(supabase.from('imoveis').select(selectFields).eq('id', detailId).single());
            }
        } else {
            promises.push(supabase.from('imoveis').select(selectFields).eq('ativo', true));
        }

        const results = await Promise.all(promises);
        if (results[0].data) applySiteSettings(results[0].data);

        if (isDetail && results[1]?.data) {
            displayPropertyDetail(results[1].data);
        } else if (!isDetail && results[1]?.data) {
            // ALVO CORRETO: regular-grid
            const regularGrid = document.getElementById('regular-grid');
            const featuredGrid = document.getElementById('featured-grid');
            
            if (regularGrid) {
                // Renderização no container correto
                regularGrid.innerHTML = results[1].data.map(p => createPropertyCard(p)).join('');
            }

            if (featuredGrid) {
                const featured = results[1].data.filter(p => p.destaque);
                if (featured.length > 0) {
                   document.getElementById('featured-section')?.classList.remove('hidden');
                   featuredGrid.innerHTML = featured.map(p => createPropertyCard(p)).join('');
                }
            }
        }
    } catch (err) { console.error(err); }
}

document.addEventListener('DOMContentLoaded', initSite);
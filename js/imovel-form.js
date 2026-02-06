import { supabase } from './supabase.js';

const params = new URLSearchParams(window.location.search);
const propertyId = params.get('id');

// Estado local
let selectedImovelFeatures = new Set();
let selectedCondoFeatures = new Set();
let uploadedPhotos = [];

// ETAPA 1 — ESTADO (CRIAR)
let opcoesPagamento = [];
let garantiasLocacao = [];

// Listas de Características (Mantidas na UI para experiência do usuário)
const LISTA_IMOVEL = [
    "Ar condicionado", "Área de serviço", "Armário na cozinha", "Armário no quarto", 
    "Armários projetados", "Box no banheiro", "Caixa d’água", "Cisterna", 
    "Dependência de empregada", "Quarto de empregada", "WC serviço", "Sala de estar", "Parcialmente Mobiliado"
    "Sala de jantar", "Sala de visita", "Varanda", "Varanda na sala", "Tela na varanda", "Mobiliado"
    "Nascente", "Rua asfaltada", "Piscina privativa", "Churrasqueira", "Jardim", 
    "Quintal", "Escritório / Home office", "Closet", "Lavabo", "Pé-direito alto", "Energia solar"
];

const LISTA_CONDOMINIO = [
    "Acessível para deficientes", "Elevador", "Portaria 24h", "Guarita", "Portão eletrônico", 
    "Gerador", "Bicicletário", "Brinquedoteca", "Playground", "Espaço gourmet", 
    "Salão de festas", "Piscina (condomínio)", "Quadra poliesportiva (condomínio)", 
    "Campo de futebol (condomínio)", "Condomínio fechado", "Rua asfaltada (condomínio)", 
    "Poço artesiano", "Academia", "Coworking", "Mercado interno", "Pet place"
];

/**
 * Converte um arquivo de imagem para WebP no cliente usando Canvas API.
 * Realiza limpeza de memória do canvas após processamento.
 * @param {File} file - Arquivo original (JPG, PNG, etc)
 * @returns {Promise<File>} - Nova instância de File no formato WebP
 */
async function convertToWebP(file) {
  // Se já for WebP, não processa novamente para evitar perda de qualidade desnecessária
  if (file.type === 'image/webp') return file;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          // Limpeza defensiva de memória do Canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = canvas.height = 0;

          if (!blob) return reject(new Error('Erro ao gerar blob WebP.'));
          
          const fileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
          const webpFile = new File([blob], fileName, { type: 'image/webp' });
          resolve(webpFile);
        }, 'image/webp', 0.8);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Realiza validação de tipo, conversão WebP condicional e upload duplo (Original + WebP).
 */
async function uploadFoto(file, imovelId, ordem, isCapa) {
  // Validação estrita de tipo de arquivo
  if (!file.type.startsWith('image/')) {
    throw new Error(`O arquivo ${file.name} não é uma imagem válida.`);
  }

  try {
    // Converter para WebP apenas se necessário
    const webpFile = file.type === 'image/webp' ? file : await convertToWebP(file);

    const baseUuid = crypto.randomUUID();
    const ext = file.name.split('.').pop();

    const originalPath = `${imovelId}/raw_${baseUuid}.${ext}`;
    const webpPath = `${imovelId}/${baseUuid}.webp`;

    // Upload do arquivo ORIGINAL com hardening (upsert: false e contentType explícito)
    const { error: originalError } = await supabase
      .storage
      .from('imoveis')
      .upload(originalPath, file, {
        upsert: false,
        contentType: file.type
      });

    if (originalError) throw originalError;

    // Upload do arquivo WebP com hardening
    const { error: webpError } = await supabase
      .storage
      .from('imoveis')
      .upload(webpPath, webpFile, {
        upsert: false,
        contentType: 'image/webp'
      });

    if (webpError) throw webpError;

    // Obter URL pública da versão WebP
    const { data } = supabase
      .storage
      .from('imoveis')
      .getPublicUrl(webpPath);

    // Persistência no banco de dados (Apenas URL do WebP)
    const { error: dbError } = await supabase
      .from('imoveis_fotos')
      .insert({
        imovel_id: imovelId,
        url: data.publicUrl,
        ordem: ordem,
        is_capa: isCapa
      });

    if (dbError) throw dbError;
  } catch (err) {
    console.error('Erro no processamento da imagem:', err);
    throw err;
  }
}

/**
 * Renderiza Chips
 */
function renderAllChips() {
    renderChips('imovel-features-container', LISTA_IMOVEL, selectedImovelFeatures);
    renderChips('condominio-features-container', LISTA_CONDOMINIO, selectedCondoFeatures);
}

function renderChips(containerId, list, selectedSet) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = list.map(item => {
        const isActive = selectedSet.has(item);
        return `
            <button type="button" 
                onclick="window.toggleFeature('${containerId}', '${item}')"
                class="px-4 py-2 rounded-full border text-xs font-bold transition-all select-none
                ${isActive ? 'chip-active' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}">
                ${item}
            </button>
        `;
    }).join('');
}

window.toggleFeature = (containerId, item) => {
    const set = containerId === 'imovel-features-container' ? selectedImovelFeatures : selectedCondoFeatures;
    if (set.has(item)) set.delete(item);
    else set.add(item);
    renderAllChips();
};

/**
 * Inicialização
 */
function generateImovelCode() {
    const d = new Date();
    const code = `${d.getFullYear().toString().slice(-2)}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}${d.getHours().toString().padStart(2, '0')}${d.getMinutes().toString().padStart(2, '0')}`;
    const el = document.getElementById('f-codigo');
    if (el) el.value = code;
}

async function init() {
    renderAllChips();
    
    const checkboxes = document.querySelectorAll('input[name="negociacao"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const valor = e.target.value;
            const isPagamento = ["financiamento", "fgts", "carta_credito", "permuta"].includes(valor);
            const isGarantia = ["fiador", "caucao"].includes(valor);

            if (isPagamento) {
                if (e.target.checked) {
                    if (!opcoesPagamento.includes(valor)) {
                        opcoesPagamento.push(valor);
                    }
                } else {
                    opcoesPagamento = opcoesPagamento.filter(item => item !== valor);
                }
            } else if (isGarantia) {
                if (e.target.checked) {
                    if (!garantiasLocacao.includes(valor)) {
                        garantiasLocacao.push(valor);
                    }
                } else {
                    garantiasLocacao = garantiasLocacao.filter(item => item !== valor);
                }
            }
        });
    });

    if (propertyId) {
        document.getElementById('page-title').innerText = 'Editar Imóvel';
        document.getElementById('btn-save-text').innerText = 'Atualizar Imóvel';
        await loadPropertyData(propertyId);
    } else {
        generateImovelCode();
    }
}

async function loadPropertyData(id) {
    try {
        const { data: p, error } = await supabase.from('imoveis').select('*').eq('id', id).single();
        if (error) throw error;

        document.getElementById('f-referencia').value = p.referencia || '';
        document.getElementById('f-codigo').value = p.codigo_imovel || '';
        document.getElementById('f-title').value = p.titulo || '';
        document.getElementById('f-price').value = p.valor_venda || p.valor_locacao || '';
        document.getElementById('f-tipo').value = p.tipo_imovel || 'casa';
        document.getElementById('f-status').value = p.status_imovel || 'ativo';
        
        if (p.finalidade) {
            document.getElementById('f-finalidade').value = p.finalidade;
        } else {
            document.getElementById('f-finalidade').value = p.valor_locacao > 0 ? 'Aluguel' : 'Venda';
        }

        document.getElementById('f-rooms').value = p.dormitorios || 0;
        document.getElementById('f-suites').value = p.suites || 0;
        document.getElementById('f-bathrooms').value = p.banheiros || 0;
        document.getElementById('f-vagas').value = p.vagas_garagem || 0;
        document.getElementById('f-area').value = p.area_m2 || '';
        document.getElementById('f-description').value = p.descricao || '';
        document.getElementById('f-featured').checked = p.destaque || false;
        
        document.getElementById('f-bairro').value = p.bairro || '';
        document.getElementById('f-cidade').value = p.cidade || '';
        document.getElementById('f-uf').value = p.uf || '';

        if (p.caracteristicas_imovel) selectedImovelFeatures = new Set(p.caracteristicas_imovel);
        if (p.caracteristicas_condominio) selectedCondoFeatures = new Set(p.caracteristicas_condominio);
        renderAllChips();

        if (p.opcoes_pagamento) {
            opcoesPagamento = p.opcoes_pagamento;
            opcoesPagamento.forEach(val => {
                const cb = document.querySelector(`input[name="negociacao"][value="${val}"]`);
                if (cb) cb.checked = true;
            });
        }
        if (p.garantias_locacao) {
            garantiasLocacao = p.garantias_locacao;
            garantiasLocacao.forEach(val => {
                const cb = document.querySelector(`input[name="negociacao"][value="${val}"]`);
                if (cb) cb.checked = true;
            });
        }

        const { data: photos } = await supabase.from('imoveis_fotos').select('*').eq('imovel_id', id).order('is_capa', { ascending: false }).order('ordem', { ascending: true });
        if (photos) {
            uploadedPhotos = photos.map(ph => ({ id: ph.id, url: ph.url, isCover: ph.is_capa, existing: true }));
            renderPhotoGrid();
        }

    } catch (err) {
        console.error('Erro ao carregar imóvel:', err);
    }
}

/**
 * Gestão de Fotos
 */
const dropzone = document.getElementById('photo-dropzone');
const fileInput = document.getElementById('f-photos');
if (dropzone) dropzone.onclick = () => fileInput.click();
if (fileInput) fileInput.onchange = (e) => handleFiles(e.target.files);

function handleFiles(files) {
    const newFiles = Array.from(files);
    
    // Validação básica de tipo antes de adicionar ao estado
    const onlyImages = newFiles.filter(f => f.type.startsWith('image/'));
    if (onlyImages.length !== newFiles.length) {
        alert('Alguns arquivos foram ignorados. Apenas imagens são permitidas.');
    }

    if (uploadedPhotos.length + onlyImages.length > 15) return alert('Máximo 15 fotos.');

    onlyImages.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedPhotos.push({ file, preview: e.target.result, isCover: uploadedPhotos.length === 0, existing: false });
            renderPhotoGrid();
        };
        reader.readAsDataURL(file);
    });
}

function renderPhotoGrid() {
    const grid = document.getElementById('photo-grid');
    if (!grid) return;
    grid.innerHTML = uploadedPhotos.map((img, idx) => `
        <div class="relative group rounded-xl overflow-hidden aspect-square border-2 ${img.isCover ? 'border-blue-500' : 'border-slate-100'}">
            <img src="${img.existing ? img.url : img.preview}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <button type="button" onclick="window.removePhoto(${idx})" class="bg-red-500 text-white p-2 rounded-full shadow-lg">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
            ${img.isCover ? '<span class="absolute top-2 left-2 bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded">CAPA</span>' : ''}
        </div>
    `).join('');
}

window.removePhoto = (idx) => {
    uploadedPhotos.splice(idx, 1);
    if (uploadedPhotos.length > 0 && !uploadedPhotos.some(p => p.isCover)) uploadedPhotos[0].isCover = true;
    renderPhotoGrid();
};

function slugify(text) {
    return text.toString().toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Salvamento
 */
document.getElementById('property-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    const btnText = document.getElementById('btn-save-text');
    btn.disabled = true;
    btnText.innerText = 'Salvando...';

    const titulo = document.getElementById('f-title').value;
    const preco = Number(document.getElementById('f-price').value);
    const finalidade = document.getElementById('f-finalidade').value;
    
    const bairro = document.getElementById('f-bairro').value;
    const cidade = document.getElementById('f-cidade').value;
    const uf = document.getElementById('f-uf').value;

    const caracteristicasImovel = Array.from(selectedImovelFeatures);
    const caracteristicasCondominio = Array.from(selectedCondoFeatures);

    try {
        const payload = {
            codigo_imovel: document.getElementById('f-codigo').value,
            referencia: document.getElementById('f-referencia').value || null,
            titulo: titulo,
            slug: slugify(titulo),
            descricao: document.getElementById('f-description').value,
            tipo_imovel: document.getElementById('f-tipo').value,
            status_imovel: document.getElementById('f-status').value,
            finalidade: finalidade,
            dormitorios: Number(document.getElementById('f-rooms').value || 0),
            suites: Number(document.getElementById('f-suites').value || 0),
            banheiros: Number(document.getElementById('f-bathrooms').value || 0),
            vagas_garagem: Number(document.getElementById('f-vagas').value || 0),
            area_m2: Number(document.getElementById('f-area').value || 0),
            area_privativa: Number(document.getElementById('f-area').value || 0),
            area_total: Number(document.getElementById('f-area').value || 0),
            ativo: document.getElementById('f-status').value === 'ativo',
            destaque: document.getElementById('f-featured').checked,
            updated_at: new Date().toISOString(),
            bairro: bairro,
            cidade: cidade,
            uf: uf,
            caracteristicas_imovel: caracteristicasImovel,
            caracteristicas_condominio: caracteristicasCondominio,
            opcoes_pagamento: opcoesPagamento,
            garantias_locacao: garantiasLocacao
        };

        if (finalidade === 'Venda') {
            payload.valor_venda = preco;
            payload.valor_locacao = null;
        } else {
            payload.valor_locacao = preco;
            payload.valor_venda = null;
        }

        if (!propertyId) {
            payload.created_at = new Date().toISOString();
        }

        let response;
        if (propertyId) {
            response = await supabase.from('imoveis').update(payload).eq('id', propertyId).select();
        } else {
            response = await supabase.from('imoveis').insert(payload).select();
        }

        if (response.error) throw response.error;

        const imovelSalvo = response.data[0];

        if (propertyId) {
            const idsKeep = uploadedPhotos.filter(p => p.existing).map(p => p.id);
            if (idsKeep.length > 0) {
                await supabase.from('imoveis_fotos').delete().eq('imovel_id', imovelSalvo.id).not('id', 'in', `(${idsKeep.join(',')})`);
            } else {
                await supabase.from('imoveis_fotos').delete().eq('imovel_id', imovelSalvo.id);
            }
        }

        const novasFotos = uploadedPhotos.filter(p => !p.existing);
        for (let i = 0; i < novasFotos.length; i++) {
            await uploadFoto(novasFotos[i].file, imovelSalvo.id, i, novasFotos[i].isCover);
        }

        alert('Imóvel salvo com sucesso!');
        window.location.href = 'imoveis.html';
    } catch (err) {
        console.error('Erro ao salvar:', err);
        alert(err.message || 'Erro ao salvar imóvel.');
    } finally {
        btn.disabled = false;
        btnText.innerText = propertyId ? 'Atualizar Imóvel' : 'Salvar Imóvel';
    }
};

init();
import { supabase } from './supabase.js';

/**
 * Busca e renderiza a lista de imóveis com ordenação priorizada
 */
async function loadProperties() {
    try {
        const { data: properties, error } = await supabase
            .from('imoveis')
            .select('*')
            .order('destaque', { ascending: false })
            .order('ordem_destaque', { ascending: true, nullsLast: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderProperties(properties || []);
    } catch (err) {
        console.error('Erro ao carregar imóveis:', err.message);
        const feedback = `<p class="p-10 text-center text-red-500 font-medium">Erro ao carregar dados: ${err.message}</p>`;
        
        const tableBody = document.getElementById('properties-table-body');
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="5">${feedback}</td></tr>`;
        
        const mobileContainer = document.getElementById('properties-cards-mobile');
        if (mobileContainer) mobileContainer.innerHTML = feedback;
    }
}

/**
 * Gera as linhas da tabela e cards mobile dinamicamente
 */
function renderProperties(properties) {
    const tableBody = document.getElementById('properties-table-body');
    const mobileCards = document.getElementById('properties-cards-mobile');
    
    if (!tableBody || !mobileCards) return;

    if (properties.length === 0) {
        const emptyState = `
            <div class="p-20 text-center text-slate-400">
                Nenhum imóvel cadastrado. <a href="imovel-form.html" class="text-blue-600 underline">Comece agora</a>.
            </div>
        `;
        tableBody.innerHTML = `<tr><td colspan="5">${emptyState}</td></tr>`;
        mobileCards.innerHTML = emptyState;
        return;
    }

    // Render Tabela (Desktop)
    tableBody.innerHTML = properties.map(p => {
        const preco = p.valor_venda || p.valor_locacao || 0;
        const priceFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco);
        const statusClass = p.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500';
        const statusLabel = p.ativo ? (p.status_imovel || 'Ativo') : 'Inativo';
        const featuredBadge = p.destaque ? `<span class="ml-2 inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">⭐ Destaque</span>` : '';
        const refText = p.referencia || `#${p.id.toString().slice(-4)}`;

        return `
            <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group ${p.destaque ? 'bg-amber-50/20' : ''}">
                <td class="p-5 text-sm font-mono text-slate-400">${refText}</td>
                <td class="p-5">
                    <div class="flex items-center">
                        <p class="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">${p.titulo}</p>
                        ${featuredBadge}
                    </div>
                </td>
                <td class="p-5 text-sm font-semibold text-slate-700">${priceFormatted}</td>
                <td class="p-5 text-center">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}">
                        ${statusLabel}
                    </span>
                </td>
                <td class="p-5 text-right">
                    <div class="flex justify-end items-center gap-2">
                        <button onclick="window.location.href='imovel-form.html?id=${p.id}'" class="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Editar">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                        <button data-id="${p.id}" class="btn-duplicate-imovel p-2 text-slate-400 hover:text-emerald-600 transition-colors" title="Duplicar imóvel">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                        </button>
                        <button data-id="${p.id}" class="btn-delete p-2 text-slate-400 hover:text-red-600 transition-colors" title="Excluir">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    setupTableActions();
}

/**
 * Lógica de duplicação de imóvel
 */
function gerarNovoCodigo() {
    const d = new Date();
    return `${d.getFullYear().toString().slice(-2)}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}${d.getHours().toString().padStart(2, '0')}${d.getMinutes().toString().padStart(2, '0')}`;
}

async function duplicarImovel(id) {
    const { data: imovel, error } = await supabase
        .from('imoveis')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        alert('Erro ao buscar imóvel original.');
        return;
    }

    // ETAPA 4 — AJUSTAR DADOS ANTES DE INSERIR
    delete imovel.id;
    delete imovel.created_at;
    delete imovel.updated_at;

    imovel.codigo_imovel = gerarNovoCodigo();
    imovel.slug = imovel.slug + '-copia';
    imovel.ativo = false;
    imovel.destaque = false;

    const { error: insertError } = await supabase
        .from('imoveis')
        .insert([imovel]);

    if (insertError) {
        console.error('Erro ao duplicar:', insertError);
        alert('Erro ao duplicar imóvel: ' + insertError.message);
        return;
    }

    alert('Imóvel duplicado com sucesso! A cópia está inativa.');
    window.location.reload();
}

/**
 * ETAPA 2 — EVENTO DE CLICK
 */
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-duplicate-imovel');
    if (btn) {
        const imovelId = btn.dataset.id;
        duplicarImovel(imovelId);
    }
});

function setupTableActions() {
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async (e) => {
            if (!confirm('Excluir este imóvel definitivamente?')) return;
            const id = btn.dataset.id;
            const { error } = await supabase.from('imoveis').delete().eq('id', id);
            if (!error) loadProperties();
            else alert('Erro: ' + error.message);
        };
    });
}

document.addEventListener('DOMContentLoaded', loadProperties);
import { supabase } from './supabase.js';

async function loadLeads() {
    try {
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderLeads(leads || []);
    } catch (err) {
        console.error('Erro:', err.message);
        const feedback = `<p class="p-10 text-center text-red-500">Erro ao carregar banco de dados.</p>`;
        document.getElementById('leads-table-body').innerHTML = `<tr><td colspan="5">${feedback}</td></tr>`;
        document.getElementById('leads-cards-mobile').innerHTML = feedback;
    }
}

function renderLeads(leads) {
    const tableBody = document.getElementById('leads-table-body');
    const mobileCards = document.getElementById('leads-cards-mobile');
    if (!tableBody || !mobileCards) return;

    if (leads.length === 0) {
        const empty = `<p class="p-20 text-center text-slate-400">Nenhum lead recebido.</p>`;
        tableBody.innerHTML = `<tr><td colspan="5">${empty}</td></tr>`;
        mobileCards.innerHTML = empty;
        return;
    }

    // Desktop
    tableBody.innerHTML = leads.map(l => {
        const date = new Date(l.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const originClass = l.origem === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700';

        return `
            <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td class="p-5">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                            ${l.nome ? l.nome.charAt(0).toUpperCase() : '?'}
                        </div>
                        <p class="font-bold text-slate-900">${l.nome || 'N/I'}</p>
                    </div>
                </td>
                <td class="p-5 text-sm">
                    <p class="text-slate-700 font-medium">${l.telefone || ''}</p>
                    <p class="text-xs text-slate-400">${l.email || ''}</p>
                </td>
                <td class="p-5">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${originClass}">
                        ${l.origem || 'Site'}
                    </span>
                </td>
                <td class="p-5 text-sm font-medium text-slate-700">${l.imovel_interesse || 'Geral'}</td>
                <td class="p-5 text-sm text-slate-400">${date}</td>
            </tr>
        `;
    }).join('');

    // Mobile
    mobileCards.innerHTML = leads.map(l => {
        const date = new Date(l.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const originClass = l.origem === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700';

        return `
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                            ${l.nome ? l.nome.charAt(0).toUpperCase() : '?'}
                        </div>
                        <h3 class="font-bold text-slate-900">${l.nome || 'Cliente'}</h3>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${originClass}">
                        ${l.origem || 'Site'}
                    </span>
                </div>
                <div class="space-y-1">
                    <p class="text-sm font-semibold text-slate-700">📞 ${l.telefone || 'N/I'}</p>
                    <p class="text-xs text-slate-500">🏠 ${l.imovel_interesse || 'Interesse Geral'}</p>
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-slate-50">
                    <p class="text-[10px] text-slate-400">${date}</p>
                    <a href="tel:${l.telefone}" class="text-blue-600 font-bold text-xs">Ligar Agora</a>
                </div>
            </div>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', loadLeads);
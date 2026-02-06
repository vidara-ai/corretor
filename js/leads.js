
import { supabase } from './supabase.js';

let allLeads = [];
let filteredLeads = [];

/**
 * Carrega os leads do banco de dados
 */
async function loadLeads() {
    try {
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        allLeads = leads || [];
        filteredLeads = [...allLeads];
        
        renderLeads(filteredLeads);
        setupFilters();
    } catch (err) {
        console.error('Erro ao carregar leads:', err.message);
        const feedback = `<div class="col-span-full p-10 text-center text-red-500 font-bold">Erro ao acessar o banco de dados.</div>`;
        document.getElementById('leads-container').innerHTML = feedback;
    }
}

/**
 * Configura os listeners dos filtros
 */
function setupFilters() {
    const originFilter = document.getElementById('filter-origin');
    const interestFilter = document.getElementById('filter-interest');
    const dateStartFilter = document.getElementById('filter-date-start');
    const dateEndFilter = document.getElementById('filter-date-end');
    const clearBtn = document.getElementById('btn-clear-filters');
    const exportBtn = document.getElementById('btn-export-csv');

    const apply = () => {
        const origin = originFilter.value;
        const interest = interestFilter.value.toLowerCase();
        const start = dateStartFilter.value;
        const end = dateEndFilter.value;

        filteredLeads = allLeads.filter(l => {
            const matchesOrigin = !origin || l.origem === origin;
            const matchesInterest = !interest || (l.imovel_interesse || '').toLowerCase().includes(interest);
            
            // Lógica de Data
            let matchesDate = true;
            if (start || end) {
                const leadDate = new Date(l.created_at).toISOString().split('T')[0];
                if (start && leadDate < start) matchesDate = false;
                if (end && leadDate > end) matchesDate = false;
            }

            return matchesOrigin && matchesInterest && matchesDate;
        });

        renderLeads(filteredLeads);
    };

    originFilter.addEventListener('change', apply);
    interestFilter.addEventListener('input', apply);
    dateStartFilter.addEventListener('change', apply);
    dateEndFilter.addEventListener('change', apply);

    clearBtn.addEventListener('click', () => {
        originFilter.value = '';
        interestFilter.value = '';
        dateStartFilter.value = '';
        dateEndFilter.value = '';
        filteredLeads = [...allLeads];
        renderLeads(filteredLeads);
    });

    exportBtn.addEventListener('click', () => {
        if (filteredLeads.length === 0) {
            alert('Não há leads para exportar com os filtros atuais.');
            return;
        }
        exportLeadsToCSV(filteredLeads);
    });
}

/**
 * Renderiza os leads em formato de cards responsivos
 */
function renderLeads(leads) {
    const container = document.getElementById('leads-container');
    if (!container) return;

    if (leads.length === 0) {
        container.innerHTML = `<div class="col-span-full p-20 text-center text-slate-400 font-medium">Nenhum lead encontrado para os filtros aplicados.</div>`;
        return;
    }

    container.innerHTML = leads.map(l => {
        const date = new Date(l.created_at).toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const cleanPhone = (l.telefone || '').replace(/\D/g, '');
        const nomeCliente = l.nome ? l.nome.split(' ')[0] : 'cliente';
        const imovel = l.imovel_interesse || 'interesse geral';
        const message = `Olá ${nomeCliente}! Recebemos seu contato pelo site sobre o imóvel "${imovel}" e gostaria de te ajudar.`;
        const waLink = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;

        const originClass = l.origem === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700';

        return `
            <div class="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group animate-in fade-in slide-in-from-bottom-2 duration-300" id="lead-card-${l.id}">
                <div class="space-y-4">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm font-black text-slate-500">
                                ${l.nome ? l.nome.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                                <h3 class="font-bold text-slate-900 leading-tight">${l.nome || 'Cliente não identificado'}</h3>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">${date}</p>
                            </div>
                        </div>
                        <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${originClass}">
                            ${l.origem || 'Site'}
                        </span>
                    </div>

                    <div class="space-y-2 pt-2">
                        <div class="flex items-center gap-2 text-slate-600 text-sm">
                            <span class="opacity-50">📞</span>
                            <span class="font-semibold">${l.telefone || 'Não informado'}</span>
                        </div>
                        <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Interesse</p>
                            <p class="text-xs font-bold text-slate-700 truncate">${l.imovel_interesse || 'Geral'}</p>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-between gap-4 mt-8 pt-4 border-t border-slate-50">
                    <button onclick="deleteLead('${l.id}')" class="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold" title="Excluir Lead">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Excluir
                    </button>
                    
                    <a href="${waLink}" target="_blank" class="flex-1 bg-emerald-500 text-white px-4 py-3 rounded-xl font-bold text-xs hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 text-center">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.417-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.305 1.652zm6.599-3.835c1.405.836 2.755 1.28 4.301 1.281 5.177 0 9.389-4.213 9.391-9.391 0-2.512-.975-4.87-2.747-6.645s-4.131-2.744-6.641-2.745c-5.181 0-9.392 4.213-9.395 9.393 0 1.608.434 3.182 1.258 4.587l-.937 3.421 3.49-.916zm11.22-7.259c.302-.15.302-.501.05-.651-.251-.151-1.488-.732-1.714-.813-.226-.082-.389-.121-.55.121s-.622.772-.763.933c-.14.161-.282.181-.582.031s-1.266-.467-2.411-1.487c-.891-.793-1.492-1.773-1.667-2.074-.176-.301-.019-.464.131-.614.135-.135.301-.351.452-.527.151-.176.201-.292.301-.482.1-.191.05-.361-.026-.511-.076-.151-.55-1.328-.753-1.817-.197-.474-.4-.41-.55-.418s-.311-.008-.477-.008-.437.061-.664.311c-.226.251-.865.842-.865 2.05s.879 2.373 1.005 2.541c.125.168 1.733 2.646 4.197 3.711.586.254 1.044.405 1.401.518.589.187 1.125.161 1.549.098.473-.07 1.488-.607 1.701-1.192.214-.584.214-1.085.15-1.192-.063-.107-.226-.171-.528-.221z"/></svg>
                        WhatsApp
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Função de Exportação para CSV
 */
function exportLeadsToCSV(leads) {
    const headers = ['Nome', 'Telefone', 'Origem', 'Imóvel / Interesse', 'Data'];
    
    const rows = leads.map(l => {
        const date = new Date(l.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        // Escape de aspas e ponto e vírgula para evitar quebra do CSV
        const escape = (text) => `"${(text || '').toString().replace(/"/g, '""')}"`;

        return [
            escape(l.nome),
            escape(l.telefone),
            escape(l.origem),
            escape(l.imovel_interesse),
            escape(date)
        ].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\n');
    
    // Blob com UTF-8 BOM para garantir acentos no Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Leads_data.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Exclui um lead do banco de dados e remove o card da tela
 */
window.deleteLead = async (id) => {
    if (!confirm('Deseja excluir este lead permanentemente?')) return;

    try {
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', id);

        if (error) throw error;

        const card = document.getElementById(`lead-card-${id}`);
        if (card) {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => card.remove(), 300);
        }
        
        // Atualiza a lista em memória
        allLeads = allLeads.filter(l => l.id !== id);
    } catch (err) {
        console.error('Erro ao excluir lead:', err.message);
        alert('Não foi possível excluir o lead no momento.');
    }
};

document.addEventListener('DOMContentLoaded', loadLeads);

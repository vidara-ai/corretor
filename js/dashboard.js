import { supabase } from './supabase.js';

/**
 * Carrega todos os dados necessários para o dashboard administrativo
 */
async function loadDashboardData() {
    try {
        // 1. Identificar usuário autenticado para exibição
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const userDisplay = document.getElementById('user-display');
            if (userDisplay) userDisplay.innerText = user.email;
        }

        // 2. Buscar Contagens de Imóveis (Ativos vs Inativos)
        // Usamos count: 'exact' e head: true para obter apenas o número de registros, economizando banda.
        const { count: activeCount } = await supabase
            .from('imoveis')
            .select('*', { count: 'exact', head: true })
            .eq('ativo', true);

        const { count: inactiveCount } = await supabase
            .from('imoveis')
            .select('*', { count: 'exact', head: true })
            .eq('ativo', false);

        // 3. Buscar Total de Leads
        const { count: totalLeads } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true });

        // 4. Buscar Contagens por Origem (Página e WhatsApp)
        const { count: paginaLeads } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('origem', 'pagina');

        const { count: whatsappLeads } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('origem', 'whatsapp');

        // 5. Buscar os 5 Leads mais recentes para a lista de atividades
        const { data: recentLeads, error: recentError } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentError) throw recentError;

        // 6. Atualizar Elementos da Interface (Métricas)
        updateElementText('stat-active', activeCount || 0);
        updateElementText('stat-inactive', inactiveCount || 0);
        updateElementText('stat-leads', totalLeads || 0);
        updateElementText('stat-origins', `${paginaLeads || 0} / ${whatsappLeads || 0}`);

        // 7. Renderizar a lista de leads recentes
        renderRecentLeads(recentLeads || []);

    } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err.message);
    }
}

/**
 * Helper para atualizar texto de elementos com segurança
 */
function updateElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

/**
 * Renderiza os leads na seção de "Leads Recentes"
 */
function renderRecentLeads(leads) {
    const list = document.getElementById('dashboard-leads-list');
    if (!list) return;

    if (leads.length === 0) {
        list.innerHTML = `
            <div class="text-center py-12">
                <p class="text-slate-400 text-sm">Nenhum lead encontrado no momento.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = leads.map(l => {
        const date = new Date(l.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const initial = l.nome ? l.nome.charAt(0).toUpperCase() : '?';

        return `
            <div class="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition border border-transparent hover:border-slate-100 group">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                        ${initial}
                    </div>
                    <div>
                        <p class="font-bold text-slate-900 text-sm">${l.nome || 'Cliente sem nome'}</p>
                        <p class="text-xs text-slate-500">${l.imovel_interesse || 'Interesse Geral'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-500 mb-1">
                        ${l.origem || 'N/A'}
                    </span>
                    <p class="text-xs text-slate-400 font-medium">${date}</p>
                </div>
            </div>
        `;
    }).join('');
}

// Inicia o processo de carregamento quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', loadDashboardData);
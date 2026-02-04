import { supabase } from "./supabase.js";

/**
 * Proteção de Rota (Guard)
 * Executa imediatamente para evitar renderização de conteúdo privado
 */
async function checkAccess() {
    try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
            window.location.href = "login.html";
        }
    } catch (e) {
        window.location.href = "login.html";
    }
}

checkAccess();
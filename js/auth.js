import { supabase } from "./supabase.js";

const loading = document.getElementById("loading");
const app = document.getElementById("app");
const isLoginPage = window.location.pathname.includes("login");

/**
 * Inicializa Autenticação na página de Login
 */
async function initAuth() {
    // Se não estivermos no login, este script apenas gerencia eventos globais (como logout)
    if (!isLoginPage) return;

    try {
        const { data } = await supabase.auth.getSession();
        
        // Se já tiver sessão, pula o login e vai pro dashboard
        if (data.session) {
            window.location.href = "dashboard.html";
            return;
        }
    } catch (e) {
        console.warn("Erro na verificação de sessão, exibindo formulário.");
    }

    // Se chegou aqui, não há sessão ou houve erro: mostra o formulário
    if (loading) loading.style.display = "none";
    if (app) app.style.display = "block";
}

// Executa a verificação inicial
initAuth();

/**
 * Lógica do Formulário de Login
 */
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('error-message');
        const btnLogin = document.getElementById('btn-login');

        if (errorDiv) errorDiv.classList.add('hidden');
        if (btnLogin) {
            btnLogin.innerText = 'Entrando...';
            btnLogin.disabled = true;
        }

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.location.href = 'dashboard.html';
        } catch (error) {
            if (errorDiv) {
                errorDiv.innerText = error.message === 'Invalid login credentials' 
                    ? 'E-mail ou senha inválidos.' 
                    : error.message;
                errorDiv.classList.remove('hidden');
            }
            if (btnLogin) {
                btnLogin.innerText = 'Entrar';
                btnLogin.disabled = false;
            }
        }
    });
}

/**
 * Lógica de Logout (Global para o painel)
 */
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'btn-logout') {
        e.preventDefault();
        if (confirm('Deseja sair do painel?')) {
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        }
    }
});
import { authManager } from './auth.js';

class LoginPage {
    constructor() {
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.switchToRegisterBtn = document.getElementById('switchToRegister');
        this.switchToLoginBtn = document.getElementById('switchToLogin');
        this.authError = document.getElementById('authError');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        this.init();
    }

    init() {
        // Inicializar o gerenciador de autenticação
        authManager.init();
        
        // Event listeners
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        this.switchToRegisterBtn.addEventListener('click', (e) => this.toggleForms(e));
        this.switchToLoginBtn.addEventListener('click', (e) => this.toggleForms(e));
    }

    toggleForms(e) {
        e.preventDefault();
        this.loginForm.style.display = this.loginForm.style.display === 'none' ? 'block' : 'none';
        this.registerForm.style.display = this.registerForm.style.display === 'none' ? 'block' : 'none';
        this.authError.style.display = 'none';
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            this.showError('Preencha todos os campos!');
            return;
        }
        
        this.showLoading(true);
        
        const result = await authManager.login(email, password);
        
        if (result.success) {
            this.showToast('Login realizado com sucesso!', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            this.showError(result.error || 'Erro ao fazer login');
            this.showLoading(false);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
        
        if (!name || !email || !password || !passwordConfirm) {
            this.showError('Preencha todos os campos!');
            return;
        }
        
        if (password !== passwordConfirm) {
            this.showError('As senhas não coincidem!');
            return;
        }
        
        if (password.length < 6) {
            this.showError('A senha deve ter no mínimo 6 caracteres!');
            return;
        }
        
        this.showLoading(true);
        
        const result = await authManager.register(email, password, name);
        
        if (result.success) {
            this.showToast('Conta criada com sucesso!', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            this.showError(result.error || 'Erro ao criar conta');
            this.showLoading(false);
        }
    }

    showError(message) {
        this.authError.textContent = message;
        this.authError.style.display = 'block';
    }

    showLoading(show) {
        if (show) {
            this.loadingOverlay.classList.add('show');
        } else {
            this.loadingOverlay.classList.remove('show');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<div>${message}</div>`;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    new LoginPage();
});

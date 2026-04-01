import { 
    db, 
    collection, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    orderBy,
    where
} from './firebase-config.js';
import { authManager } from './auth.js';

class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.isAdmin = false;
        this.theme = localStorage.getItem('theme') || 'light';
        this.users = [];
        this.links = [];
        this.categories = [];
        this.selectedUserId = null;
        this.selectedLinkId = null;

        this.init();
    }

    init() {
        authManager.init();

        setTimeout(() => {
            this.currentUser = authManager.getCurrentUser();
            this.userProfile = authManager.getUserProfile();
            this.isAdmin = authManager.isUserAdmin();

            if (!this.isAdmin) {
                window.location.href = 'index.html';
                return;
            }

            this.applyTheme();
            this.updateUserUI();
            this.bindEvents();
            this.loadData();
        }, 500);
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    updateUserUI() {
        document.getElementById('userDisplayName').textContent = this.userProfile.displayName || 'Usuário';
        document.getElementById('userEmail').textContent = this.userProfile.email;
    }

    bindEvents() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // User menu
        document.getElementById('userMenuBtn').addEventListener('click', () => this.toggleUserMenu());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('backToLinksBtn').addEventListener('click', () => this.backToLinks());

        // Tab navigation
        document.querySelectorAll('.admin-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab));
        });

        // Modal events
        this.bindModalEvents();

        // Close user menu on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                document.getElementById('userDropdown').style.display = 'none';
            }
        });
    }

    bindModalEvents() {
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });

        document.getElementById('cancelRoleChangeBtn').addEventListener('click', () => {
            this.closeModal(document.getElementById('roleChangeModal'));
        });

        document.getElementById('confirmRoleChangeBtn').addEventListener('click', () => {
            this.confirmRoleChange();
        });

        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            this.closeModal(document.getElementById('deleteConfirmModal'));
        });

        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.confirmDelete();
        });
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
        this.showToast('Tema alterado com sucesso!', 'success');
    }

    toggleUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }

    async logout() {
        await authManager.logout();
        window.location.href = 'login.html';
    }

    backToLinks() {
        window.location.href = 'index.html';
    }

    switchTab(tabName) {
        // Remover ativo de todos os tabs
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        document.querySelectorAll('.admin-nav-item').forEach(btn => {
            btn.classList.remove('active');
        });

        // Ativar tab selecionado
        document.getElementById(`${tabName}Tab`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    async loadData() {
        this.showLoading(true);

        try {
            await Promise.all([
                this.loadUsers(),
                this.loadLinks(),
                this.loadCategories()
            ]);

            this.renderDashboard();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showToast('Erro ao carregar dados!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadUsers() {
        try {
            const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            this.users = [];
            querySnapshot.forEach((doc) => {
                this.users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.renderUsersTable();
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
        }
    }

    async loadLinks() {
        try {
            const q = query(collection(db, 'links'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            this.links = [];
            querySnapshot.forEach((doc) => {
                this.links.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.renderLinksTable();
        } catch (error) {
            console.error('Erro ao carregar links:', error);
        }
    }

    async loadCategories() {
        try {
            const q = query(collection(db, 'categories'), orderBy('name'));
            const querySnapshot = await getDocs(q);

            this.categories = [];
            querySnapshot.forEach((doc) => {
                this.categories.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.renderCategoriesAdmin();
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
        }
    }

    renderDashboard() {
        const totalUsers = this.users.length;
        const totalLinks = this.links.length;
        const totalAdmins = this.users.filter(u => u.role === 'admin').length;
        const totalCategories = this.categories.length;

        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('totalLinks').textContent = totalLinks;
        document.getElementById('totalAdmins').textContent = totalAdmins;
        document.getElementById('totalCategories').textContent = totalCategories;

        // Atividade recente
        const recentActivity = this.links.slice(0, 5).map(link => {
            const user = this.users.find(u => u.id === link.userId);
            const createdDate = link.createdAt?.toDate ? link.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A';
            return `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-link"></i>
                    </div>
                    <div class="activity-content">
                        <p><strong>${user?.displayName || 'Usuário'}</strong> adicionou o link <strong>${link.title}</strong></p>
                        <small>${createdDate}</small>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('recentActivityList').innerHTML = recentActivity || '<p>Nenhuma atividade recente</p>';
    }

    renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');

        tbody.innerHTML = this.users.map(user => {
            const createdDate = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A';
            const roleLabel = user.role === 'admin' ? 'Administrador' : 'Usuário';
            const roleColor = user.role === 'admin' ? '#10b981' : '#6b7280';

            return `
                <tr>
                    <td>${user.displayName || 'Sem nome'}</td>
                    <td>${user.email}</td>
                    <td><span style="color: ${roleColor}; font-weight: 600;">${roleLabel}</span></td>
                    <td>${createdDate}</td>
                    <td>
                        <button class="action-btn" onclick="window.adminPanel.openRoleChangeModal('${user.id}', '${user.displayName}', '${user.role}')">
                            <i class="fas fa-edit"></i> Alterar Função
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderLinksTable() {
        const tbody = document.getElementById('linksTableBody');

        tbody.innerHTML = this.links.map(link => {
            const user = this.users.find(u => u.id === link.userId);
            const category = this.categories.find(c => c.id === link.categoryId);
            const typeLabel = link.type === 'public' ? 'Público' : 'Privado';
            const statusLabel = link.active ? 'Ativo' : 'Inativo';

            return `
                <tr>
                    <td>${link.title}</td>
                    <td>${typeLabel}</td>
                    <td>${user?.displayName || 'Desconhecido'}</td>
                    <td>${category?.name || 'Sem categoria'}</td>
                    <td>${statusLabel}</td>
                    <td>${link.clickCount || 0}</td>
                    <td>
                        <button class="action-btn" onclick="window.adminPanel.deleteLink('${link.id}', '${link.title}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderCategoriesAdmin() {
        const container = document.getElementById('categoriesListAdmin');

        container.innerHTML = this.categories.map(category => {
            return `
                <div class="category-card-admin">
                    <div class="category-card-header">
                        <h3>
                            <i class="${category.icon}"></i>
                            ${category.name}
                        </h3>
                    </div>
                    <div class="category-card-actions">
                        <button class="action-btn" onclick="window.adminPanel.deleteCategory('${category.id}', '${category.name}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    openRoleChangeModal(userId, displayName, currentRole) {
        this.selectedUserId = userId;
        document.getElementById('roleChangeUserName').textContent = displayName;
        document.getElementById('newRole').value = currentRole;
        this.showModal('roleChangeModal');
    }

    async confirmRoleChange() {
        const newRole = document.getElementById('newRole').value;
        
        if (!this.selectedUserId) return;

        this.showLoading(true);

        try {
            const userDocId = this.users.find(u => u.id === this.selectedUserId)?.id;
            
            // Encontrar o documento pelo uid
            const q = query(collection(db, 'users'), where('uid', '==', this.selectedUserId));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                this.showToast('Usuário não encontrado!', 'error');
                return;
            }

            const userDoc = querySnapshot.docs[0];
            await updateDoc(userDoc.ref, { role: newRole });

            this.showToast('Função do usuário alterada com sucesso!', 'success');
            this.closeModal(document.getElementById('roleChangeModal'));
            await this.loadUsers();
        } catch (error) {
            console.error('Erro ao alterar função:', error);
            this.showToast('Erro ao alterar função!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    deleteLink(linkId, linkTitle) {
        this.selectedLinkId = linkId;
        document.getElementById('deleteConfirmMessage').textContent = 
            `Tem certeza que deseja excluir o link "${linkTitle}"?`;
        this.showModal('deleteConfirmModal');
    }

    deleteCategory(categoryId, categoryName) {
        this.selectedLinkId = categoryId;
        document.getElementById('deleteConfirmMessage').textContent = 
            `Tem certeza que deseja excluir a categoria "${categoryName}"?`;
        this.showModal('deleteConfirmModal');
    }

    async confirmDelete() {
        if (!this.selectedLinkId) return;

        this.showLoading(true);

        try {
            await deleteDoc(doc(db, 'links', this.selectedLinkId));
            this.showToast('Item excluído com sucesso!', 'success');
            this.closeModal(document.getElementById('deleteConfirmModal'));
            await this.loadLinks();
        } catch (error) {
            console.error('Erro ao excluir:', error);
            this.showToast('Erro ao excluir!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
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
    window.adminPanel = new AdminPanel();
});

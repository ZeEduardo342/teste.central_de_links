import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy,
    where
} from './firebase-config.js';
import { authManager } from './auth.js';

class LinkManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.isAdmin = false;
        this.currentCategory = 'all';
        this.theme = localStorage.getItem('theme') || 'light';
        this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        this.cardSize = localStorage.getItem('cardSize') || 'medium';
        this.links = [];
        this.categories = [];
        this.searchQuery = '';
        this.editingLink = null;
        
        this.init();
    }

    init() {
        authManager.init();
        
        // Aguardar autenticação
        setTimeout(() => {
            this.currentUser = authManager.getCurrentUser();
            this.userProfile = authManager.getUserProfile();
            this.isAdmin = authManager.isUserAdmin();
            
            if (this.currentUser && this.userProfile) {
                this.applyTheme();
                this.applySidebarState();
                this.applyCardSize();
                this.updateUserUI();
                this.bindEvents();
                this.loadData();
            }
        }, 500);
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    applySidebarState() {
        const sidebar = document.getElementById('sidebar');
        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        }
    }

    applyCardSize() {
        const grid = document.querySelector('.links-grid');
        grid?.classList.remove('grid-small', 'grid-medium', 'grid-large');
        grid?.classList.add(`grid-${this.cardSize}`);
    }

    updateUserUI() {
        document.getElementById('userDisplayName').textContent = this.userProfile.displayName || 'Usuário';
        document.getElementById('userEmail').textContent = this.userProfile.email;
        
        if (this.isAdmin) {
            document.getElementById('adminToggle').style.display = 'block';
            document.getElementById('adminPanelBtn').style.display = 'block';
            document.getElementById('addPublicLinkBtn').style.display = 'flex';
            document.getElementById('addCategoryBtn').style.display = 'block';
        }
    }

    bindEvents() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());

        // User menu
        document.getElementById('userMenuBtn').addEventListener('click', () => this.toggleUserMenu());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('adminPanelBtn').addEventListener('click', () => this.goToAdmin());

        // Card size controls
        document.getElementById('sizeSmall').addEventListener('click', () => this.setCardSize('small'));
        document.getElementById('sizeMedium').addEventListener('click', () => this.setCardSize('medium'));
        document.getElementById('sizeLarge').addEventListener('click', () => this.setCardSize('large'));

        // Search and filter
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderLinks();
        });

        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.renderLinks();
        });

        // Add link buttons
        document.getElementById('addPersonalLinkBtn').addEventListener('click', () => this.showLinkModal(null, 'private'));
        document.getElementById('addPublicLinkBtn').addEventListener('click', () => this.showLinkModal(null, 'public'));

        // Modal events
        this.bindModalEvents();

        // Form events
        this.bindFormEvents();

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

        document.getElementById('cancelLinkBtn').addEventListener('click', () => {
            this.closeModal(document.getElementById('linkModal'));
        });

        document.getElementById('cancelCategoryBtn').addEventListener('click', () => {
            this.closeModal(document.getElementById('categoryModal'));
        });

        document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
            this.closeModal(document.getElementById('confirmModal'));
        });
    }

    bindFormEvents() {
        document.getElementById('linkForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLinkSubmit();
        });

        document.getElementById('categoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCategorySubmit();
        });

        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            this.showCategoryModal();
        });
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
        this.showToast('Tema alterado com sucesso!', 'success');
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        this.sidebarCollapsed = !this.sidebarCollapsed;
        localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed);

        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }

    toggleUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }

    async logout() {
        await authManager.logout();
        window.location.href = 'login.html';
    }

    goToAdmin() {
        window.location.href = 'admin.html';
    }

    setCardSize(size) {
        this.cardSize = size;
        localStorage.setItem('cardSize', size);
        
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`size${size.charAt(0).toUpperCase() + size.slice(1)}`).classList.add('active');
        
        this.applyCardSize();
        this.renderLinks();
    }

    async loadData() {
        this.showLoading(true);

        try {
            await Promise.all([
                this.loadCategories(),
                this.loadLinks()
            ]);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showToast('Erro ao carregar dados!', 'error');
        } finally {
            this.showLoading(false);
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

            if (this.categories.length === 0) {
                await this.createDefaultCategories();
            }

            this.renderCategories();
            this.populateCategoryFilter();
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
        }
    }

    async createDefaultCategories() {
        const defaultCategories = [
            { name: 'Designs Figma', icon: 'fas fa-palette' },
            { name: 'Apresentações', icon: 'fas fa-presentation' },
            { name: 'Links Externos', icon: 'fas fa-external-link-alt' },
            { name: 'Documentos', icon: 'fas fa-file-alt' },
            { name: 'Ferramentas', icon: 'fas fa-tools' }
        ];

        for (const category of defaultCategories) {
            await addDoc(collection(db, 'categories'), {
                ...category,
                createdAt: new Date()
            });
        }

        await this.loadCategories();
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

            this.renderLinks();
        } catch (error) {
            console.error('Erro ao carregar links:', error);
        }
    }

    renderCategories() {
        const categoriesList = document.getElementById('categoriesList');

        let html = `
            <li class="category-item">
                <a href="#" class="category-link ${this.currentCategory === 'all' ? 'active' : ''}" data-category="all">
                    <i class="category-icon fas fa-th-large"></i>
                    <span class="category-name">Todos os Links</span>
                </a>
            </li>
            <li class="category-item">
                <a href="#" class="category-link ${this.currentCategory === 'personal' ? 'active' : ''}" data-category="personal">
                    <i class="category-icon fas fa-lock"></i>
                    <span class="category-name">Meus Links</span>
                </a>
            </li>
            <li class="category-item">
                <a href="#" class="category-link ${this.currentCategory === 'favorites' ? 'active' : ''}" data-category="favorites">
                    <i class="category-icon fas fa-star"></i>
                    <span class="category-name">Favoritos</span>
                </a>
            </li>
        `;

        this.categories.forEach(category => {
            html += `
                <li class="category-item">
                    <a href="#" class="category-link ${this.currentCategory === category.id ? 'active' : ''}" data-category="${category.id}">
                        <i class="category-icon ${category.icon}"></i>
                        <span class="category-name">${category.name}</span>
                    </a>
                </li>
            `;
        });

        categoriesList.innerHTML = html;

        document.querySelectorAll('.category-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.currentCategory = link.dataset.category;
                this.renderCategories();
                this.renderLinks();
            });
        });
    }

    populateCategoryFilter() {
        const select = document.getElementById('categoryFilter');
        let html = '<option value="all">Todas as Categorias</option>';

        this.categories.forEach(category => {
            html += `<option value="${category.id}">${category.name}</option>`;
        });

        select.innerHTML = html;
    }

    renderLinks() {
        const personalLinksList = document.getElementById('personalLinksList');
        const favoritesList = document.getElementById('favoritesList');
        const publicLinksList = document.getElementById('linksList');

        // Filtrar links pessoais
        const personalLinks = this.links.filter(link => 
            link.type === 'private' && 
            link.userId === this.currentUser.uid &&
            this.matchesSearch(link) &&
            this.matchesCategory(link)
        );

        // Filtrar links favoritos
        const favoriteLinks = this.links.filter(link =>
            link.favorite &&
            this.matchesSearch(link) &&
            this.matchesCategory(link)
        );

        // Filtrar links públicos
        const publicLinks = this.links.filter(link =>
            link.type === 'public' &&
            this.matchesSearch(link) &&
            this.matchesCategory(link)
        );

        // Renderizar seções
        if (this.currentCategory === 'personal' || this.currentCategory === 'all') {
            personalLinksList.innerHTML = personalLinks.length > 0 
                ? personalLinks.map(link => this.createLinkCard(link)).join('')
                : '';
            document.getElementById('personalLinksSection').style.display = personalLinks.length > 0 || this.currentCategory === 'personal' ? 'block' : 'none';
        }

        if (this.currentCategory === 'favorites' || this.currentCategory === 'all') {
            favoritesList.innerHTML = favoriteLinks.length > 0
                ? favoriteLinks.map(link => this.createLinkCard(link)).join('')
                : '';
            document.getElementById('favoritesSection').style.display = favoriteLinks.length > 0 ? 'block' : 'none';
        }

        if (this.currentCategory !== 'personal' && this.currentCategory !== 'favorites') {
            publicLinksList.innerHTML = publicLinks.length > 0
                ? publicLinks.map(link => this.createLinkCard(link)).join('')
                : '';
        }

        this.attachCardEvents();
    }

    matchesSearch(link) {
        if (!this.searchQuery) return true;
        return link.title.toLowerCase().includes(this.searchQuery) ||
               link.description?.toLowerCase().includes(this.searchQuery) ||
               link.tags?.some(tag => tag.toLowerCase().includes(this.searchQuery));
    }

    matchesCategory(link) {
        if (this.currentCategory === 'all' || this.currentCategory === 'personal' || this.currentCategory === 'favorites') {
            return true;
        }
        return link.categoryId === this.currentCategory;
    }

    createLinkCard(link) {
        const category = this.categories.find(c => c.id === link.categoryId);
        const categoryName = category ? category.name : 'Sem categoria';
        const tagsHtml = link.tags ? link.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : '';

        return `
            <div class="link-card ${link.active ? '' : 'inactive'}" data-link-id="${link.id}">
                <div class="link-header">
                    <div class="link-title">${link.title}</div>
                    <div class="link-actions">
                        <button class="link-action favorite" data-action="favorite" title="Favoritar">
                            <i class="fas fa-star ${link.favorite ? 'fas' : 'far'}"></i>
                        </button>
                    </div>
                </div>
                <div class="link-description">${link.description || 'Sem descrição'}</div>
                <div class="link-tags">${tagsHtml}</div>
                <div class="link-footer">
                    <span class="link-category">
                        <i class="${category?.icon || 'fas fa-link'}"></i>
                        ${categoryName}
                    </span>
                    <span>${link.clickCount || 0} cliques</span>
                </div>
            </div>
        `;
    }

    attachCardEvents() {
        document.querySelectorAll('.link-card').forEach(card => {
            const linkId = card.dataset.linkId;

            card.addEventListener('click', (e) => {
                if (!e.target.closest('.link-action')) {
                    this.showLinkDetails(linkId);
                }
            });

            card.querySelector('.link-action.favorite')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(linkId);
            });
        });
    }

    showLinkModal(link = null, type = 'private') {
        this.editingLink = link;
        const modal = document.getElementById('linkModal');
        const title = document.getElementById('linkModalTitle');
        const form = document.getElementById('linkForm');
        const typeSelect = document.getElementById('linkType');

        title.textContent = link ? 'Editar Link' : 'Adicionar Link';

        if (link) {
            document.getElementById('linkTitle').value = link.title;
            document.getElementById('linkUrl').value = link.url;
            document.getElementById('linkCategory').value = link.categoryId;
            document.getElementById('linkType').value = link.type;
            document.getElementById('linkTags').value = link.tags ? link.tags.join(', ') : '';
            document.getElementById('linkDescription').value = link.description || '';
            document.getElementById('linkFavorite').checked = link.favorite || false;
            document.getElementById('linkActive').checked = link.active !== false;
        } else {
            form.reset();
            document.getElementById('linkActive').checked = true;
            document.getElementById('linkType').value = type;
        }

        // Atualizar opções de categoria
        const categorySelect = document.getElementById('linkCategory');
        categorySelect.innerHTML = this.categories.map(cat => 
            `<option value="${cat.id}">${cat.name}</option>`
        ).join('');

        if (link) {
            categorySelect.value = link.categoryId;
        }

        this.showModal('linkModal');
        document.getElementById('linkTitle').focus();
    }

    async handleLinkSubmit() {
        const title = document.getElementById('linkTitle').value.trim();
        const url = document.getElementById('linkUrl').value.trim();
        const categoryId = document.getElementById('linkCategory').value;
        const type = document.getElementById('linkType').value;
        const tags = document.getElementById('linkTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
        const description = document.getElementById('linkDescription').value.trim();
        const favorite = document.getElementById('linkFavorite').checked;
        const active = document.getElementById('linkActive').checked;

        if (!title || !url || !categoryId) {
            this.showToast('Preencha todos os campos obrigatórios!', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const linkData = {
                title,
                url: this.convertUrlIfNeeded(url, categoryId),
                categoryId,
                type,
                tags,
                description,
                favorite,
                active,
                userId: this.currentUser.uid,
                updatedAt: new Date()
            };

            if (this.editingLink) {
                await updateDoc(doc(db, 'links', this.editingLink.id), linkData);
                this.showToast('Link atualizado com sucesso!', 'success');
            } else {
                linkData.createdAt = new Date();
                linkData.clickCount = 0;
                await addDoc(collection(db, 'links'), linkData);
                this.showToast('Link adicionado com sucesso!', 'success');
            }

            this.closeModal(document.getElementById('linkModal'));
            await this.loadLinks();
        } catch (error) {
            console.error('Erro ao salvar link:', error);
            this.showToast('Erro ao salvar link!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    convertUrlIfNeeded(url, categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (category?.name.toLowerCase().includes('figma')) {
            return this.convertFigmaUrl(url);
        }
        return url;
    }

    convertFigmaUrl(url) {
        url = (url || '').trim();
        if (/^figma:\/\//i.test(url)) return url.replace(/^FIGMA:\/\//i, 'figma://');
        const n = /^https?:\/\//i.test(url) ? url : ('https://' + url);
        const u = new URL(n);
        const s = u.pathname.split('/').filter(Boolean);
        const type = (s[0]?.toLowerCase() === 'proto') ? 'proto' : 'file';
        const key = s[1];
        if (!key) return url;
        return `figma://${type}/${key}${u.search || ''}${u.hash || ''}`;
    }

    async toggleFavorite(linkId) {
        try {
            const link = this.links.find(l => l.id === linkId);
            const newFavoriteState = !link.favorite;

            await updateDoc(doc(db, 'links', linkId), {
                favorite: newFavoriteState
            });

            link.favorite = newFavoriteState;
            this.renderLinks();

            this.showToast(
                newFavoriteState ? 'Adicionado aos favoritos!' : 'Removido dos favoritos!',
                'success'
            );
        } catch (error) {
            console.error('Erro ao atualizar favorito:', error);
            this.showToast('Erro ao atualizar favorito!', 'error');
        }
    }

    showLinkDetails(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        const modal = document.getElementById('linkDetailsModal');
        const title = document.getElementById('linkDetailsTitle');
        const content = document.getElementById('linkDetailsContent');
        const actions = document.getElementById('linkDetailsActions');

        title.textContent = link.title;

        const category = this.categories.find(c => c.id === link.categoryId);
        const categoryName = category ? category.name : 'Sem categoria';
        const tags = link.tags ? link.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : 'Nenhuma tag';
        const createdDate = link.createdAt?.toDate ? link.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A';

        let createdByInfo = '';
        if (link.type === 'public' && this.isAdmin && link.userId) {
            createdByInfo = `<div class="form-group"><label>Adicionado por:</label><p>${link.userId}</p></div>`;
        }

        content.innerHTML = `
            <div class="form-group">
                <label>URL:</label>
                <p><a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.url}</a></p>
            </div>
            <div class="form-group">
                <label>Categoria:</label>
                <p>${categoryName}</p>
            </div>
            ${link.description ? `
                <div class="form-group">
                    <label>Descrição:</label>
                    <p>${link.description}</p>
                </div>
            ` : ''}
            <div class="form-group">
                <label>Tags:</label>
                <div class="link-tags">${tags}</div>
            </div>
            <div class="form-group">
                <label>Status:</label>
                <p>${link.active ? 'Ativo' : 'Inativo'}</p>
            </div>
            <div class="form-group">
                <label>Favorito:</label>
                <p>${link.favorite ? 'Sim' : 'Não'}</p>
            </div>
            <div class="form-group">
                <label>Cliques:</label>
                <p>${link.clickCount || 0}</p>
            </div>
            <div class="form-group">
                <label>Criado em:</label>
                <p>${createdDate}</p>
            </div>
            ${createdByInfo}
        `;

        actions.style.display = 'flex';
        
        // Botão copiar
        document.getElementById('copyLinkBtn').onclick = () => {
            navigator.clipboard.writeText(link.url);
            this.showToast('Link copiado!', 'success');
        };

        // Botão editar (apenas para dono ou admin)
        const editBtn = document.getElementById('editLinkBtn');
        if (link.userId === this.currentUser.uid || this.isAdmin) {
            editBtn.style.display = 'block';
            editBtn.onclick = () => {
                this.closeModal(modal);
                this.showLinkModal(link);
            };
        } else {
            editBtn.style.display = 'none';
        }

        // Botão deletar (apenas para dono ou admin)
        const deleteBtn = document.getElementById('deleteLinkBtn');
        if (link.userId === this.currentUser.uid || this.isAdmin) {
            deleteBtn.style.display = 'block';
            deleteBtn.onclick = () => {
                this.closeModal(modal);
                this.confirmDeleteLink(link.id);
            };
        } else {
            deleteBtn.style.display = 'none';
        }

        this.showModal('linkDetailsModal');
    }

    confirmDeleteLink(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        document.getElementById('confirmMessage').textContent = 
            `Tem certeza que deseja excluir o link "${link.title}"?`;

        this.showModal('confirmModal');

        document.getElementById('confirmActionBtn').onclick = () => {
            this.deleteLink(linkId);
            this.closeModal(document.getElementById('confirmModal'));
        };
    }

    async deleteLink(linkId) {
        this.showLoading(true);

        try {
            await deleteDoc(doc(db, 'links', linkId));
            this.showToast('Link excluído com sucesso!', 'success');
            await this.loadLinks();
        } catch (error) {
            console.error('Erro ao excluir link:', error);
            this.showToast('Erro ao excluir link!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showCategoryModal() {
        this.showModal('categoryModal');
        document.getElementById('categoryName').focus();
    }

    async handleCategorySubmit() {
        const name = document.getElementById('categoryName').value.trim();
        const icon = document.getElementById('categoryIcon').value.trim();

        if (!name) {
            this.showToast('Digite o nome da categoria!', 'error');
            return;
        }

        this.showLoading(true);

        try {
            await addDoc(collection(db, 'categories'), {
                name,
                icon: icon || 'fas fa-folder',
                createdAt: new Date()
            });

            this.showToast('Categoria criada com sucesso!', 'success');
            this.closeModal(document.getElementById('categoryModal'));
            await this.loadCategories();
        } catch (error) {
            console.error('Erro ao criar categoria:', error);
            this.showToast('Erro ao criar categoria!', 'error');
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

        const forms = modal.querySelectorAll('form');
        forms.forEach(form => form.reset());

        this.editingLink = null;
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
    window.linkManager = new LinkManager();
});

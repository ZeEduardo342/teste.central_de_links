// ============================================================
// Utilities
// ============================================================
function convertFigmaUrlToApp(v) {
    v = (v || '').trim();
    if (/^figma:\/\//i.test(v)) return v.replace(/^FIGMA:\/\//i, 'figma://');
    const n = /^https?:\/\//i.test(v) ? v : ('https://' + v);
    const u = new URL(n);
    const s = u.pathname.split('/').filter(Boolean);
    const type = (s[0]?.toLowerCase() === 'proto') ? 'proto' : 'file';
    const key  = s[1];
    if (!key) throw new Error('sem chave Figma');
    return `figma://${type}/${key}${u.search || ''}${u.hash || ''}`;
}

function formatDate(date) {
    if (!date) return '—';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ============================================================
// AppState Class
// ============================================================
class AppState {
    constructor() {
        this.currentUser   = null;
        this.userProfile   = null; // doc from /users/{uid}
        this.isAdmin       = false;
        this.currentTab    = 'public';  // 'public' | 'personal'
        this.currentCategory = 'all';
        this.theme         = localStorage.getItem('theme') || 'light';
        this.links         = [];        // public links
        this.personalLinks = [];        // current user's personal links
        this.categories    = [];
        this.searchQuery   = '';
        this.editingLink   = null;
        this.cardSize      = parseInt(localStorage.getItem('cardSize') || '300');

        this.applyTheme();
        this.bindAuthEvents();
        this.bindGlobalEvents();
        this.initAuthListener();
    }

    // ----------------------------------------------------------
    // Theme
    // ----------------------------------------------------------
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
        this.showToast('Tema alterado!', 'success');
    }

    // ----------------------------------------------------------
    // Auth Events
    // ----------------------------------------------------------
    bindAuthEvents() {
        // Tab switch
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('auth' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.add('active');
            });
        });

        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('registerBtn').addEventListener('click', () => this.handleRegister());

        // Enter key
        ['loginEmail', 'loginPassword'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') this.handleLogin(); });
        });
        ['registerName', 'registerEmail', 'registerPassword'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') this.handleRegister(); });
        });
    }

    async handleLogin() {
        const email    = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errEl    = document.getElementById('loginError');
        errEl.textContent = '';

        if (!email || !password) { errEl.textContent = 'Preencha e-mail e senha.'; return; }

        try {
            document.getElementById('loginBtn').disabled = true;
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            errEl.textContent = this.authErrorMsg(err.code);
            document.getElementById('loginBtn').disabled = false;
        }
    }

    async handleRegister() {
        const name     = document.getElementById('registerName').value.trim();
        const email    = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const errEl    = document.getElementById('registerError');
        errEl.textContent = '';

        if (!name || !email || !password) { errEl.textContent = 'Preencha todos os campos.'; return; }
        if (password.length < 6) { errEl.textContent = 'A senha deve ter no mínimo 6 caracteres.'; return; }

        try {
            document.getElementById('registerBtn').disabled = true;
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: name });
            // Create user profile doc in Firestore
            await setDoc(doc(db, 'users', cred.user.uid), {
                name,
                email,
                role: 'user',
                createdAt: serverTimestamp()
            });
        } catch (err) {
            errEl.textContent = this.authErrorMsg(err.code);
            document.getElementById('registerBtn').disabled = false;
        }
    }

    authErrorMsg(code) {
        const map = {
            'auth/user-not-found':        'Usuário não encontrado.',
            'auth/wrong-password':        'Senha incorreta.',
            'auth/invalid-email':         'E-mail inválido.',
            'auth/email-already-in-use':  'E-mail já cadastrado.',
            'auth/weak-password':         'Senha muito fraca.',
            'auth/invalid-credential':    'E-mail ou senha incorretos.',
            'auth/too-many-requests':     'Muitas tentativas. Tente mais tarde.'
        };
        return map[code] || 'Erro ao autenticar. Tente novamente.';
    }

    initAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserProfile(user.uid);
                this.showApp();
                await this.loadData();
            } else {
                this.currentUser = null;
                this.userProfile = null;
                this.isAdmin = false;
                this.showAuth();
            }
        });
    }

    async loadUserProfile(uid) {
        try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
                this.userProfile = { id: uid, ...snap.data() };
                this.isAdmin = this.userProfile.role === 'admin';
            } else {
                // Create profile if missing (e.g. first admin seeded manually)
                this.userProfile = { id: uid, name: this.currentUser.displayName || 'Usuário', email: this.currentUser.email, role: 'user' };
                this.isAdmin = false;
            }
        } catch (e) {
            console.error('loadUserProfile:', e);
        }
    }

    showAuth() {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('appScreen').style.display  = 'none';
        // Reset auth form errors and buttons
        document.getElementById('loginError').textContent    = '';
        document.getElementById('registerError').textContent = '';
        document.getElementById('loginBtn').disabled    = false;
        document.getElementById('registerBtn').disabled = false;
        document.getElementById('loginEmail').value    = '';
        document.getElementById('loginPassword').value = '';
    }

    showApp() {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appScreen').style.display  = 'block';
        this.updateUserUI();
        this.applyCardSize(this.cardSize);
        document.getElementById('cardSizeSlider').value = this.cardSize;
    }

    // ----------------------------------------------------------
    // Global (App) Events
    // ----------------------------------------------------------
    bindGlobalEvents() {
        // Theme
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // User dropdown
        document.getElementById('userMenuBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const dd = document.getElementById('userDropdown');
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        });
        document.addEventListener('click', () => {
            document.getElementById('userDropdown').style.display = 'none';
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // Admin panel
        document.getElementById('adminPanelBtn').addEventListener('click', () => {
            document.getElementById('userDropdown').style.display = 'none';
            this.openAdminPanel();
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderLinks();
        });

        // Category filter (dropdown in header)
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.renderLinks();
        });

        // Tabs (Public / Personal)
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTab = btn.dataset.tab;
                this.currentCategory = 'all';
                document.getElementById('categoryFilter').value = 'all';
                this.updateAddLinkBtn();
                this.renderLinks();
            });
        });

        // Add Link button
        document.getElementById('addLinkBtn').addEventListener('click', () => this.showLinkModal());

        // Card size slider
        document.getElementById('cardSizeSlider').addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            this.cardSize = size;
            localStorage.setItem('cardSize', size);
            this.applyCardSize(size);
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal')));
        });
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => { if (e.target === modal) this.closeModal(modal); });
        });

        // Link form
        document.getElementById('linkForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLinkSubmit();
        });
        document.getElementById('cancelLinkBtn').addEventListener('click', () => this.closeModal(document.getElementById('linkModal')));

        // Category form
        document.getElementById('categoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCategorySubmit();
        });
        document.getElementById('cancelCategoryBtn').addEventListener('click', () => this.closeModal(document.getElementById('categoryModal')));

        // Confirm modal
        document.getElementById('cancelConfirmBtn').addEventListener('click', () => this.closeModal(document.getElementById('confirmModal')));

        // Add category btn (inside admin panel)
        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            this.closeModal(document.getElementById('adminPanelModal'));
            this.showModal('categoryModal');
        });
    }

    async handleLogout() {
        await signOut(auth);
        this.showToast('Sessão encerrada!', 'success');
    }

    // ----------------------------------------------------------
    // Card Size
    // ----------------------------------------------------------
    applyCardSize(size) {
        document.querySelectorAll('.links-grid').forEach(grid => {
            grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${size}px, 1fr))`;
        });
    }

    // ----------------------------------------------------------
    // User UI
    // ----------------------------------------------------------
    updateUserUI() {
        const name  = this.userProfile?.name || this.currentUser?.displayName || 'Usuário';
        const email = this.currentUser?.email || '';

        document.getElementById('userDisplayName').textContent  = name;
        document.getElementById('dropdownUserName').textContent  = name;
        document.getElementById('dropdownUserEmail').textContent = email;

        const adminBadge   = document.getElementById('dropdownAdminBadge');
        const adminPanelBtn = document.getElementById('adminPanelBtn');
        if (this.isAdmin) {
            adminBadge.style.display   = 'flex';
            adminPanelBtn.style.display = 'flex';
        } else {
            adminBadge.style.display   = 'none';
            adminPanelBtn.style.display = 'none';
        }

        this.updateAddLinkBtn();
    }

    updateAddLinkBtn() {
        const btn = document.getElementById('addLinkBtn');
        // Admin can add public links; any user can add personal links
        if (this.currentTab === 'personal' || this.isAdmin) {
            btn.style.display = 'flex';
        } else {
            btn.style.display = 'none';
        }
    }

    // ----------------------------------------------------------
    // Data Loading
    // ----------------------------------------------------------
    async loadData() {
        this.showLoading(true);
        try {
            await Promise.all([
                this.loadCategories(),
                this.loadLinks(),
                this.loadPersonalLinks()
            ]);
        } catch (err) {
            console.error('loadData:', err);
            this.showToast('Erro ao carregar dados!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadCategories() {
        try {
            const q    = query(collection(db, 'categories'), orderBy('name'));
            const snap = await getDocs(q);
            this.categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (this.categories.length === 0) await this.createDefaultCategories();
            this.renderCategoryFilter();
        } catch (err) {
            console.error('loadCategories:', err);
        }
    }

    async createDefaultCategories() {
        const defaults = [
            { name: 'Designs Figma',   icon: 'fas fa-palette' },
            { name: 'Apresentações',   icon: 'fas fa-chalkboard-teacher' },
            { name: 'Links Externos',  icon: 'fas fa-external-link-alt' },
            { name: 'Documentos',      icon: 'fas fa-file-alt' },
            { name: 'Ferramentas',     icon: 'fas fa-tools' }
        ];
        for (const cat of defaults) {
            await addDoc(collection(db, 'categories'), { ...cat, createdAt: serverTimestamp() });
        }
        const q    = query(collection(db, 'categories'), orderBy('name'));
        const snap = await getDocs(q);
        this.categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async loadLinks() {
        try {
            const q    = query(collection(db, 'links'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            this.links = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.renderLinks();
        } catch (err) {
            console.error('loadLinks:', err);
        }
    }

    async loadPersonalLinks() {
        if (!this.currentUser) return;
        try {
            const q    = query(
                collection(db, 'personalLinks'),
                where('userId', '==', this.currentUser.uid),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            this.personalLinks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.renderLinks();
        } catch (err) {
            console.error('loadPersonalLinks:', err);
        }
    }

    // ----------------------------------------------------------
    // Category Filter (header dropdown)
    // ----------------------------------------------------------
    renderCategoryFilter() {
        const sel = document.getElementById('categoryFilter');
        sel.innerHTML = '<option value="all">Todas as categorias</option>';
        this.categories.forEach(cat => {
            sel.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });

        // Also update the form select
        this.updateCategorySelects();
    }

    updateCategorySelects() {
        const sel = document.getElementById('linkCategory');
        sel.innerHTML = this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // ----------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------
    renderLinks() {
        const listEl     = document.getElementById('linksList');
        const favSec     = document.getElementById('favoritesSection');
        const favList    = document.getElementById('favoritesList');
        const emptyState = document.getElementById('emptyState');

        const source = this.currentTab === 'personal' ? this.personalLinks : this.links;
        let filtered = [...source];

        // Search filter
        if (this.searchQuery) {
            filtered = filtered.filter(l =>
                l.title.toLowerCase().includes(this.searchQuery) ||
                l.url.toLowerCase().includes(this.searchQuery) ||
                (l.description && l.description.toLowerCase().includes(this.searchQuery)) ||
                (l.tags && l.tags.some(t => t.toLowerCase().includes(this.searchQuery)))
            );
        }

        // Category filter
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(l => l.categoryId === this.currentCategory);
        }

        // Favorites section (only on public tab)
        if (this.currentTab === 'public') {
            const favLinks = this.links.filter(l => l.favorite);
            if (favLinks.length > 0) {
                favSec.style.display = 'block';
                favList.innerHTML = favLinks.map(l => this.createLinkCard(l)).join('');
            } else {
                favSec.style.display = 'none';
            }
        } else {
            favSec.style.display = 'none';
        }

        listEl.innerHTML = filtered.map(l => this.createLinkCard(l)).join('');

        emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

        this.applyCardSize(this.cardSize);
        this.bindLinkEvents();
    }

    createLinkCard(link) {
        const category     = this.categories.find(c => c.id === link.categoryId);
        const categoryName = category ? category.name : 'Sem categoria';
        const categoryIcon = category ? category.icon  : 'fas fa-folder';
        const isFigma      = categoryName.toLowerCase().includes('figma');
        const isExternal   = categoryName.toLowerCase().includes('externo') || categoryName.toLowerCase().includes('externos');
        const isPersonal   = !!link.userId; // personal links have userId
        const tags         = link.tags ? link.tags.map(t => `<span class="tag">${t}</span>`).join('') : '';

        // Action buttons on card
        let actions = '';
        if (this.isAdmin && !isPersonal) {
            actions = `
            <div class="link-actions">
                <button class="link-action favorite ${link.favorite ? 'active' : ''}" data-action="favorite" data-id="${link.id}" title="Favorito">
                    <i class="fas fa-star"></i>
                </button>
                <button class="link-action" data-action="edit" data-id="${link.id}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="link-action danger" data-action="delete" data-id="${link.id}" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>`;
        } else if (isPersonal && this.currentUser && link.userId === this.currentUser.uid) {
            actions = `
            <div class="link-actions">
                <button class="link-action" data-action="editPersonal" data-id="${link.id}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="link-action danger" data-action="deletePersonal" data-id="${link.id}" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>`;
        }

        // Badge for personal
        const personalBadge = isPersonal ? `<span class="personal-badge"><i class="fas fa-user-lock"></i> Pessoal</span>` : '';

        // Action button (figma vs external)
        let actionBtn = '';
        if (isFigma && link.active) {
            actionBtn = `<a href="${link.url}" class="card-action-btn figma-btn" title="Abrir no Figma" onclick="event.stopPropagation()">
                <i class="fas fa-external-link-alt"></i> Abrir no Figma
            </a>`;
        } else if ((isExternal || !isFigma) && link.active) {
            actionBtn = `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="card-action-btn external-btn" title="Abrir link" onclick="event.stopPropagation()">
                <i class="fas fa-external-link-alt"></i> Abrir
            </a>`;
        }

        return `
        <div class="link-card ${!link.active ? 'inactive' : ''}" data-id="${link.id}" data-personal="${isPersonal}">
            <div class="link-header">
                <div class="link-header-info">
                    <h3 class="link-title">${link.title}</h3>
                    ${personalBadge}
                </div>
                ${actions}
            </div>
            ${link.description ? `<p class="link-description">${link.description}</p>` : ''}
            ${tags ? `<div class="link-tags">${tags}</div>` : ''}
            <div class="link-footer">
                <div class="link-category">
                    <i class="${categoryIcon}"></i>
                    <span>${categoryName}</span>
                </div>
                <div class="link-footer-right">
                    ${actionBtn}
                    <span class="link-date">${formatDate(link.createdAt)}</span>
                </div>
            </div>
        </div>`;
    }

    bindLinkEvents() {
        document.querySelectorAll('.link-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.link-actions') || e.target.closest('.card-action-btn')) return;
                const linkId    = card.dataset.id;
                const isPersonal = card.dataset.personal === 'true';
                const source    = isPersonal ? this.personalLinks : this.links;
                const link      = source.find(l => l.id === linkId);
                if (link) this.showLinkDetails(link);
            });
        });

        document.querySelectorAll('.link-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const { action, id } = btn.dataset;
                switch (action) {
                    case 'favorite':       this.toggleFavorite(id); break;
                    case 'edit':           this.editLink(id, false); break;
                    case 'delete':         this.confirmDeleteLink(id, false); break;
                    case 'editPersonal':   this.editLink(id, true); break;
                    case 'deletePersonal': this.confirmDeleteLink(id, true); break;
                }
            });
        });
    }

    // ----------------------------------------------------------
    // Link Details Modal
    // ----------------------------------------------------------
    showLinkDetails(link) {
        const isPersonal   = !!link.userId;
        const category     = this.categories.find(c => c.id === link.categoryId);
        const categoryName = category ? category.name : 'Sem categoria';
        const tags         = link.tags?.length
            ? link.tags.map(t => `<span class="tag">${t}</span>`).join('')
            : '<span style="color:var(--text-muted)">Nenhuma</span>';

        const isFigma    = categoryName.toLowerCase().includes('figma');
        const isExternal = !isFigma;

        const openBtn = link.active
            ? `<a href="${link.url}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} class="btn btn-primary detail-open-btn">
                <i class="fas fa-external-link-alt"></i> ${isFigma ? 'Abrir no Figma' : 'Abrir Link'}
               </a>`
            : '';

        let adminInfo = '';
        if (this.isAdmin && !isPersonal && link.addedBy) {
            adminInfo = `
            <div class="detail-row">
                <span class="detail-label"><i class="fas fa-user"></i> Adicionado por</span>
                <span class="detail-value">${link.addedByName || link.addedBy}</span>
            </div>`;
        }

        document.getElementById('linkDetailsTitle').textContent = link.title;
        document.getElementById('linkDetailsContent').innerHTML = `
            <div class="detail-row">
                <span class="detail-label"><i class="fas fa-link"></i> URL</span>
                <span class="detail-value url-row">
                    <span class="url-text">${link.url}</span>
                    <button class="btn-copy" onclick="navigator.clipboard.writeText('${link.url.replace(/'/g, "\\'")}').then(()=>window.app.showToast('Link copiado!','success'))" title="Copiar">
                        <i class="fas fa-copy"></i>
                    </button>
                </span>
            </div>
            <div class="detail-row">
                <span class="detail-label"><i class="fas fa-folder"></i> Categoria</span>
                <span class="detail-value">${categoryName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label"><i class="fas fa-tags"></i> Tags</span>
                <span class="detail-value">${tags}</span>
            </div>
            ${link.description ? `
            <div class="detail-row">
                <span class="detail-label"><i class="fas fa-align-left"></i> Descrição</span>
                <span class="detail-value">${link.description}</span>
            </div>` : ''}
            <div class="detail-row">
                <span class="detail-label"><i class="fas fa-calendar-alt"></i> Adicionado em</span>
                <span class="detail-value">${formatDate(link.createdAt)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label"><i class="fas fa-circle"></i> Status</span>
                <span class="detail-value">${link.active ? '<span class="status-active">Ativo</span>' : '<span class="status-inactive">Inativo</span>'}</span>
            </div>
            ${adminInfo}
            ${openBtn ? `<div style="margin-top:1.5rem">${openBtn}</div>` : ''}
        `;

        const actions = document.getElementById('linkDetailsActions');
        // Admin can edit/delete public links; user can edit/delete own personal links
        const canEdit = (this.isAdmin && !isPersonal) ||
                        (isPersonal && this.currentUser && link.userId === this.currentUser.uid);

        if (canEdit) {
            actions.style.display = 'flex';
            document.getElementById('editLinkBtn').onclick = () => {
                this.closeModal(document.getElementById('linkDetailsModal'));
                this.editLink(link.id, isPersonal);
            };
            document.getElementById('deleteLinkBtn').onclick = () => {
                this.closeModal(document.getElementById('linkDetailsModal'));
                this.confirmDeleteLink(link.id, isPersonal);
            };
        } else {
            actions.style.display = 'none';
        }

        this.showModal('linkDetailsModal');
    }

    // ----------------------------------------------------------
    // Add / Edit Link
    // ----------------------------------------------------------
    showLinkModal(link = null, isPersonal = false) {
        this.editingLink   = link;
        this.editingPersonal = isPersonal || this.currentTab === 'personal';

        document.getElementById('linkModalTitle').textContent = link ? 'Editar Link' : 'Adicionar Link';

        if (link) {
            document.getElementById('linkTitle').value       = link.title;
            document.getElementById('linkUrl').value         = link.url;
            document.getElementById('linkCategory').value    = link.categoryId;
            document.getElementById('linkTags').value        = link.tags?.join(', ') || '';
            document.getElementById('linkDescription').value = link.description || '';
            document.getElementById('linkFavorite').checked  = link.favorite || false;
            document.getElementById('linkActive').checked    = link.active !== false;
        } else {
            document.getElementById('linkForm').reset();
            document.getElementById('linkActive').checked = true;
        }

        this.showModal('linkModal');
        document.getElementById('linkTitle').focus();
    }

    editLink(linkId, isPersonal) {
        const source = isPersonal ? this.personalLinks : this.links;
        const link   = source.find(l => l.id === linkId);
        if (link) this.showLinkModal(link, isPersonal);
    }

    async handleLinkSubmit() {
        const title       = document.getElementById('linkTitle').value.trim();
        let   url         = document.getElementById('linkUrl').value.trim();
        const categoryId  = document.getElementById('linkCategory').value;
        const tags        = document.getElementById('linkTags').value.split(',').map(t => t.trim()).filter(t => t);
        const description = document.getElementById('linkDescription').value.trim();
        const favorite    = document.getElementById('linkFavorite').checked;
        const active      = document.getElementById('linkActive').checked;

        if (!title || !url || !categoryId) {
            this.showToast('Preencha todos os campos obrigatórios!', 'error');
            return;
        }

        // Convert Figma URLs
        const cat = this.categories.find(c => c.id === categoryId);
        if (cat && cat.name.toLowerCase().includes('figma')) {
            try { url = convertFigmaUrlToApp(url); } catch (_) { /* keep as is */ }
        }

        this.showLoading(true);
        try {
            const isPersonal = this.editingPersonal;
            const colName    = isPersonal ? 'personalLinks' : 'links';
            const linkData   = {
                title, url, categoryId, tags, description, favorite, active,
                updatedAt: serverTimestamp()
            };

            if (isPersonal) {
                linkData.userId      = this.currentUser.uid;
                linkData.userName    = this.userProfile?.name || this.currentUser.displayName || 'Usuário';
            } else {
                linkData.addedBy     = this.currentUser.uid;
                linkData.addedByName = this.userProfile?.name || this.currentUser.displayName || 'Admin';
            }

            if (this.editingLink) {
                await updateDoc(doc(db, colName, this.editingLink.id), linkData);
                this.showToast('Link atualizado!', 'success');
            } else {
                linkData.createdAt  = serverTimestamp();
                linkData.clickCount = 0;
                await addDoc(collection(db, colName), linkData);
                this.showToast('Link adicionado!', 'success');
            }

            this.closeModal(document.getElementById('linkModal'));
            if (isPersonal) await this.loadPersonalLinks();
            else await this.loadLinks();
        } catch (err) {
            console.error('handleLinkSubmit:', err);
            this.showToast('Erro ao salvar link!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // ----------------------------------------------------------
    // Delete Link
    // ----------------------------------------------------------
    confirmDeleteLink(linkId, isPersonal) {
        const source = isPersonal ? this.personalLinks : this.links;
        const link   = source.find(l => l.id === linkId);
        if (!link) return;
        document.getElementById('confirmMessage').textContent = `Tem certeza que deseja excluir "${link.title}"?`;
        this.showModal('confirmModal');
        document.getElementById('confirmActionBtn').onclick = () => {
            this.deleteLink(linkId, isPersonal);
            this.closeModal(document.getElementById('confirmModal'));
        };
    }

    async deleteLink(linkId, isPersonal) {
        this.showLoading(true);
        try {
            const colName = isPersonal ? 'personalLinks' : 'links';
            await deleteDoc(doc(db, colName, linkId));
            this.showToast('Link excluído!', 'success');
            if (isPersonal) await this.loadPersonalLinks();
            else await this.loadLinks();
        } catch (err) {
            console.error('deleteLink:', err);
            this.showToast('Erro ao excluir link!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // ----------------------------------------------------------
    // Favorite (public links only, admin)
    // ----------------------------------------------------------
    async toggleFavorite(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;
        try {
            const val = !link.favorite;
            await updateDoc(doc(db, 'links', linkId), { favorite: val });
            link.favorite = val;
            this.renderLinks();
            this.showToast(val ? 'Adicionado aos favoritos!' : 'Removido dos favoritos!', 'success');
        } catch (err) {
            this.showToast('Erro ao atualizar favorito!', 'error');
        }
    }

    // ----------------------------------------------------------
    // Category
    // ----------------------------------------------------------
    async handleCategorySubmit() {
        const name = document.getElementById('categoryName').value.trim();
        const icon = document.getElementById('categoryIcon').value.trim() || 'fas fa-folder';
        if (!name) { this.showToast('Digite o nome da categoria!', 'error'); return; }
        this.showLoading(true);
        try {
            await addDoc(collection(db, 'categories'), { name, icon, createdAt: serverTimestamp() });
            this.showToast('Categoria criada!', 'success');
            this.closeModal(document.getElementById('categoryModal'));
            await this.loadCategories();
        } catch (err) {
            this.showToast('Erro ao criar categoria!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // ----------------------------------------------------------
    // Admin Panel
    // ----------------------------------------------------------
    async openAdminPanel() {
        this.showModal('adminPanelModal');
        await this.loadAdminPanelData();
    }

    async loadAdminPanelData() {
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const users     = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const admins    = users.filter(u => u.role === 'admin');

            document.getElementById('totalUsersCount').textContent = users.length;
            document.getElementById('totalAdminsCount').textContent = admins.length;
            document.getElementById('totalLinksCount').textContent  = this.links.length;

            const tableEl = document.getElementById('usersTable');
            if (users.length === 0) {
                tableEl.innerHTML = '<p style="color:var(--text-muted)">Nenhum usuário cadastrado.</p>';
                return;
            }

            tableEl.innerHTML = `
            <table class="users-list-table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Função</th>
                        <th>Cadastro</th>
                        <th>Ação</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                    <tr>
                        <td>${u.name || '—'}</td>
                        <td>${u.email || '—'}</td>
                        <td>
                            <span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}">
                                ${u.role === 'admin' ? '<i class="fas fa-shield-alt"></i> Admin' : '<i class="fas fa-user"></i> Usuário'}
                            </span>
                        </td>
                        <td>${u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                        <td>
                            ${u.id !== this.currentUser.uid ? `
                            <button class="btn btn-sm ${u.role === 'admin' ? 'btn-secondary' : 'btn-primary'}"
                                onclick="window.app.toggleUserRole('${u.id}', '${u.role}')">
                                ${u.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                            </button>` : '<span style="color:var(--text-muted);font-size:.8rem">Você</span>'}
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
        } catch (err) {
            console.error('loadAdminPanelData:', err);
            document.getElementById('usersTable').innerHTML = '<p style="color:var(--danger-color)">Erro ao carregar usuários.</p>';
        }
    }

    async toggleUserRole(uid, currentRole) {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        const msg     = newRole === 'admin'
            ? 'Deseja tornar este usuário administrador?'
            : 'Deseja remover a função de administrador deste usuário?';
        document.getElementById('confirmMessage').textContent = msg;
        this.showModal('confirmModal');
        document.getElementById('confirmActionBtn').onclick = async () => {
            this.closeModal(document.getElementById('confirmModal'));
            this.showLoading(true);
            try {
                await updateDoc(doc(db, 'users', uid), { role: newRole });
                this.showToast(`Função atualizada para ${newRole === 'admin' ? 'Administrador' : 'Usuário'}!`, 'success');
                await this.loadAdminPanelData();
            } catch (err) {
                this.showToast('Erro ao atualizar função!', 'error');
            } finally {
                this.showLoading(false);
            }
        };
    }

    // ----------------------------------------------------------
    // Modal helpers
    // ----------------------------------------------------------
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('show');
        document.body.style.overflow = '';
        modal.querySelectorAll('form').forEach(f => f.reset());
        this.editingLink = null;
    }

    // ----------------------------------------------------------
    // Loading & Toast
    // ----------------------------------------------------------
    showLoading(show) {
        document.getElementById('loadingOverlay').classList.toggle('show', show);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast     = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }
}

// ============================================================
// Bootstrap
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppState();
});

// Mobile sidebar close on outside click
document.addEventListener('DOMContentLoaded', () => {
    const sidebar       = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebar && sidebarToggle) {
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar && !sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        });
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 768 && sidebar) sidebar.classList.toggle('show');
        });
    }
});

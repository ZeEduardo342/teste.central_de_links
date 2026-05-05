// ════════════════════════════════════════════
//  CENTRAL DE LINKS — script.js
//  Firebase Auth + Firestore — v2.0
// ════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    collection, addDoc, getDocs, doc, getDoc,
    updateDoc, deleteDoc, query, orderBy, where,
    serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Firebase Config ──
const firebaseConfig = {
    apiKey: "api-key",
    authDomain: "central-de-links-cmp.firebaseapp.com",
    projectId: "central-de-links-cmp",
    storageBucket: "central-de-links-cmp.firebasestorage.app",
    messagingSenderId: "502211758516",
    appId: "1:502211758516:web:541ae82f18ad98178c8ae1"
};

const app   = initializeApp(firebaseConfig);
const auth  = getAuth(app);
const db    = getFirestore(app);

// ════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════
function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
}

function convertFigmaUrl(v) {
    v = (v || '').trim();
    if (/^figma:\/\//i.test(v)) return v.replace(/^FIGMA:\/\//i, 'figma://');
    const n = /^https?:\/\//i.test(v) ? v : 'https://' + v;
    try {
        const u = new URL(n);
        const s = u.pathname.split('/').filter(Boolean);
        const type = (s[0]?.toLowerCase() === 'proto') ? 'proto' : 'file';
        const key  = s[1];
        if (!key) return v;
        return `figma://${type}/${key}${u.search || ''}${u.hash || ''}`;
    } catch { return v; }
}

function isFigmaCategory(categories, categoryId) {
    const cat = categories.find(c => c.id === categoryId);
    return cat && cat.name.toLowerCase().includes('figma');
}

function isExternalCategory(categories, categoryId) {
    const cat = categories.find(c => c.id === categoryId);
    return cat && (
        cat.name.toLowerCase().includes('externo') ||
        cat.name.toLowerCase().includes('external')
    );
}

// ════════════════════════════════════════════
//  MAIN APPLICATION CLASS
// ════════════════════════════════════════════
class CentralDeLinks {
    constructor() {
        this.currentUser    = null;
        this.userProfile    = null; // Firestore user doc
        this.isAdmin        = false;
        this.links          = [];
        this.categories     = [];
        this.currentView    = 'public'; // 'public' | 'personal' | 'favorites'
        this.currentCategory = 'all';
        this.searchQuery    = '';
        this.cardSize       = localStorage.getItem('cardSize') || 'medium';
        this.theme          = localStorage.getItem('theme') || 'light';
        this.editingLinkId  = null;
    }

    // ── Bootstrap ──
    async init() {
        this.applyTheme();
        this.applyCardSize();
        this.bindGlobalEvents();

        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = 'login.html';
                return;
            }
            this.currentUser = user;
            await this.loadUserProfile();
            this.renderUserUI();
            await this.loadData();
            this.showLoading(false);
        });
    }

    // ── User profile ──
    async loadUserProfile() {
        try {
            const snap = await getDoc(doc(db, 'users', this.currentUser.uid));
            if (snap.exists()) {
                this.userProfile = { id: snap.id, ...snap.data() };
            } else {
                // First login via Google / legacy — create profile
                this.userProfile = {
                    uid: this.currentUser.uid,
                    name: this.currentUser.displayName || this.currentUser.email,
                    email: this.currentUser.email,
                    role: 'user'
                };
                await setDoc(doc(db, 'users', this.currentUser.uid), {
                    ...this.userProfile,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                });
            }
            this.isAdmin = this.userProfile.role === 'admin';

            // update lastLogin
            await updateDoc(doc(db, 'users', this.currentUser.uid), {
                lastLogin: serverTimestamp()
            });
        } catch(e) {
            console.error('Error loading user profile:', e);
        }
    }

    renderUserUI() {
        const name  = this.userProfile?.name || this.currentUser.email;
        const email = this.currentUser.email;
        const role  = this.isAdmin ? 'Administrador' : 'Usuário';
        const av    = initials(name);

        document.getElementById('userAvatarDisplay').textContent = av;
        document.getElementById('dropdownAvatar').textContent    = av;
        document.getElementById('dropdownName').textContent      = name;
        document.getElementById('dropdownEmail').textContent     = email;
        document.getElementById('dropdownRole').textContent      = role;

        // Show admin features
        if (this.isAdmin) {
            document.getElementById('adminPanelBtn').style.display = 'flex';
            document.getElementById('addPublicLinkBtn').style.display = 'flex';
        }
        document.getElementById('addPersonalLinkBtn').style.display = 'flex';
    }

    // ── Theme ──
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
    }

    // ── Card size ──
    applyCardSize() {
        const grid = document.getElementById('linksList');
        if (grid) grid.setAttribute('data-size', this.cardSize);

        ['small','medium','large'].forEach(s => {
            const btn = document.getElementById('size' + s.charAt(0).toUpperCase() + s.slice(1));
            if (btn) btn.classList.toggle('active', s === this.cardSize);
        });
    }

    setCardSize(size) {
        this.cardSize = size;
        localStorage.setItem('cardSize', size);
        this.applyCardSize();
    }

    // ── Load data ──
    async loadData() {
        this.showLoading(true);
        try {
            await Promise.all([this.loadCategories(), this.loadLinks()]);
        } catch(e) {
            this.showToast('Erro ao carregar dados!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadCategories() {
        const snap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
        this.categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (this.categories.length === 0) {
            await this.createDefaultCategories();
            return this.loadCategories();
        }

        this.updateCategoryFilter();
        this.updateCategorySelectInForm();
    }

    async createDefaultCategories() {
        const defaults = [
            { name: 'Designs Figma',   icon: 'fas fa-palette' },
            { name: 'Apresentações',   icon: 'fas fa-desktop' },
            { name: 'Links Externos',  icon: 'fas fa-external-link-alt' },
            { name: 'Documentos',      icon: 'fas fa-file-alt' },
            { name: 'Ferramentas',     icon: 'fas fa-tools' }
        ];
        for (const cat of defaults) {
            await addDoc(collection(db, 'categories'), { ...cat, createdAt: serverTimestamp() });
        }
    }

    async loadLinks() {
        // Load public links
        const pubSnap = await getDocs(query(collection(db, 'links'), orderBy('createdAt', 'desc')));
        const pubLinks = pubSnap.docs.map(d => ({ id: d.id, linkType: 'public', ...d.data() }));

        // Load personal links of this user
        const perSnap = await getDocs(
            query(collection(db, 'personalLinks'),
                  where('ownerId', '==', this.currentUser.uid),
                  orderBy('createdAt', 'desc'))
        );
        const perLinks = perSnap.docs.map(d => ({ id: d.id, linkType: 'personal', ...d.data() }));

        this.links = [...pubLinks, ...perLinks];
        this.renderLinks();
    }

    // ── Category filter ──
    updateCategoryFilter() {
        const sel = document.getElementById('categoryFilter');
        if (!sel) return;
        sel.innerHTML = '<option value="all">Todas as categorias</option>';
        this.categories.forEach(cat => {
            sel.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }

    updateCategorySelectInForm() {
        const sel = document.getElementById('linkCategory');
        if (!sel) return;
        sel.innerHTML = '<option value="">Selecionar...</option>';
        this.categories.forEach(cat => {
            sel.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }

    // ── Render ──
    renderLinks() {
        const grid      = document.getElementById('linksList');
        const favStrip  = document.getElementById('favoritesList');
        const favSec    = document.getElementById('favoritesSection');
        const empty     = document.getElementById('emptyState');

        let pool = this.links;

        // filter by view
        if (this.currentView === 'public')   pool = pool.filter(l => l.linkType === 'public');
        if (this.currentView === 'personal') pool = pool.filter(l => l.linkType === 'personal');
        if (this.currentView === 'favorites') pool = pool.filter(l => l.favorite);

        // filter by category
        if (this.currentCategory !== 'all') {
            pool = pool.filter(l => l.categoryId === this.currentCategory);
        }

        // search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            pool = pool.filter(l =>
                (l.title || '').toLowerCase().includes(q) ||
                (l.url   || '').toLowerCase().includes(q) ||
                (l.description || '').toLowerCase().includes(q) ||
                (l.tags || []).some(t => t.toLowerCase().includes(q))
            );
        }

        // favorites strip (only in public/personal views)
        const favs = this.links.filter(l => l.favorite &&
            (this.currentView === 'favorites' ? true :
             (this.currentView === 'public'   ? l.linkType === 'public'   :
                                                l.linkType === 'personal')));

        if (favs.length > 0 && this.currentView !== 'favorites') {
            favSec.style.display = 'block';
            favStrip.innerHTML = favs.map(l => this.buildCard(l)).join('');
        } else {
            favSec.style.display = 'none';
        }

        // main grid
        grid.innerHTML = pool.length ? pool.map(l => this.buildCard(l)).join('') : '';
        empty.style.display = pool.length ? 'none' : 'block';

        this.bindCardEvents();
    }

    buildCard(link) {
        const cat     = this.categories.find(c => c.id === link.categoryId);
        const catName = cat ? cat.name : 'Sem categoria';
        const catIcon = cat ? cat.icon : 'fas fa-folder';
        const isFigma = isFigmaCategory(this.categories, link.categoryId);
        const isExt   = isExternalCategory(this.categories, link.categoryId);

        const tags = (link.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
        const typeBadge = `<span class="card-type-badge ${link.linkType}">${link.linkType === 'personal' ? 'Pessoal' : 'Público'}</span>`;

        // admin quick actions on public cards
        const canEdit = (link.linkType === 'personal' && link.ownerId === this.currentUser?.uid) || this.isAdmin;
        const canDelete = canEdit;

        const quickActions = `
            <div class="card-quick-actions">
                <button class="card-action-btn ${link.favorite ? 'fav-active' : ''}"
                    data-action="fav" data-id="${link.id}" data-type="${link.linkType}"
                    title="${link.favorite ? 'Remover favorito' : 'Favoritar'}">
                    <i class="fas fa-star"></i>
                </button>
                ${canEdit ? `<button class="card-action-btn" data-action="edit" data-id="${link.id}" data-type="${link.linkType}" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                ${canDelete ? `<button class="card-action-btn danger-btn" data-action="delete" data-id="${link.id}" data-type="${link.linkType}" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
            </div>`;

        // Open button for external links
        const openBtn = isExt
            ? `<button class="open-link-btn" data-action="open" data-id="${link.id}" data-type="${link.linkType}">
                   <i class="fas fa-external-link-alt"></i> Abrir
               </button>`
            : '';

        return `
        <div class="link-card ${link.active === false ? 'inactive' : ''}"
             data-id="${link.id}" data-type="${link.linkType}">
            ${typeBadge}
            <div class="link-card-header">
                <div class="link-card-title-area">
                    <div class="link-title">${link.title}</div>
                    <div class="link-url">${link.url}</div>
                </div>
                ${quickActions}
            </div>
            ${link.description ? `<div class="link-description">${link.description}</div>` : ''}
            ${tags ? `<div class="link-tags">${tags}</div>` : ''}
            <div class="link-card-footer">
                <div class="link-category-label">
                    <i class="${catIcon}"></i> ${catName}
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem">
                    ${openBtn}
                    <span class="link-date">${formatDate(link.createdAt)}</span>
                </div>
            </div>
        </div>`;
    }

    bindCardEvents() {
        document.querySelectorAll('.link-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Ignore clicks on action buttons
                const btn = e.target.closest('[data-action]');
                if (btn) {
                    e.stopPropagation();
                    this.handleCardAction(btn.dataset.action, btn.dataset.id, btn.dataset.type);
                    return;
                }
                // Open link on click
                const linkId   = card.dataset.id;
                const linkType = card.dataset.type;
                const link = this.findLink(linkId, linkType);
                if (!link || link.active === false) return;
                this.openOrShowDetails(link);
            });
        });
    }

    handleCardAction(action, id, type) {
        const link = this.findLink(id, type);
        if (!link) return;

        if (action === 'fav')    this.toggleFavorite(link);
        if (action === 'edit')   this.showAddLinkModal(type, link);
        if (action === 'delete') this.confirmDelete(link);
        if (action === 'open')   { window.open(link.url, '_blank'); this.incrementClicks(link); }
    }

    findLink(id, type) {
        return this.links.find(l => l.id === id && l.linkType === type);
    }

    openOrShowDetails(link) {
        const isFigma = isFigmaCategory(this.categories, link.categoryId);
        const isExt   = isExternalCategory(this.categories, link.categoryId);

        if (isFigma) {
            const figmaUrl = convertFigmaUrl(link.url);
            window.location.href = figmaUrl;
            this.incrementClicks(link);
        } else if (isExt) {
            // External links: show details with open button
            this.showLinkDetails(link);
        } else {
            this.showLinkDetails(link);
        }
    }

    // ── Link Details ──
    showLinkDetails(link) {
        const cat      = this.categories.find(c => c.id === link.categoryId);
        const catName  = cat ? cat.name : 'Sem categoria';
        const isFigma  = isFigmaCategory(this.categories, link.categoryId);
        const isExt    = isExternalCategory(this.categories, link.categoryId);
        const canEdit  = (link.linkType === 'personal' && link.ownerId === this.currentUser?.uid) || this.isAdmin;
        const tags     = (link.tags || []).map(t => `<span class="tag">${t}</span>`).join('') || '<em style="color:var(--text-muted)">Nenhuma</em>';

        // Resolve display URL
        let displayUrl = link.url;
        if (isFigma) displayUrl = link.url; // show original

        document.getElementById('detailsTitle').textContent = link.title;

        // Copy URL action
        const copyId = 'copyUrlBtn_' + link.id;

        document.getElementById('detailsBody').innerHTML = `
        <div class="details-section">
            <div>
                <div class="details-field-label" style="margin-bottom:0.35rem">URL original</div>
                <div class="details-url-box">
                    <a href="${link.url}" target="_blank">${link.url}</a>
                </div>
            </div>

            <div class="details-grid">
                <div class="details-field">
                    <div class="details-field-label">Categoria</div>
                    <div class="details-field-value">${catName}</div>
                </div>
                <div class="details-field">
                    <div class="details-field-label">Tipo</div>
                    <div class="details-field-value">${link.linkType === 'personal' ? 'Pessoal' : 'Público'}</div>
                </div>
                <div class="details-field">
                    <div class="details-field-label">Adicionado em</div>
                    <div class="details-field-value">${formatDate(link.createdAt)}</div>
                </div>
                <div class="details-field">
                    <div class="details-field-label">Cliques</div>
                    <div class="details-field-value">${link.clickCount || 0}</div>
                </div>
                ${this.isAdmin && link.addedByName ? `
                <div class="details-field">
                    <div class="details-field-label">Adicionado por</div>
                    <div class="details-field-value">${link.addedByName}</div>
                </div>` : ''}
                <div class="details-field">
                    <div class="details-field-label">Status</div>
                    <div class="details-field-value">${link.active !== false ? 'Ativo' : 'Inativo'}</div>
                </div>
            </div>

            ${link.description ? `
            <div class="details-field">
                <div class="details-field-label">Descrição</div>
                <div class="details-field-value">${link.description}</div>
            </div>` : ''}

            <div class="details-field">
                <div class="details-field-label">Tags</div>
                <div class="link-tags" style="margin-top:0.25rem">${tags}</div>
            </div>

            <div class="details-actions">
                <button class="btn btn-outline btn-sm" id="${copyId}">
                    <i class="fas fa-copy"></i> Copiar link
                </button>
                ${isExt || isFigma ? `
                <button class="btn btn-primary btn-sm" onclick="window.open('${isFigma ? convertFigmaUrl(link.url) : link.url}', '_blank')">
                    <i class="fas fa-external-link-alt"></i> Abrir
                </button>` : ''}
                ${canEdit ? `
                <button class="btn btn-outline btn-sm" onclick="app.editFromDetails('${link.id}','${link.linkType}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-sm" onclick="app.confirmDeleteFromDetails('${link.id}','${link.linkType}')">
                    <i class="fas fa-trash"></i> Excluir
                </button>` : ''}
            </div>
        </div>`;

        // Copy button
        document.getElementById(copyId)?.addEventListener('click', () => {
            navigator.clipboard.writeText(link.url).then(() => {
                this.showToast('Link copiado!', 'success');
            });
        });

        this.showModal('detailsModal');
        this.incrementClicks(link);
    }

    editFromDetails(id, type) {
        this.closeModal('detailsModal');
        const link = this.findLink(id, type);
        if (link) this.showAddLinkModal(type, link);
    }

    confirmDeleteFromDetails(id, type) {
        this.closeModal('detailsModal');
        const link = this.findLink(id, type);
        if (link) this.confirmDelete(link);
    }

    // ── Add/Edit Link ──
    showAddLinkModal(type, link = null) {
        this.editingLinkId = link ? link.id : null;
        document.getElementById('linkType').value = type;

        document.getElementById('linkModalTitle').textContent = link
            ? (type === 'personal' ? 'Editar meu link' : 'Editar link público')
            : (type === 'personal' ? 'Adicionar meu link' : 'Adicionar link público');

        // Reset form
        document.getElementById('linkForm').reset();
        document.getElementById('linkActive').checked = true;
        document.getElementById('urlHint').style.display = 'none';

        // Fill if editing
        if (link) {
            document.getElementById('linkTitle').value       = link.title || '';
            document.getElementById('linkUrl').value         = link.url   || '';
            document.getElementById('linkCategory').value    = link.categoryId || '';
            document.getElementById('linkTags').value        = (link.tags || []).join(', ');
            document.getElementById('linkDescription').value = link.description || '';
            document.getElementById('linkFavorite').checked  = !!link.favorite;
            document.getElementById('linkActive').checked    = link.active !== false;
        }

        // Show/hide active field (personal links always active)
        document.getElementById('linkActiveGroup').style.display = type === 'public' && this.isAdmin ? 'flex' : 'none';

        this.updateUrlHint();
        this.showModal('linkModal');
        document.getElementById('linkTitle').focus();
    }

    updateUrlHint() {
        const catId  = document.getElementById('linkCategory').value;
        const hint   = document.getElementById('urlHint');
        if (!catId) { hint.style.display='none'; return; }

        if (isFigmaCategory(this.categories, catId)) {
            hint.textContent = '💡 Cole o link do Figma — ele será convertido automaticamente para abrir no app.';
            hint.style.display = 'block';
        } else if (isExternalCategory(this.categories, catId)) {
            hint.textContent = '🔗 Links externos abrem com um botão dedicado nos cards.';
            hint.style.display = 'block';
        } else {
            hint.style.display = 'none';
        }
    }

    async handleLinkSubmit(e) {
        e.preventDefault();
        const title       = document.getElementById('linkTitle').value.trim();
        let   url         = document.getElementById('linkUrl').value.trim();
        const categoryId  = document.getElementById('linkCategory').value;
        const tags        = document.getElementById('linkTags').value.split(',').map(t => t.trim()).filter(Boolean);
        const description = document.getElementById('linkDescription').value.trim();
        const favorite    = document.getElementById('linkFavorite').checked;
        const active      = document.getElementById('linkActive').checked;
        const type        = document.getElementById('linkType').value;

        if (!title || !url || !categoryId) {
            this.showToast('Preencha os campos obrigatórios!', 'error');
            return;
        }

        // Auto-convert Figma links
        if (isFigmaCategory(this.categories, categoryId)) {
            url = convertFigmaUrl(url);
        }

        this.showLoading(true);
        try {
            const col   = type === 'personal' ? 'personalLinks' : 'links';
            const data  = {
                title, url, categoryId, tags, description, favorite,
                active: type === 'public' ? active : true,
                updatedAt: serverTimestamp(),
                addedByUid:  this.currentUser.uid,
                addedByName: this.userProfile?.name || this.currentUser.email
            };

            if (type === 'personal') {
                data.ownerId = this.currentUser.uid;
            }

            if (this.editingLinkId) {
                await updateDoc(doc(db, col, this.editingLinkId), data);
                this.showToast('Link atualizado!', 'success');
            } else {
                data.createdAt  = serverTimestamp();
                data.clickCount = 0;
                await addDoc(collection(db, col), data);
                this.showToast('Link adicionado!', 'success');
            }

            this.closeModal('linkModal');
            await this.loadLinks();
        } catch(err) {
            console.error(err);
            this.showToast('Erro ao salvar link!', 'error');
        } finally {
            this.showLoading(false);
            this.editingLinkId = null;
        }
    }

    // ── Favorite ──
    async toggleFavorite(link) {
        const col = link.linkType === 'personal' ? 'personalLinks' : 'links';
        try {
            const newVal = !link.favorite;
            await updateDoc(doc(db, col, link.id), { favorite: newVal });
            link.favorite = newVal;
            this.renderLinks();
            this.showToast(newVal ? 'Adicionado aos favoritos!' : 'Removido dos favoritos!', 'success');
        } catch(e) {
            this.showToast('Erro ao atualizar favorito!', 'error');
        }
    }

    // ── Delete ──
    confirmDelete(link) {
        document.getElementById('confirmMessage').textContent =
            `Excluir "${link.title}"? Esta ação não pode ser desfeita.`;
        document.getElementById('confirmActionBtn').onclick = () => {
            this.deleteLink(link);
            this.closeModal('confirmModal');
        };
        this.showModal('confirmModal');
    }

    async deleteLink(link) {
        const col = link.linkType === 'personal' ? 'personalLinks' : 'links';
        this.showLoading(true);
        try {
            await deleteDoc(doc(db, col, link.id));
            this.showToast('Link excluído!', 'success');
            await this.loadLinks();
        } catch(e) {
            this.showToast('Erro ao excluir!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // ── Click count ──
    async incrementClicks(link) {
        const col = link.linkType === 'personal' ? 'personalLinks' : 'links';
        try {
            const newCount = (link.clickCount || 0) + 1;
            await updateDoc(doc(db, col, link.id), { clickCount: newCount, lastAccessed: serverTimestamp() });
            link.clickCount = newCount;
        } catch(_) {}
    }

    // ── Category Modal ──
    showCategoryModal() {
        this.showModal('categoryModal');
        document.getElementById('categoryName').focus();
    }

    async handleCategorySubmit(e) {
        e.preventDefault();
        const name = document.getElementById('categoryName').value.trim();
        const icon = document.getElementById('categoryIcon').value.trim() || 'fas fa-folder';
        if (!name) return;
        this.showLoading(true);
        try {
            await addDoc(collection(db, 'categories'), { name, icon, createdAt: serverTimestamp() });
            this.showToast('Categoria criada!', 'success');
            this.closeModal('categoryModal');
            await this.loadCategories();
            this.renderAdminCategories();
        } catch(e) {
            this.showToast('Erro ao criar categoria!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteCategory(id) {
        this.showLoading(true);
        try {
            await deleteDoc(doc(db, 'categories', id));
            this.showToast('Categoria excluída!', 'success');
            await this.loadCategories();
            this.renderAdminCategories();
        } catch(e) {
            this.showToast('Erro ao excluir categoria!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // ── Admin Panel ──
    async showAdminPanel() {
        this.showModal('adminModal');
        await this.renderAdminUsers();
        this.renderAdminCategories();
        this.renderAdminStats();
    }

    async renderAdminStats() {
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const linksSnap = await getDocs(collection(db, 'links'));
            const users = usersSnap.docs.map(d => d.data());
            const admins = users.filter(u => u.role === 'admin').length;

            document.getElementById('statTotalUsers').textContent = users.length;
            document.getElementById('statAdmins').textContent     = admins;
            document.getElementById('statTotalLinks').textContent = linksSnap.size;
        } catch(e) { console.error(e); }
    }

    async renderAdminUsers() {
        const container = document.getElementById('usersTable');
        container.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Carregando...</p>';
        try {
            const snap  = await getDocs(collection(db, 'users'));
            const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            container.innerHTML = `
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Função</th>
                        <th>Desde</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                    <tr>
                        <td>
                            <div style="display:flex;align-items:center;gap:0.5rem">
                                <div class="user-avatar" style="width:28px;height:28px;font-size:0.65rem">${initials(u.name)}</div>
                                ${u.name || '—'}
                            </div>
                        </td>
                        <td style="color:var(--text-muted)">${u.email}</td>
                        <td>
                            <span class="role-badge ${u.role || 'user'}">
                                ${u.role === 'admin' ? '<i class="fas fa-shield-alt"></i> Admin' : '<i class="fas fa-user"></i> Usuário'}
                            </span>
                        </td>
                        <td style="color:var(--text-muted)">${formatDate(u.createdAt)}</td>
                        <td>
                            ${u.uid !== this.currentUser.uid ? `
                            <button class="btn btn-sm btn-outline" onclick="app.toggleUserRole('${u.id}', '${u.role || 'user'}')">
                                ${u.role === 'admin' ? '<i class="fas fa-user-minus"></i> Remover admin' : '<i class="fas fa-user-shield"></i> Tornar admin'}
                            </button>` : '<em style="color:var(--text-muted);font-size:0.75rem">Você</em>'}
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
        } catch(e) {
            container.innerHTML = '<p class="loading-text">Erro ao carregar usuários.</p>';
        }
    }

    async toggleUserRole(userId, currentRole) {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        this.showLoading(true);
        try {
            await updateDoc(doc(db, 'users', userId), { role: newRole });
            this.showToast(`Função alterada para ${newRole === 'admin' ? 'Administrador' : 'Usuário'}!`, 'success');
            await this.renderAdminUsers();
            await this.renderAdminStats();
        } catch(e) {
            this.showToast('Erro ao alterar função!', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderAdminCategories() {
        const container = document.getElementById('categoriesAdminList');
        if (!container) return;

        if (!this.categories.length) {
            container.innerHTML = '<p class="loading-text">Nenhuma categoria.</p>';
            return;
        }

        container.innerHTML = this.categories.map(cat => `
        <div class="category-admin-item">
            <div class="category-admin-info">
                <i class="${cat.icon}"></i>
                ${cat.name}
            </div>
            <button class="btn btn-sm btn-danger" onclick="app.confirmCategoryDelete('${cat.id}','${cat.name}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>`).join('');
    }

    confirmCategoryDelete(id, name) {
        document.getElementById('confirmMessage').textContent =
            `Excluir a categoria "${name}"? Os links desta categoria não serão removidos.`;
        document.getElementById('confirmActionBtn').onclick = () => {
            this.deleteCategory(id);
            this.closeModal('confirmModal');
        };
        this.showModal('confirmModal');
    }

    // ── Logout ──
    async logout() {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch(e) {
            this.showToast('Erro ao sair!', 'error');
        }
    }

    // ── Modal helpers ──
    showModal(id) {
        document.getElementById(id).classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeModal(id) {
        const modal = document.getElementById(id);
        modal.classList.remove('show');
        document.body.style.overflow = '';
        // Reset forms inside
        modal.querySelectorAll('form').forEach(f => f.reset());
        this.editingLinkId = null;
    }

    // ── Loading ──
    showLoading(show) {
        document.getElementById('loadingOverlay').classList.toggle('show', show);
    }

    // ── Toast ──
    showToast(message, type = 'info') {
        const icons = { success:'check-circle', error:'exclamation-circle', warning:'exclamation-triangle', info:'info-circle' };
        const icon  = icons[type] || 'info-circle';
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
        document.getElementById('toastContainer').appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    // ════════════════════════════════════════════
    //  EVENT BINDINGS
    // ════════════════════════════════════════════
    bindGlobalEvents() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // User dropdown toggle
        document.getElementById('userAvatarBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('userDropdown').classList.toggle('show');
        });
        document.addEventListener('click', () => {
            document.getElementById('userDropdown').classList.remove('show');
        });

        // View tabs
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentView = tab.dataset.view;

                // Show/hide add button based on view
                const pubBtn = document.getElementById('addPublicLinkBtn');
                const perBtn = document.getElementById('addPersonalLinkBtn');
                pubBtn.style.display = (this.currentView === 'public' && this.isAdmin) ? 'flex' : 'none';
                perBtn.style.display = (this.currentView === 'personal') ? 'flex' : 'none';

                this.renderLinks();
            });
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderLinks();
        });

        // Category filter
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.renderLinks();
        });

        // Link form
        document.getElementById('linkForm').addEventListener('submit', (e) => this.handleLinkSubmit(e));

        // Category hint update
        document.getElementById('linkCategory').addEventListener('change', () => this.updateUrlHint());

        // Category form
        document.getElementById('categoryForm').addEventListener('submit', (e) => this.handleCategorySubmit(e));

        // Modal close buttons (data-modal attribute)
        document.querySelectorAll('.modal-close[data-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal(btn.dataset.modal));
        });
        document.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal(btn.dataset.modalClose));
        });

        // Backdrop close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal.id);
            });
        });

        // Admin panel tabs
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('adminTab' + tab.dataset.adminTab.charAt(0).toUpperCase() + tab.dataset.adminTab.slice(1)).classList.add('active');
            });
        });
    }
}

// ── Bootstrap ──
const app = new CentralDeLinks();
window.app = app;
app.init();

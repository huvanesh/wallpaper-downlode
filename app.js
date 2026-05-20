/*
========================================================================
   AuraWall - Core Application Engine (HTML5 Canvas & IndexedDB)
========================================================================
*/

// --- Core Database Configuration (IndexedDB) ---
const DB_NAME = 'AuraWallDB';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';

let db = null;

// Seed wallpapers already in the folder
const SEED_WALLPAPERS = [
    {
        id: 'seed-fuji-mountains',
        title: 'Mount Fuji at Night',
        category: 'Landscape',
        creator: 'Tokyo Lens',
        tags: ['Japan', 'Mount Fuji', 'Mountain', 'Night', 'Stars', 'City Lights', 'Landscape'],
        width: 6000,
        height: 4000,
        url: './fuji-mountains-fujikawaguchiko-city-night-japan.jpg',
        views: 2405,
        downloads: 890,
        likes: 312,
        isSeed: true,
        orientation: 'landscape'
    },
    {
        id: 'seed-neon-city',
        title: 'Neon Shinjuku Streets',
        category: 'Cyberpunk',
        creator: 'ShibuyaRunner',
        tags: ['Cyberpunk', 'City', 'Neon', 'Rain', 'Street', 'Portrait', 'Japan', 'Tokyo'],
        width: 1080,
        height: 1920,
        url: './backiee-327983-portrait.jpg',
        views: 1890,
        downloads: 710,
        likes: 245,
        isSeed: true,
        orientation: 'portrait'
    },
    {
        id: 'seed-anime-floating',
        title: 'Anime Scenery - Floating Islands',
        category: 'Anime',
        creator: 'Makoto Fan',
        tags: ['Anime', 'Scenery', '4K', 'Clouds', 'Fantasy', 'Landscape', 'Sky', 'Islands'],
        width: 3840,
        height: 2160,
        url: './wp5683360-4k-anime-scenery-wallpapers.jpg',
        views: 3110,
        downloads: 1420,
        likes: 562,
        isSeed: true,
        orientation: 'landscape'
    },
    {
        id: 'seed-your-name-star',
        title: 'Your Name - Astronomical Scenery',
        category: 'Anime',
        creator: 'CometWatcher',
        tags: ['Anime', 'Scenery', 'Stars', 'Kimi no Na wa', 'Night Sky', 'Landscape', 'Lake'],
        width: 1920,
        height: 1080,
        url: './32654-1920x1080-desktop-1080p-your-name-wallpaper.jpg',
        views: 1540,
        downloads: 620,
        likes: 198,
        isSeed: true,
        orientation: 'landscape'
    },
    {
        id: 'seed-your-name-comet',
        title: 'Your Name - Twilight Comet',
        category: 'Anime',
        creator: 'Mitsuha Spark',
        tags: ['Anime', 'Twilight', 'Comet', 'Clouds', 'Sunset', 'Stars', 'Kimi no Na wa', 'Landscape'],
        width: 1920,
        height: 1080,
        url: './YOUR NAME WALLPAPER.jpg',
        views: 1250,
        downloads: 504,
        likes: 176,
        isSeed: true,
        orientation: 'landscape'
    }
];

// --- State Management ---
const state = {
    wallpapers: [],
    favorites: JSON.parse(localStorage.getItem('aurawall_favorites') || '[]'),
    activeTab: 'explore', // 'explore', 'favorites', 'uploads'
    filters: {
        search: '',
        category: 'all',
        orientation: 'all',
        resolution: 'all',
        sort: 'newest',
        color: ''
    },
    activeWallpaper: null,
    uploadedImageBlob: null,
    uploadedImageSpecs: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    await loadWallpapers();
    initUI();
    renderGallery();
    if (document.getElementById('wallpapers-grid')) {
        showToast('AuraWall loaded successfully', 'success');
    }
});

// --- Database Engine (IndexedDB) ---
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
            const dbInstance = e.target.result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
        
        request.onerror = (e) => {
            console.error('IndexedDB Error:', e.target.error);
            showToast('Database failed to initialize', 'danger');
            reject(e.target.error);
        };
    });
}

function saveWallpaperToDB(wallpaper) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(wallpaper);
        
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

function getWallpapersFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) return resolve([]);
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function loadWallpapers() {
    try {
        const userUploaded = await getWallpapersFromDB();
        
        // Read hidden seeds blacklisted by admin
        const hiddenSeeds = JSON.parse(localStorage.getItem('aurawall_hidden_seeds') || '[]');
        
        // Read seed overrides from localStorage
        const seedEdits = JSON.parse(localStorage.getItem('aurawall_seed_edits') || '{}');
        
        const activeSeeds = SEED_WALLPAPERS.filter(wp => !hiddenSeeds.includes(wp.id)).map(wp => {
            if (seedEdits[wp.id]) {
                return { ...wp, ...seedEdits[wp.id] };
            }
            return wp;
        });
        
        // Combine preloaded seeds and user uploads
        state.wallpapers = [...activeSeeds, ...userUploaded];
        
        // Refresh views/downloads stats inside indexDB if any are already customized
        // Make sure orientation flags are lowercase/proper
        state.wallpapers.forEach(wp => {
            if (!wp.orientation) {
                wp.orientation = wp.width >= wp.height ? 'landscape' : 'portrait';
            }
        });
    } catch (err) {
        console.error('Failed to load wallpapers from database:', err);
        const hiddenSeeds = JSON.parse(localStorage.getItem('aurawall_hidden_seeds') || '[]');
        const seedEdits = JSON.parse(localStorage.getItem('aurawall_seed_edits') || '{}');
        state.wallpapers = SEED_WALLPAPERS.filter(wp => !hiddenSeeds.includes(wp.id)).map(wp => {
            if (seedEdits[wp.id]) {
                return { ...wp, ...seedEdits[wp.id] };
            }
            return wp;
        });
    }
}

// --- Main UI Event Controllers ---
function initUI() {
    // 1. Sticky Header Animation
    const header = document.getElementById('main-header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 40) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // 2. Tab Navigation
    const logoBrand = document.getElementById('logo-brand');
    const navExplore = document.getElementById('nav-explore');
    const navFavorites = document.getElementById('nav-favorites');
    const navMyUploads = document.getElementById('nav-my-uploads');

    if (logoBrand && navExplore) logoBrand.addEventListener('click', () => switchTab('explore'));
    if (navExplore) navExplore.addEventListener('click', () => switchTab('explore'));
    if (navFavorites) navFavorites.addEventListener('click', () => switchTab('favorites'));
    if (navMyUploads) navMyUploads.addEventListener('click', () => switchTab('uploads'));

    // 3. Search inputs
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    
    if (searchInput && searchClear) {
        searchInput.addEventListener('input', (e) => {
            state.filters.search = e.target.value.trim();
            if (state.filters.search) {
                searchClear.classList.add('visible');
            } else {
                searchClear.classList.remove('visible');
            }
            renderGallery();
        });
        
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            state.filters.search = '';
            searchClear.classList.remove('visible');
            renderGallery();
        });
    }

    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            renderGallery();
            showToast(`Searching for "${state.filters.search || 'all'}"`, 'info');
        });
    }
    
    // Quick Trending tags
    document.querySelectorAll('.tag-bubble').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tag = e.target.dataset.tag;
            if (searchInput) searchInput.value = tag;
            state.filters.search = tag;
            if (searchClear) searchClear.classList.add('visible');
            renderGallery();
            const stickyFilters = document.getElementById('sticky-filters');
            if (stickyFilters) stickyFilters.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // 4. Filters & Category Chips
    const categoriesList = document.getElementById('categories-list');
    if (categoriesList) {
        categoriesList.addEventListener('click', (e) => {
            const chip = e.target.closest('.category-chip');
            if (!chip) return;
            
            document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.filters.category = chip.dataset.category;
            renderGallery();
        });
    }

    const orientationSelector = document.getElementById('orientation-selector');
    if (orientationSelector) {
        orientationSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.pill-btn');
            if (!btn) return;
            
            document.querySelectorAll('#orientation-selector .pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.filters.orientation = btn.dataset.orientation;
            renderGallery();
        });
    }

    const resolutionSelect = document.getElementById('resolution-select');
    if (resolutionSelect) {
        resolutionSelect.addEventListener('change', (e) => {
            state.filters.resolution = e.target.value;
            renderGallery();
        });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.filters.sort = e.target.value;
            renderGallery();
        });
    }

    // 5. Theme Changer
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        // Load preference
        const currentTheme = localStorage.getItem('aurawall_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateThemeIcon(currentTheme);

        themeToggle.addEventListener('click', () => {
            const targetTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', targetTheme);
            localStorage.setItem('aurawall_theme', targetTheme);
            updateThemeIcon(targetTheme);
            showToast(`Theme changed to ${targetTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}`, 'info');
        });
    }

    // 6. Modals Setup
    // Upload Trigger
    const btnOpenUpload = document.getElementById('btn-open-upload');
    if (btnOpenUpload) btnOpenUpload.addEventListener('click', () => openModal('upload-modal'));
    const btnCloseUpload = document.getElementById('btn-close-upload');
    if (btnCloseUpload) btnCloseUpload.addEventListener('click', () => closeModal('upload-modal'));
    const btnCloseDetails = document.getElementById('btn-close-details');
    if (btnCloseDetails) btnCloseDetails.addEventListener('click', () => closeModal('details-modal'));

    // Click outside to close modals
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeModal(e.target.id);
        }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal('upload-modal');
            closeModal('details-modal');
            const zoomedOverlay = document.getElementById('zoomed-overlay');
            if (zoomedOverlay) zoomedOverlay.classList.remove('active');
        }
    });

    // 7. Drag and Drop Upload Area events
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('upload-file-input');

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                handleUploadFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleUploadFile(e.target.files[0]);
            }
        });
    }

    const btnRemovePreview = document.getElementById('btn-remove-preview');
    if (btnRemovePreview) {
        btnRemovePreview.addEventListener('click', (e) => {
            e.stopPropagation(); // Avoid triggering file browse click
            clearUploadPreview();
        });
    }

    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUploadSubmit);
    }

    // 8. Wallpaper Details modal actions
    const btnLikeDetail = document.getElementById('btn-like-detail');
    const btnDownloadMain = document.getElementById('btn-download-main');
    const btnDownloadDropdown = document.getElementById('btn-download-dropdown');
    const downloadMenu = document.getElementById('download-menu');

    if (btnLikeDetail) {
        btnLikeDetail.addEventListener('click', () => {
            if (!state.activeWallpaper) return;
            toggleFavorite(state.activeWallpaper.id);
            updateDetailModalLikeState();
        });
    }

    if (btnDownloadMain) {
        btnDownloadMain.addEventListener('click', () => {
            if (!state.activeWallpaper) return;
            executeDownload('original');
        });
    }

    if (btnDownloadDropdown && downloadMenu) {
        btnDownloadDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadMenu.classList.toggle('active');
        });

        // Click item in download select options
        downloadMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.download-menu-item');
            if (!item) return;
            e.stopPropagation();
            downloadMenu.classList.remove('active');
            executeDownload(item.dataset.resolution);
        });

        window.addEventListener('click', () => {
            downloadMenu.classList.remove('active');
        });
    }

    // Zoom Image click
    const detailsImgContainer = document.getElementById('details-image-container');
    if (detailsImgContainer) {
        detailsImgContainer.addEventListener('click', () => {
            if (!state.activeWallpaper) return;
            const zoomOverlay = document.getElementById('zoomed-overlay');
            const zoomImg = document.getElementById('zoomed-img');
            if (zoomOverlay && zoomImg) {
                zoomImg.src = state.activeWallpaper.url;
                zoomOverlay.classList.add('active');
            }
        });
    }

    const zoomedOverlay = document.getElementById('zoomed-overlay');
    if (zoomedOverlay) {
        zoomedOverlay.addEventListener('click', () => {
            zoomedOverlay.classList.remove('active');
        });
    }
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-toggle-btn i');
    if (icon) {
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    }
}

// --- Navigation Tabs Switcher ---
function switchTab(tabId) {
    state.activeTab = tabId;
    
    // Toggle active classes on navbar buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    const banner = document.getElementById('hero-banner');
    const title = document.getElementById('gallery-current-title');
    
    if (tabId === 'explore') {
        const navExplore = document.getElementById('nav-explore');
        if (navExplore) navExplore.classList.add('active');
        if (banner) banner.style.display = 'flex';
        if (title) title.textContent = 'Explore Wallpapers';
    } else if (tabId === 'favorites') {
        const navFavorites = document.getElementById('nav-favorites');
        if (navFavorites) navFavorites.classList.add('active');
        if (banner) banner.style.display = 'none';
        if (title) title.textContent = 'My Favorites';
    } else if (tabId === 'uploads') {
        const navMyUploads = document.getElementById('nav-my-uploads');
        if (navMyUploads) navMyUploads.classList.add('active');
        if (banner) banner.style.display = 'none';
        if (title) title.textContent = 'My Shared Designs';
    }
    
    // Clear dynamic active color filters on tab change
    state.filters.color = '';
    
    renderGallery();
    showToast(`Switched view to: ${tabId}`, 'info');
}

// --- Wallpaper Card Grid Renderer ---
function renderGallery() {
    const grid = document.getElementById('wallpapers-grid');
    const countText = document.getElementById('gallery-count-text');
    if (!grid || !countText) return;
    
    // Filter wallpapers list
    let list = [...state.wallpapers];
    
    // Step 1: Base list matching active Tab
    if (state.activeTab === 'favorites') {
        list = list.filter(wp => state.favorites.includes(wp.id));
    } else if (state.activeTab === 'uploads') {
        list = list.filter(wp => !wp.isSeed);
    }
    
    // Step 2: Category Filter
    if (state.filters.category !== 'all') {
        list = list.filter(wp => wp.category.toLowerCase() === state.filters.category.toLowerCase());
    }
    
    // Step 3: Aspect orientation Filter
    if (state.filters.orientation !== 'all') {
        list = list.filter(wp => wp.orientation === state.filters.orientation);
    }
    
    // Step 4: Resolution Filter
    if (state.filters.resolution === '4k') {
        list = list.filter(wp => wp.width >= 3840);
    } else if (state.filters.resolution === '1080p') {
        list = list.filter(wp => wp.width >= 1920);
    }
    
    // Step 5: Color Swatch filter (exact match helper or tag check)
    if (state.filters.color) {
        list = list.filter(wp => wp.tags.some(tag => tag.toLowerCase() === state.filters.color.toLowerCase()));
    }
    
    // Step 6: Text Search index matching (Title, creator, or tags)
    if (state.filters.search) {
        const query = state.filters.search.toLowerCase();
        list = list.filter(wp => {
            return wp.title.toLowerCase().includes(query) ||
                   wp.creator.toLowerCase().includes(query) ||
                   wp.tags.some(t => t.toLowerCase().includes(query)) ||
                   wp.category.toLowerCase().includes(query);
        });
    }
    
    // Step 7: Sort order
    if (state.filters.sort === 'newest') {
        // Preloads keep their original seed IDs array ordering, new ones top
        list.reverse(); 
    } else if (state.filters.sort === 'likes') {
        list.sort((a, b) => b.likes - a.likes);
    } else if (state.filters.sort === 'downloads') {
        list.sort((a, b) => b.downloads - a.downloads);
    }
    
    // Update ambient background based on top matching item
    updateAmbientBg(list[0]);
    
    // Update count labels
    countText.textContent = `Showing ${list.length} wallpaper${list.length === 1 ? '' : 's'}`;
    
    // Clear grid
    grid.innerHTML = '';
    
    if (list.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-hourglass-empty"></i>
                <h3>No Visuals Found</h3>
                <p>We couldn't find any wallpapers matching your exact filters. Try adjusting your parameters or tags!</p>
            </div>
        `;
        return;
    }
    
    // Build Cards
    list.forEach(wp => {
        const isPortrait = wp.orientation === 'portrait';
        const isLiked = state.favorites.includes(wp.id);
        const resolutionLabel = wp.width >= 3840 ? '4K UHD' : `${wp.width}x${wp.height}`;
        
        const card = document.createElement('div');
        card.className = `wallpaper-card ${isPortrait ? 'portrait' : ''}`;
        card.dataset.id = wp.id;
        
        card.innerHTML = `
            <div class="wallpaper-image-container">
                <img src="${wp.url}" alt="${wp.title}" loading="lazy">
            </div>
            
            <div class="wallpaper-badges">
                <span class="resolution-badge">${resolutionLabel}</span>
                <button class="favorite-shortcut-btn ${isLiked ? 'active' : ''}" data-id="${wp.id}" title="Toggle Favorite">
                    <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                </button>
            </div>
            
            <div class="wallpaper-overlay">
                <div class="wallpaper-title-line">${wp.title}</div>
                <div class="wallpaper-meta-line">
                    <div class="wallpaper-author">
                        <i class="fa-solid fa-user"></i>
                        <span>${wp.creator}</span>
                    </div>
                    <div class="wallpaper-stats">
                        <span><i class="fa-solid fa-heart"></i> ${wp.likes}</span>
                        <span><i class="fa-solid fa-download"></i> ${wp.downloads}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Listeners for Card Click (Preview Modal)
        card.addEventListener('click', (e) => {
            // Check if like button shortcut was clicked
            if (e.target.closest('.favorite-shortcut-btn')) {
                e.stopPropagation();
                const btn = e.target.closest('.favorite-shortcut-btn');
                toggleFavorite(btn.dataset.id);
                renderGallery();
                return;
            }
            openDetailsModal(wp);
        });
        
        grid.appendChild(card);
    });
}

function updateAmbientBg(wp) {
    const heroAmbient = document.getElementById('hero-ambient-bg');
    if (!heroAmbient) return;
    if (wp) {
        heroAmbient.style.backgroundImage = `url('${wp.url}')`;
    } else {
        heroAmbient.style.backgroundImage = 'none';
    }
}

// --- Detail Visor Modal controller ---
async function openDetailsModal(wp) {
    state.activeWallpaper = wp;
    
    // Add active view
    wp.views += 1;
    if (!wp.isSeed) {
        saveWallpaperToDB(wp);
    }
    
    // Fill text content
    document.getElementById('details-img').src = wp.url;
    document.getElementById('details-category').textContent = wp.category;
    document.getElementById('details-title').textContent = wp.title;
    document.getElementById('details-creator').textContent = wp.creator;
    
    document.getElementById('details-views').textContent = formatStat(wp.views);
    document.getElementById('details-downloads').textContent = formatStat(wp.downloads);
    document.getElementById('details-likes').textContent = formatStat(wp.likes);
    
    document.getElementById('details-res-value').textContent = `${wp.width} x ${wp.height}`;
    
    const portraitClass = wp.orientation === 'portrait';
    const wrapper = document.getElementById('details-image-container');
    if (portraitClass) {
        wrapper.classList.add('portrait');
        document.getElementById('details-orientation-value').textContent = `Portrait (Aspect Ratios)`;
    } else {
        wrapper.classList.remove('portrait');
        document.getElementById('details-orientation-value').textContent = `Landscape (${getAspectRatioString(wp.width, wp.height)})`;
    }
    
    // Configure download menu texts
    document.getElementById('menu-original-desc').textContent = `Raw Resolution (${wp.width}x${wp.height})`;
    
    updateDetailModalLikeState();
    
    // Dynamic tag creation
    const tagList = document.getElementById('details-tags-list');
    tagList.innerHTML = '';
    wp.tags.forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'details-tag-btn';
        btn.textContent = `#${tag}`;
        btn.addEventListener('click', () => {
            closeModal('details-modal');
            const searchInput = document.getElementById('search-input');
            searchInput.value = tag;
            state.filters.search = tag;
            document.getElementById('search-clear').classList.add('visible');
            renderGallery();
            document.getElementById('sticky-filters').scrollIntoView({ behavior: 'smooth' });
        });
        tagList.appendChild(btn);
    });

    // Dominant Color palette loading placeholders
    const palette = document.getElementById('details-colors-palette');
    palette.innerHTML = `
        <div style="font-size: 11px; color: var(--text-muted);">
            <i class="fa-solid fa-circle-notch fa-spin"></i> Extracting dominant colors...
        </div>
    `;

    openModal('details-modal');
    
    // Programmatic pixel sampling color extraction after image loads
    const imgEl = document.getElementById('details-img');
    if (imgEl.complete) {
        extractAndRenderColors(imgEl, wp);
    } else {
        imgEl.onload = () => {
            if (state.activeWallpaper.id === wp.id) {
                extractAndRenderColors(imgEl, wp);
            }
        };
    }
}

function updateDetailModalLikeState() {
    const isLiked = state.favorites.includes(state.activeWallpaper.id);
    const likeBtn = document.getElementById('btn-like-detail');
    if (isLiked) {
        likeBtn.classList.add('active');
        likeBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
    } else {
        likeBtn.classList.remove('active');
        likeBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
}

// --- Dynamic Color Swatch Sampling Canvas Logic ---
function extractAndRenderColors(imgEl, wp) {
    const palette = document.getElementById('details-colors-palette');
    try {
        const colors = extractDominantColors(imgEl);
        palette.innerHTML = '';
        
        colors.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.setAttribute('data-color', color);
            
            // Add a click query search tag for color match
            swatch.addEventListener('click', () => {
                // Assign matching general tag names to trigger a search
                // Use the closest seed tags or just add hex search
                const matchingTag = wp.tags[index % wp.tags.length];
                closeModal('details-modal');
                
                const searchInput = document.getElementById('search-input');
                searchInput.value = matchingTag;
                state.filters.search = matchingTag;
                document.getElementById('search-clear').classList.add('visible');
                
                renderGallery();
                document.getElementById('sticky-filters').scrollIntoView({ behavior: 'smooth' });
                showToast(`Filtering category by matching tone: ${matchingTag}`, 'success');
            });
            
            palette.appendChild(swatch);
        });
    } catch (e) {
        console.error('Canvas color sampling blocked by cross-origin rules:', e);
        palette.innerHTML = `
            <div style="font-size: 11px; color: var(--text-muted);">
                <i class="fa-solid fa-triangle-exclamation"></i> Tonal palettes restricted.
            </div>
        `;
    }
}

function extractDominantColors(imgEl) {
    const canvas = document.getElementById('hidden-crop-canvas');
    const ctx = canvas.getContext('2d');
    
    // Draw image to a micro-scale 8x8 size to average out pixel blocks
    canvas.width = 8;
    canvas.height = 8;
    ctx.drawImage(imgEl, 0, 0, 8, 8);
    
    const imgData = ctx.getImageData(0, 0, 8, 8).data;
    const colors = [];
    const hexCount = {};
    
    // Parse pixels and sample unique high saturation groupings
    for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i+1];
        const b = imgData[i+2];
        const a = imgData[i+3];
        
        if (a < 200) continue; // Skip transparency
        
        // Convert to beautiful Hex codes
        const hex = '#' + [r, g, b].map(x => {
            const hexVal = x.toString(16);
            return hexVal.length === 1 ? '0' + hexVal : hexVal;
        }).join('');
        
        // Count frequencies
        hexCount[hex] = (hexCount[hex] || 0) + 1;
    }
    
    // Sort unique hexes by frequency counts
    const sortedHexes = Object.keys(hexCount).sort((a, b) => hexCount[b] - hexCount[a]);
    
    // Collect the top 5 visually distinct colors
    const uniquePalette = [];
    for (let hex of sortedHexes) {
        if (uniquePalette.length >= 5) break;
        
        // Confirm color is sufficiently different from already loaded ones
        const isDistinct = uniquePalette.every(existingHex => {
            return getColorDistance(existingHex, hex) > 45; // Euclidean color delta
        });
        
        if (isDistinct) {
            uniquePalette.push(hex);
        }
    }
    
    // Fallbacks if distinct sorting falls short
    while (uniquePalette.length < 5 && sortedHexes.length > uniquePalette.length) {
        uniquePalette.push(sortedHexes[uniquePalette.length]);
    }
    
    return uniquePalette.length >= 3 ? uniquePalette : ['#4f46e5', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b'];
}

function getColorDistance(hex1, hex2) {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    if (!rgb1 || !rgb2) return 0;
    
    return Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// --- Custom Device Canvas Resizer & Downloader ---
async function executeDownload(sizeOption) {
    const wp = state.activeWallpaper;
    if (!wp) return;
    
    showToast('Preparing custom device download crop...', 'info');
    
    wp.downloads += 1;
    if (!wp.isSeed) {
        saveWallpaperToDB(wp);
    }
    
    // Re-render explore grid changes
    renderGallery();
    
    // If original size is requested, trigger direct anchor download without canvas
    if (sizeOption === 'original') {
        triggerDirectDownload(wp.url, `${slugify(wp.title)}-original`);
        return;
    }
    
    // Size crops mapping configuration
    let targetWidth = 1920;
    let targetHeight = 1080;
    let optionName = 'desktop';
    
    if (sizeOption === '4k') {
        targetWidth = 3840;
        targetHeight = 2160;
        optionName = '4k';
    } else if (sizeOption === '1080p') {
        targetWidth = 1920;
        targetHeight = 1080;
        optionName = '1080p';
    } else if (sizeOption === 'mobile') {
        targetWidth = 1080;
        targetHeight = 2400; // 9:20 ratio
        optionName = 'mobile-crop';
    } else if (sizeOption === 'square') {
        targetWidth = 1080;
        targetHeight = 1080;
        optionName = 'square-crop';
    }
    
    try {
        const image = new Image();
        image.crossOrigin = 'anonymous'; // Bypasses browser security check if external
        image.src = wp.url;
        
        image.onload = () => {
            const canvas = document.getElementById('hidden-crop-canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            // Calculate cropping bounds (Center crop math)
            const imageRatio = image.naturalWidth / image.naturalHeight;
            const targetRatio = targetWidth / targetHeight;
            
            let sourceX = 0;
            let sourceY = 0;
            let sourceWidth = image.naturalWidth;
            let sourceHeight = image.naturalHeight;
            
            if (imageRatio > targetRatio) {
                // Source is wider than target ratio - crop sides
                sourceWidth = image.naturalHeight * targetRatio;
                sourceX = (image.naturalWidth - sourceWidth) / 2;
            } else {
                // Source is taller than target ratio - crop top/bottom
                sourceHeight = image.naturalWidth / targetRatio;
                sourceY = (image.naturalHeight - sourceHeight) / 2;
            }
            
            // Draw cropped portion
            ctx.drawImage(
                image, 
                sourceX, sourceY, sourceWidth, sourceHeight, 
                0, 0, targetWidth, targetHeight
            );
            
            // Convert to download link
            try {
                canvas.toBlob((blob) => {
                    const downloadUrl = URL.createObjectURL(blob);
                    triggerDirectDownload(downloadUrl, `aurawall-${slugify(wp.title)}-${optionName}.jpg`);
                    // Revoke memory reference
                    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
                    showToast('Cropped wallpaper ready! Downloaded.', 'success');
                }, 'image/jpeg', 0.95);
            } catch (canvasErr) {
                console.error('Canvas compilation restricted:', canvasErr);
                showToast('Secured crop restricted. Downloading original instead.', 'warning');
                triggerDirectDownload(wp.url, `${slugify(wp.title)}-original`);
            }
        };
        
        image.onerror = () => {
            showToast('Failed to load active image canvas context. Downloading original.', 'danger');
            triggerDirectDownload(wp.url, `${slugify(wp.title)}-original`);
        };
    } catch (e) {
        console.error('Download processor broke:', e);
        triggerDirectDownload(wp.url, `${slugify(wp.title)}-original`);
    }
}

function triggerDirectDownload(fileUrl, fileName) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Upload Processing Panel controllers ---
function handleUploadFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Unsupported file type. Please upload images.', 'danger');
        return;
    }
    
    // Set active blob
    state.uploadedImageBlob = file;
    
    // Read and Render real-time drop preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const previewUrl = e.target.result;
        
        // Show Image element
        const dropPreview = document.getElementById('drop-preview');
        const dropPreviewImg = document.getElementById('drop-preview-img');
        
        dropPreviewImg.src = previewUrl;
        dropPreview.style.display = 'flex';
        
        // Read natural image specs
        const img = new Image();
        img.src = previewUrl;
        img.onload = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            const isPortrait = height > width;
            const resolutionLabel = width >= 3840 ? '4K Ultra HD' : (width >= 1920 ? 'Full HD 1080p' : 'Standard Resolution');
            const ratioStr = getAspectRatioString(width, height);
            
            state.uploadedImageSpecs = {
                width,
                height,
                orientation: isPortrait ? 'portrait' : 'landscape',
                url: previewUrl
            };
            
            // Render spec box
            const resBox = document.getElementById('upload-res-box');
            const resValue = document.getElementById('upload-res-value');
            
            resBox.classList.add('active');
            resValue.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${width} x ${height} (${resolutionLabel} - ${ratioStr})`;
            
            // Autofill Title if blank
            const titleInput = document.getElementById('upload-title-input');
            if (!titleInput.value) {
                const cleanedName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ');
                titleInput.value = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
            }
            
            // Enable submit button
            document.getElementById('upload-submit-btn').removeAttribute('disabled');
            showToast('Image specs extracted successfully!', 'success');
        };
    };
    
    reader.readAsDataURL(file);
}

function clearUploadPreview() {
    state.uploadedImageBlob = null;
    state.uploadedImageSpecs = null;
    
    document.getElementById('drop-preview').style.display = 'none';
    document.getElementById('drop-preview-img').src = '';
    
    document.getElementById('upload-res-box').classList.remove('active');
    document.getElementById('upload-res-value').innerHTML = '';
    
    document.getElementById('upload-file-input').value = '';
    document.getElementById('upload-submit-btn').setAttribute('disabled', 'true');
    
    showToast('Upload file queue cleared', 'info');
}

async function handleUploadSubmit(e) {
    e.preventDefault();
    if (!state.uploadedImageBlob || !state.uploadedImageSpecs) {
        showToast('Please queue an image file to upload', 'warning');
        return;
    }
    
    const submitBtn = document.getElementById('upload-submit-btn');
    const oldHtml = submitBtn.innerHTML;
    
    // Start Loading Spin
    submitBtn.setAttribute('disabled', 'true');
    submitBtn.innerHTML = '<span class="spinner"></span> <span>Processing Upload...</span>';
    
    const titleVal = document.getElementById('upload-title-input').value.trim();
    const categoryVal = document.getElementById('upload-category-input').value;
    const creatorVal = document.getElementById('upload-creator-input').value.trim() || 'Anonymous';
    const tagsVal = document.getElementById('upload-tags-input').value;
    
    // Parse tags array
    const rawTags = tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0);
    // Auto append category and aspect flags
    const standardTags = [categoryVal, state.uploadedImageSpecs.orientation, ...rawTags];
    
    const newWallpaper = {
        id: 'user-' + Date.now(),
        title: titleVal,
        category: categoryVal,
        creator: creatorVal,
        tags: standardTags,
        width: state.uploadedImageSpecs.width,
        height: state.uploadedImageSpecs.height,
        url: state.uploadedImageSpecs.url, // Base64 stored locally in IndexedDB
        views: 1,
        downloads: 0,
        likes: 0,
        isSeed: false,
        orientation: state.uploadedImageSpecs.orientation
    };
    
    try {
        // Save to IndexedDB
        await saveWallpaperToDB(newWallpaper);
        
        // Refresh local memory and reload wallpapers
        await loadWallpapers();
        
        // Close modal and reset form
        closeModal('upload-modal');
        document.getElementById('upload-form').reset();
        clearUploadPreview();
        
        // Refresh views or switch tabs
        if (document.getElementById('inventory-tbody')) {
            if (typeof renderAdminDashboard === 'function') {
                renderAdminDashboard(); // Refresh admin list on upload!
            }
        } else {
            switchTab('uploads');
        }
        showToast('Wallpaper uploaded and synced locally!', 'success');
    } catch (err) {
        console.error('Error saving image to IndexedDB:', err);
        showToast('Upload failed: File exceeds local database limits.', 'danger');
    } finally {
        submitBtn.removeAttribute('disabled');
        submitBtn.innerHTML = oldHtml;
    }
}

// --- Helpers & Favorites System ---
function toggleFavorite(id) {
    const index = state.favorites.indexOf(id);
    const wp = state.wallpapers.find(w => w.id === id);
    
    if (index === -1) {
        state.favorites.push(id);
        if (wp) wp.likes += 1;
        showToast('Wallpaper added to your favorites', 'success');
    } else {
        state.favorites.splice(index, 1);
        if (wp) wp.likes = Math.max(0, wp.likes - 1);
        showToast('Removed from favorites', 'info');
    }
    
    // Save favorites array in localStorage
    localStorage.setItem('aurawall_favorites', JSON.stringify(state.favorites));
    
    // Sync seed updates or custom uploads updates back to DB if applicable
    if (wp && !wp.isSeed) {
        saveWallpaperToDB(wp);
    }
    
    // Trigger render matching tab rules
    if (state.activeTab === 'favorites') {
        renderGallery();
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.add('open');
    document.body.style.overflow = 'hidden'; // Lock background scroll
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('open');
    // Release locks if no other modal is active
    if (!document.querySelector('.modal-overlay.open')) {
        document.body.style.overflow = 'auto';
    }
    
    // Release active reference if detail modal closes
    if (modalId === 'details-modal') {
        state.activeWallpaper = null;
        const detailsImg = document.getElementById('details-img');
        if (detailsImg) detailsImg.onload = null;
    }
}

// Custom Toast Engine
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    else if (type === 'warning') iconClass = 'fa-solid fa-circle-exclamation';
    else if (type === 'danger') iconClass = 'fa-solid fa-circle-xmark';
    
    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Fade out and remove
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 3500);
}

// Aspect ratio string solver
function getAspectRatioString(w, h) {
    const r = gcd(w, h);
    const aspectW = w / r;
    const aspectH = h / r;
    
    // Simplify common aspect ratios
    if ((aspectW === 8 && aspectH === 5) || (aspectW === 16 && aspectH === 10)) return '16:10';
    if ((aspectW === 16 && aspectH === 9) || (aspectW === 1920 && aspectH === 1080)) return '16:9';
    if (aspectW === 4 && aspectH === 3) return '4:3';
    if (aspectW === 1 && aspectH === 1) return '1:1';
    if (aspectW === 9 && aspectH === 20) return '9:20';
    if (aspectW === 9 && aspectH === 16) return '9:16';
    
    return `${aspectW}:${aspectH}`;
}

function gcd(a, b) {
    return (b == 0) ? a : gcd(b, a % b);
}

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start
        .replace(/-+$/, '');            // Trim - from end
}

function formatStat(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num;
}

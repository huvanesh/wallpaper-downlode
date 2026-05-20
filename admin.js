/*
========================================================================
   AuraWall - Administrative Controller Script (admin.js)
========================================================================
*/

// --- State and Variables ---
let activeEditWallpaperId = null;

// --- Administration Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for app.js IndexedDB configuration to complete
    setTimeout(async () => {
        await reloadAdminDB();
        initAdminUI();
        renderAdminDashboard();
        showToast('Administrative workspace loaded', 'success');
    }, 200);
});

// Helper to force-reload database in sync with app.js
async function reloadAdminDB() {
    if (typeof loadWallpapers === 'function') {
        await loadWallpapers();
    }
}

// --- Admin UI Event Listeners ---
function initAdminUI() {
    const searchInput = document.getElementById('admin-search-input');
    const categorySelect = document.getElementById('admin-category-select');
    const sortSelect = document.getElementById('admin-sort-select');
    
    // 1. Search filter event
    searchInput.addEventListener('input', () => {
        renderAdminDashboard();
    });
    
    // 2. Dropdown filter events
    categorySelect.addEventListener('change', () => {
        renderAdminDashboard();
    });
    
    sortSelect.addEventListener('change', () => {
        renderAdminDashboard();
    });
    
    // 3. Settings - Restore factory seeds
    document.getElementById('btn-restore-seeds').addEventListener('click', async () => {
        if (confirm('Are you sure you want to restore all preloaded factory seed wallpapers? This will unhide any seeds you deleted.')) {
            localStorage.removeItem('aurawall_hidden_seeds');
            localStorage.removeItem('aurawall_seed_edits');
            
            await reloadAdminDB();
            renderAdminDashboard();
            showToast('All preloaded factory seeds restored!', 'success');
        }
    });
    
    // 4. Settings - Factory Reset Database
    document.getElementById('btn-factory-reset').addEventListener('click', async () => {
        if (confirm('⚠️ WARNING: This will completely wipe all uploaded wallpapers from IndexedDB and reset the platform to default factory settings. This cannot be undone! Proceed?')) {
            // Wipe IndexedDB store
            try {
                await wipeIndexedDBStore();
                localStorage.removeItem('aurawall_hidden_seeds');
                localStorage.removeItem('aurawall_seed_edits');
                localStorage.removeItem('aurawall_favorites');
                
                // Clear state favorites memory
                if (state) state.favorites = [];
                
                await reloadAdminDB();
                renderAdminDashboard();
                showToast('Database wiped and reset to factory specs!', 'success');
            } catch (err) {
                console.error('Factory reset failed:', err);
                showToast('Failed to wipe IndexedDB database.', 'danger');
            }
        }
    });
    
    // 5. Edit Modal controls
    document.getElementById('btn-close-edit').addEventListener('click', () => {
        closeModal('admin-edit-modal');
    });
    
    document.getElementById('admin-edit-form').addEventListener('submit', handleAdminEditSubmit);
}

// --- Dynamic Analytics & Table Renderer ---
function renderAdminDashboard() {
    const tbody = document.getElementById('inventory-tbody');
    const countText = document.getElementById('admin-count-text');
    
    // Fetch values
    const searchVal = document.getElementById('admin-search-input').value.trim().toLowerCase();
    const categoryVal = document.getElementById('admin-category-select').value;
    const sortVal = document.getElementById('admin-sort-select').value;
    
    // 1. Calculate and Render Metric Cards Sums
    const totalWallpapers = state.wallpapers.length;
    let totalViews = 0;
    let totalDownloads = 0;
    let totalLikes = 0;
    
    state.wallpapers.forEach(wp => {
        totalViews += wp.views || 0;
        totalDownloads += wp.downloads || 0;
        totalLikes += wp.likes || 0;
    });
    
    document.getElementById('metric-total-wallpapers').textContent = totalWallpapers;
    document.getElementById('metric-total-views').textContent = formatStat(totalViews);
    document.getElementById('metric-total-downloads').textContent = formatStat(totalDownloads);
    document.getElementById('metric-total-likes').textContent = formatStat(totalLikes);
    
    // 2. Filter Table List
    let list = [...state.wallpapers];
    
    // Category Chip filter
    if (categoryVal !== 'all') {
        list = list.filter(wp => wp.category.toLowerCase() === categoryVal.toLowerCase());
    }
    
    // Search input query filter
    if (searchVal) {
        list = list.filter(wp => {
            return wp.title.toLowerCase().includes(searchVal) ||
                   wp.creator.toLowerCase().includes(searchVal) ||
                   wp.tags.some(t => t.toLowerCase().includes(searchVal)) ||
                   wp.id.toLowerCase().includes(searchVal);
        });
    }
    
    // Sorting order filter
    if (sortVal === 'newest') {
        list.reverse();
    } else if (sortVal === 'views') {
        list.sort((a, b) => b.views - a.views);
    } else if (sortVal === 'downloads') {
        list.sort((a, b) => b.downloads - a.downloads);
    } else if (sortVal === 'likes') {
        list.sort((a, b) => b.likes - a.likes);
    }
    
    countText.textContent = `Displaying ${list.length} of ${totalWallpapers} total visual files`;
    
    // Clear rows
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fa-solid fa-folder-open" style="font-size: 28px; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                    No wallpapers found matching the search criteria.
                </td>
            </tr>
        `;
        return;
    }
    
    // Inject rows
    list.forEach(wp => {
        const isPortrait = wp.orientation === 'portrait';
        const ratioText = getAspectRatioString(wp.width, wp.height);
        const sourceLabel = wp.isSeed ? `<span style="font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(99,102,241,0.15); color:var(--primary-color); font-weight:700; margin-left:6px;">SEED</span>` : `<span style="font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(16,185,129,0.15); color:var(--success); font-weight:700; margin-left:6px;">USER</span>`;
        
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <div class="table-preview ${isPortrait ? 'portrait' : ''}">
                    <img src="${wp.url}" alt="${wp.title}">
                </div>
            </td>
            <td>
                <div class="table-info-cell">
                    <span class="table-title">${wp.title} ${sourceLabel}</span>
                    <span class="table-creator">by ${wp.creator}</span>
                </div>
            </td>
            <td>
                <div class="table-info-cell">
                    <span class="table-badge-res">${wp.width} x ${wp.height}</span>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Ratio: ${ratioText} (${wp.orientation})</span>
                </div>
            </td>
            <td>
                <span style="font-size:11px; padding:4px 10px; border-radius:30px; font-weight:700; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--text-secondary);">
                    ${wp.category}
                </span>
            </td>
            <td class="table-stat-col"><i class="fa-solid fa-eye"></i> ${wp.views}</td>
            <td class="table-stat-col"><i class="fa-solid fa-download"></i> ${wp.downloads}</td>
            <td class="table-stat-col"><i class="fa-solid fa-heart"></i> ${wp.likes}</td>
            <td>
                <div class="table-actions">
                    <button class="row-btn edit-btn" onclick="openAdminEdit('${wp.id}')" title="Edit Metadata">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="row-btn delete-btn" onclick="deleteWallpaperAdmin('${wp.id}')" title="Delete Wallpaper">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// --- Edit Metadata Functionality ---
window.openAdminEdit = function(wpId) {
    const wp = state.wallpapers.find(w => w.id === wpId);
    if (!wp) return;
    
    activeEditWallpaperId = wpId;
    
    // Set preview details in modal
    document.getElementById('edit-img-preview').src = wp.url;
    document.getElementById('edit-res-value').textContent = `${wp.width} x ${wp.height} (${wp.orientation})`;
    document.getElementById('edit-id-value').textContent = `ID: ${wp.id}`;
    
    // Populate form fields
    document.getElementById('edit-title-input').value = wp.title;
    document.getElementById('edit-category-input').value = wp.category;
    document.getElementById('edit-creator-input').value = wp.creator;
    
    // Strip automatic orientation tags if they clutter edit tags field
    const userTags = wp.tags.filter(t => t !== wp.category && t !== wp.orientation);
    document.getElementById('edit-tags-input').value = userTags.join(', ');
    
    openModal('admin-edit-modal');
};

async function handleAdminEditSubmit(e) {
    e.preventDefault();
    if (!activeEditWallpaperId) return;
    
    const wp = state.wallpapers.find(w => w.id === activeEditWallpaperId);
    if (!wp) return;
    
    const titleVal = document.getElementById('edit-title-input').value.trim();
    const categoryVal = document.getElementById('edit-category-input').value;
    const creatorVal = document.getElementById('edit-creator-input').value.trim() || 'Anonymous';
    const tagsVal = document.getElementById('edit-tags-input').value;
    
    // Parse tags array
    const rawTags = tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const fullTags = [categoryVal, wp.orientation, ...rawTags];
    
    const updatedMeta = {
        title: titleVal,
        category: categoryVal,
        creator: creatorVal,
        tags: fullTags
    };
    
    try {
        if (wp.isSeed) {
            // Save seed edits inside localStorage
            const seedEdits = JSON.parse(localStorage.getItem('aurawall_seed_edits') || '{}');
            seedEdits[wp.id] = updatedMeta;
            localStorage.setItem('aurawall_seed_edits', JSON.stringify(seedEdits));
        } else {
            // Save user upload changes to IndexedDB
            const updatedWallpaper = { ...wp, ...updatedMeta };
            await saveWallpaperToDB(updatedWallpaper);
        }
        
        closeModal('admin-edit-modal');
        await reloadAdminDB();
        renderAdminDashboard();
        showToast('Wallpaper metadata updated!', 'success');
    } catch (err) {
        console.error('Failed to save administrative changes:', err);
        showToast('Failed to save metadata updates.', 'danger');
    }
}

// --- Delete Wallpaper Functionality ---
window.deleteWallpaperAdmin = async function(wpId) {
    const wp = state.wallpapers.find(w => w.id === wpId);
    if (!wp) return;
    
    const label = wp.isSeed ? 'seeded factory wallpaper (this will hide it from the gallery grid)' : 'user uploaded wallpaper permanently from IndexedDB';
    
    if (confirm(`Are you sure you want to delete the wallpaper "${wp.title}"? This will remove this ${label}.`)) {
        try {
            if (wp.isSeed) {
                // Blacklist Seed ID inside localstorage
                const hiddenSeeds = JSON.parse(localStorage.getItem('aurawall_hidden_seeds') || '[]');
                if (!hiddenSeeds.includes(wpId)) {
                    hiddenSeeds.push(wpId);
                }
                localStorage.setItem('aurawall_hidden_seeds', JSON.stringify(hiddenSeeds));
            } else {
                // Delete user file from IndexedDB
                await deleteWallpaperFromDB(wpId);
            }
            
            await reloadAdminDB();
            renderAdminDashboard();
            showToast('Wallpaper deleted from active inventory', 'success');
        } catch (err) {
            console.error('Delete transaction failed:', err);
            showToast('Failed to execute delete transaction.', 'danger');
        }
    }
};

// IndexedDB direct database deleters
function deleteWallpaperFromDB(wpId) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(wpId);
        
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

function wipeIndexedDBStore() {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

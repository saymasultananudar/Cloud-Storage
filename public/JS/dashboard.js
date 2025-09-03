
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    loadUserData();
    loadFiles();

    document.getElementById('uploadBtn').addEventListener('click', handleUpload);
    document.getElementById('newFolderBtn').addEventListener('click', () => {
        openModal('newFolderModal');
    });
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    document.getElementById('newFolderForm').addEventListener('submit', handleNewFolder);


    setupModalActionButtons();

    setupSidebarNavigation();
});

let currentFileId = null;
let currentFileName = null;
let currentFolderId = null;
let currentViewingFolderId = null;
let folderHierarchy = [];
let currentView = 'files';
let isViewingRecent = false; // Track if we're viewing recent files

function setupSidebarNavigation() {
    const sidebarItems = document.querySelectorAll('.sidebar-nav li');
    const pageTitle = document.getElementById('page-title');

    sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all items
            sidebarItems.forEach(i => i.classList.remove('active'));
            // Add active class to clicked item
            item.classList.add('active');

            const link = item.querySelector('a');
            const icon = link.querySelector('i').outerHTML;
            const text = link.textContent.trim();

            // --- Update header text dynamically ---
            pageTitle.innerHTML = `${icon} ${text}`;

            if (text.includes('My Files')) {
                currentView = 'files';
                isViewingRecent = false;
                loadFiles();
            } else if (text.includes('Trash')) {
                currentView = 'trash';
                isViewingRecent = false;
                loadTrash();
            } else if (text.includes('Recent')) {
                currentView = 'files'; // still files view
                isViewingRecent = true;
                loadRecentFiles();
            } else {
                // Other menu items (Shared, Starred) - placeholder for now
                showToast('This feature is coming soon!', 'info');
            }

            setupModalActionButtons();
        });
    });
}

function setupModalActionButtons() {
    const renameBtn = document.getElementById('renameBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    if (renameBtn) {
        renameBtn.onclick = currentView === 'trash' ? restoreItem : renameFile;
        renameBtn.innerHTML = currentView === 'trash'
            ? '<i class="fas fa-undo"></i> Restore'
            : '<i class="fas fa-edit"></i> Rename';
    }
    if (downloadBtn) {
        downloadBtn.onclick = downloadSelected;
    }
    if (deleteBtn) {
        deleteBtn.onclick = currentView === 'trash' ? deletePermanently : moveToTrash;
        deleteBtn.innerHTML = currentView === 'trash'
            ? '<i class="fas fa-trash"></i> Delete Permanently'
            : '<i class="fas fa-trash"></i> Move to Trash';
    }
}

// --- unchanged functions below ---


async function loadUserData() {
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to load user data');

        const user = await response.json();
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userAvatar').textContent = user.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase();

        const usedGB = (user.storageUsed / 1073741824).toFixed(2);
        const totalGB = (user.storageLimit / 1073741824).toFixed(0);
        const percentUsed = ((user.storageUsed / user.storageLimit) * 100).toFixed(0);

        document.getElementById('storageText').textContent = `${usedGB} GB of ${totalGB} GB used`;
        document.getElementById('storageProgress').style.width = `${percentUsed}%`;
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function loadFiles(folderId = null, folderName = null) {
    try {
        currentViewingFolderId = folderId;

        if (folderId === null) {
            folderHierarchy = [];
        } else if (folderName && !folderHierarchy.find(f => f.id === folderId)) {
            folderHierarchy.push({ id: folderId, name: folderName });
        }

        updateBreadcrumbs();

        const url = folderId ? `/api/files?folderId=${folderId}` : '/api/files';
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to load files');

        const data = await response.json();
        if (data.success) {
            renderFiles(data.files, data.folders);
            setupModalActionButtons(); // Update modal buttons for files view
        } else {
            throw new Error(data.message || 'Failed to load files');
        }
    } catch (error) {
        console.error('Error loading files:', error);
        showToast('Failed to load files', 'error');
    }
}

async function loadTrash() {
    try {
        console.log('Frontend: Loading trash...');
        const response = await fetch('/api/trash', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        console.log('Frontend: Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Frontend: Response error:', errorText);
            throw new Error(`Failed to load trash: ${response.status}`);
        }

        const data = await response.json();
        console.log('Frontend: Response data:', data);

        if (data.success) {
            renderTrash(data.files, data.folders);
            setupModalActionButtons(); // Update modal buttons for trash view
        } else {
            throw new Error(data.message || 'Failed to load trash');
        }
    } catch (error) {
        console.error('Error loading trash:', error);
        showToast('Failed to load trash', 'error');
    }
}

async function loadRecentFiles() {
    try {
        // Clear folder hierarchy and update breadcrumbs for recent view
        folderHierarchy = [];
        updateBreadcrumbs();

        const response = await fetch('/api/files/recent', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to load recent files');

        const data = await response.json();
        if (data.success) {
            renderRecentFiles(data.data);
            setupModalActionButtons(); // Update modal buttons for files view
        } else {
            throw new Error(data.message || 'Failed to load recent files');
        }
    } catch (error) {
        console.error('Error loading recent files:', error);
        showToast('Failed to load recent files', 'error');
    }
}

function renderFiles(files, folders) {
    const fileBrowser = document.getElementById('fileBrowser');
    fileBrowser.innerHTML = '';

    if ((folders?.length || 0) === 0 && (files?.length || 0) === 0) {
        fileBrowser.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>No files or folders</h3>
                <p>Upload files or create a folder to get started</p>
            </div>
        `;
        return;
    }

    folders.forEach(folder => fileBrowser.appendChild(createFolderElement(folder)));
    files.forEach(file => fileBrowser.appendChild(createFileElement(file)));
}

function renderTrash(files, folders) {
    const fileBrowser = document.getElementById('fileBrowser');
    fileBrowser.innerHTML = '';

    if ((folders?.length || 0) === 0 && (files?.length || 0) === 0) {
        fileBrowser.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-trash-alt"></i>
                <h3>Trash is empty</h3>
                <p>No files or folders in trash</p>
            </div>
        `;
        return;
    }

    folders.forEach(folder => fileBrowser.appendChild(createFolderElement(folder)));
    files.forEach(file => fileBrowser.appendChild(createFileElement(file)));
}

function renderRecentFiles(files) {
    const fileBrowser = document.getElementById('fileBrowser');
    fileBrowser.innerHTML = '';

    if (!files || files.length === 0) {
        fileBrowser.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <h3>No recent files</h3>
                <p>Files you access will appear here</p>
            </div>
        `;
        return;
    }

    // Only show files (no folders in recent)
    files.forEach(file => fileBrowser.appendChild(createFileElement(file)));
}

function createFolderElement(folder) {
    const element = document.createElement('div');
    element.className = 'folder-item';
    element.innerHTML = `
        <div class="folder-icon"><i class="fas fa-folder"></i></div>
        <div class="file-info">
            <div class="file-name">${folder.name}</div>
            <div class="file-meta">Folder</div>
        </div>
        <div class="file-actions">
            <button class="action-btn menu" aria-label="More options"><i class="fas fa-ellipsis-v"></i></button>
        </div>
    `;

    element.addEventListener('click', (e) => {
        if (!e.target.closest('.file-actions')) {
            loadFiles(folder._id, folder.name);
        }
    });

    const menuBtn = element.querySelector('.action-btn.menu');
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentFolderId = folder._id;
        currentFileId = null;
        currentFileName = null;
        openModal('fileActionsModal');
    });

    return element;
}

function createFileElement(file) {
    const element = document.createElement('div');
    element.className = 'file-item';
    element.innerHTML = `
        <div class="file-icon"><i class="fas fa-${getFileIcon(file.type)}"></i></div>
        <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-meta">${formatBytes(file.size)} • ${isViewingRecent ?
            `Last accessed: ${new Date(file.updatedAt).toLocaleDateString()}` :
            new Date(file.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="file-actions">
            <button class="action-btn download" aria-label="Download"><i class="fas fa-download"></i></button>
            <button class="action-btn menu" aria-label="More options"><i class="fas fa-ellipsis-v"></i></button>
        </div>
    `;

    element.addEventListener('click', (e) => {
        if (e.target.closest('.file-actions')) return;
        previewFile(file);
    });

    const downloadBtn = element.querySelector('.action-btn.download');
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadFile(file._id, file.name);
    });

    const menuBtn = element.querySelector('.action-btn.menu');
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentFileId = file._id;
        currentFileName = file.name;
        currentFolderId = null;
        openModal('fileActionsModal');
    });

    return element;
}

function updateBreadcrumbs() {
    const breadcrumbsContainer = document.querySelector('.breadcrumbs');
    let breadcrumbsHTML = '';

    if (isViewingRecent) {
        breadcrumbsHTML = '<span><i class="fas fa-clock"></i> Recent</span>';
    } else {
        breadcrumbsHTML = '<a href="#" onclick="navigateToFolder(null)"><i class="fas fa-home"></i> My Files</a>';
    }

    folderHierarchy.forEach((folder, index) => {
        const isLast = index === folderHierarchy.length - 1;
        if (isLast) {
            breadcrumbsHTML += ` <i class="fas fa-chevron-right"></i> <span>${folder.name}</span>`;
        } else {
            breadcrumbsHTML += ` <i class="fas fa-chevron-right"></i> <a href="#" onclick="navigateToFolder('${folder.id}', ${index})">${folder.name}</a>`;
        }
    });

    breadcrumbsContainer.innerHTML = breadcrumbsHTML;

    const backBtn = document.getElementById('backBtn');
    if (folderHierarchy.length > 0) {
        backBtn.style.display = 'inline-flex';
        backBtn.onclick = () => {
            folderHierarchy.pop();
            const last = folderHierarchy[folderHierarchy.length - 1];
            loadFiles(last ? last.id : null);
        };
    } else {
        backBtn.style.display = 'none';
    }
}

function navigateToFolder(folderId, hierarchyIndex = null) {
    if (folderId === null) {
        folderHierarchy = [];
        loadFiles(null);
    } else {
        if (hierarchyIndex !== null) {
            folderHierarchy = folderHierarchy.slice(0, hierarchyIndex + 1);
        }
        loadFiles(folderId);
    }
}

function handleUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.click();

    input.addEventListener('change', async () => {
        if (!input.files.length) return;

        const formData = new FormData();
        for (const file of input.files) formData.append('files', file);

        if (currentViewingFolderId) {
            formData.append('folderId', currentViewingFolderId);
        }

        try {
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');
            showToast('Files uploaded successfully', 'success');
            loadFiles(currentViewingFolderId);
            loadUserData();
        } catch (error) {
            console.error('Upload error:', error);
            showToast('Failed to upload files', 'error');
        }
    });
}

async function handleNewFolder(e) {
    e.preventDefault();

    const folderName = document.getElementById('folderName').value?.trim();
    if (!folderName) return;

    try {
        const body = { name: folderName };
        if (currentViewingFolderId) {
            body.parentId = currentViewingFolderId;
        }

        const response = await fetch('/api/folders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error('Failed to create folder');
        closeModal('newFolderModal');
        showToast('Folder created successfully', 'success');
        loadFiles(currentViewingFolderId);
        document.getElementById('folderName').value = '';
    } catch (error) {
        console.error('Error creating folder:', error);
        showToast('Failed to create folder', 'error');
    }
}

async function previewFile(file) {
    // Update the file's updatedAt timestamp when accessed
    try {
        await fetch(`/api/files/${file._id}/access`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
    } catch (error) {
        console.error('Failed to update file access time:', error);
    }

    if (file.url) {
        if (file.type.includes('image') || file.type.includes('pdf') || file.type.includes('text') || file.type.includes('application/json')) {
            window.open(file.url, '_blank');
        } else {
            downloadFile(file._id, file.name);
        }
    } else {
        downloadFile(file._id, file.name);
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
        showToast('Logged out successfully', 'success');
    }
}

async function downloadFile(fileId, fileName) {
    try {
        const response = await fetch(`/api/files/download/${fileId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Download started', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToast('Failed to download file', 'error');
    }
}

function showFileActions(fileId) {
    currentFileId = fileId;
    currentFolderId = null;
    openModal('fileActionsModal');
}

function showFolderActions(folderId) {
    currentFolderId = folderId;
    currentFileId = null;
    openModal('fileActionsModal');
}

function downloadSelected() {
    console.log('Download selected called', { currentFileId, currentFileName });
    if (currentFileId) {
        downloadFile(currentFileId, currentFileName || 'download');
    } else if (currentFolderId) {
        showToast('Download is not available for folders', 'info');
    }
    closeModal('fileActionsModal');
}

async function deletePermanently() {
    console.log('Delete permanently called', { currentFileId, currentFolderId });
    const id = currentFileId || currentFolderId;
    if (!id) return;

    const itemType = currentFileId ? 'file' : 'folder';
    if (!confirm(`Are you sure you want to delete this ${itemType} permanently?`)) return;

    const endpoint = currentFileId ? `/api/files/${id}` : `/api/folders/${id}`;

    try {
        const res = await fetch(endpoint, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error('Failed to delete permanently');
        showToast('Deleted permanently', 'success');
        closeModal('fileActionsModal');
        loadTrash(); // Refresh trash view
        loadUserData();
    } catch (err) {
        console.error(err);
        showToast('Error deleting permanently', 'error');
    }
}

async function moveToTrash() {
    console.log('Move to trash called', { currentFileId, currentFolderId });
    const id = currentFileId || currentFolderId;
    if (!id) return;

    const itemType = currentFileId ? 'file' : 'folder';
    if (!confirm(`Are you sure you want to move this ${itemType} to trash?`)) return;

    const endpoint = currentFileId ? `/api/files/${id}/trash` : `/api/folders/${id}/trash`;

    try {
        const res = await fetch(endpoint, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error('Failed to move to trash');
        showToast('Moved to trash successfully', 'success');
        closeModal('fileActionsModal');
        loadFiles(currentViewingFolderId);
        loadUserData();
    } catch (err) {
        console.error(err);
        showToast('Error moving to trash', 'error');
    }
}

async function restoreItem() {
    console.log('Restore item called', { currentFileId, currentFolderId });
    const id = currentFileId || currentFolderId;
    if (!id) return;

    const itemType = currentFileId ? 'file' : 'folder';
    if (!confirm(`Are you sure you want to restore this ${itemType}?`)) return;

    const endpoint = currentFileId ? `/api/files/${id}/restore` : `/api/folders/${id}/restore`;

    try {
        const res = await fetch(endpoint, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error('Failed to restore');
        showToast('Restored successfully', 'success');
        closeModal('fileActionsModal');
        loadTrash(); // Refresh trash view
    } catch (err) {
        console.error(err);
        showToast('Error restoring', 'error');
    }
}

async function renameFile() {
    console.log('Rename file called', { currentFileId, currentFolderId, currentFileName });
    const id = currentFileId || currentFolderId;
    if (!id) return;

    const currentName = currentFileName || 'item';
    const newName = prompt('Enter new name:', currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    const isFile = !!currentFileId;
    const endpoint = isFile ? `/api/files/${id}` : `/api/folders/${id}`;

    try {
        const res = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName.trim() })
        });

        console.log(res)
        if (!res.ok) throw new Error('Failed to rename');
        showToast('Renamed successfully', 'success');
        closeModal('fileActionsModal');
        loadFiles(currentViewingFolderId);
    } catch (err) {
        console.error(err);
        showToast('Rename failed', 'error');
    }
}

// Utility functions (make sure these exist)
function getFileIcon(type) {
    const iconMap = {
        'image': 'file-image',
        'audio': 'file-audio',
        'video': 'file-video',
        'application/pdf': 'file-pdf',
        'text': 'file-alt',
        'application/zip': 'file-archive',
        'application/json': 'file-code'
    };
    return iconMap[type] || 'file';
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function showToast(message, type = 'info') {
    // Implement your toast notification system
    console.log(`${type}: ${message}`);
    alert(`${type.toUpperCase()}: ${message}`);
}

// Expose functions globally
window.downloadFile = downloadFile;
window.showFileActions = showFileActions;
window.showFolderActions = showFolderActions;
window.handleLogout = handleLogout;
window.downloadSelected = downloadSelected;
window.deleteFile = deletePermanently;
window.renameFile = renameFile;
window.navigateToFolder = navigateToFolder;
window.loadTrash = loadTrash;
window.restoreItem = restoreItem;
window.moveToTrash = moveToTrash;
window.deletePermanently = deletePermanently;
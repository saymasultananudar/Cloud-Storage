let currentFile = null;
let currentFileType = null;

function showFileActions(file, type) {
    currentFile = file;
    currentFileType = type;
    
    const modal = document.getElementById('fileActionsModal');
    const title = document.getElementById('fileActionsTitle');
    
    title.textContent = `${type === 'folder' ? 'Folder' : 'File'} Actions: ${file.name}`;
    openModal('fileActionsModal');

    // Clean previous listeners by cloning the buttons
    resetActionButton('downloadBtn', handleDownload);
    resetActionButton('shareBtn', handleShare);
    resetActionButton('renameBtn', handleRename);
    resetActionButton('deleteBtn', handleDelete);
}

/**
 * Utility to reset button event listeners
 */
function resetActionButton(id, handler) {
    const oldBtn = document.getElementById(id);
    const newBtn = oldBtn.cloneNode(true); // clone to remove old listeners
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', handler);
}

function handleDownload() {
    if (currentFileType === 'folder') {
        showToast('Cannot download folders directly', 'error');
        return;
    }

    // Trigger backend download
    const link = document.createElement('a');
    link.href = `/api/files/download/${currentFile._id}`;
    link.setAttribute('download', currentFile.name);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    closeModal('fileActionsModal');
}

function handleShare() {
    // Placeholder for share
    showToast('Share functionality coming soon', 'info');
    closeModal('fileActionsModal');
}

function handleRename() {
    const newName = prompt(`Enter new name for ${currentFileType}:`, currentFile.name);
    if (!newName || newName.trim() === '') return;

    const endpoint = currentFileType === 'folder' ? '/api/folders' : '/api/files';

    fetch(`${endpoint}/${currentFile._id}/rename`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName })
    })
    .then(response => {
        if (!response.ok) throw new Error('Rename failed');
        return response.json();
    })
    .then(() => {
        showToast(`${currentFileType === 'folder' ? 'Folder' : 'File'} renamed`, 'success');
        closeModal('fileActionsModal');
        loadFiles();
    })
    .catch(error => {
        console.error('Rename error:', error);
        showToast('Failed to rename', 'error');
    });
}

function handleDelete() {
    const confirmDelete = confirm(`Are you sure you want to delete this ${currentFileType}?`);
    if (!confirmDelete) return;

    const endpoint = currentFileType === 'folder' ? '/api/folders' : '/api/files';

    fetch(`${endpoint}/${currentFile._id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Delete failed');
        return response.json();
    })
    .then(() => {
        showToast(`${currentFileType === 'folder' ? 'Folder' : 'File'} deleted`, 'success');
        closeModal('fileActionsModal');
        loadFiles();
        loadUserData(); // refresh storage info
    })
    .catch(error => {
        console.error('Delete error:', error);
        showToast('Failed to delete', 'error');
    });
}

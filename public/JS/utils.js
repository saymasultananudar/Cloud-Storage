function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'flex';
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modalId);
        }
    });
    
    // Close modal with escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal(modalId);
        }
    });
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFileIcon(type) {
    const icons = {
        'pdf': 'file-pdf',
        'image': 'file-image',
        'audio': 'file-audio',
        'video': 'file-video',
        'word': 'file-word',
        'excel': 'file-excel',
        'powerpoint': 'file-powerpoint',
        'archive': 'file-archive',
        'code': 'file-code',
        'text': 'file-alt'
    };
    
    if (type.includes('pdf')) return icons.pdf;
    if (type.includes('image')) return icons.image;
    if (type.includes('audio')) return icons.audio;
    if (type.includes('video')) return icons.video;
    if (type.includes('msword') || type.includes('wordprocessingml')) return icons.word;
    if (type.includes('spreadsheetml')) return icons.excel;
    if (type.includes('presentationml')) return icons.powerpoint;
    if (type.includes('zip') || type.includes('compressed')) return icons.archive;
    if (type.includes('javascript') || type.includes('json') || type.includes('html') || type.includes('css')) return icons.code;
    if (type.includes('text')) return icons.text;
    
    return 'file';
}
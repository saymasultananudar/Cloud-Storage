const express = require('express');
const {
    uploadFiles,
    getFiles,
    downloadFile,
    renameFile,
    deleteFile,
    moveToTrash,
    restoreFile,
    getRecentFiles,
    updateFileAccess
} = require('../controllers/fileController');
const { protect } = require('../middleware/auth');
const upload = require('../config/upload'); // Multer config

const router = express.Router();

// ✅ Get all files & folders
router.get('/', protect, getFiles);

// ✅ Get recent files (MUST come before /:id routes)
router.get('/recent', protect, getRecentFiles);

// ✅ Update file access time (MUST come before /:id routes)
router.patch('/:id/access', protect, updateFileAccess);

// ✅ Upload files (with multer middleware)
router.post('/upload', protect, upload.array('files'), uploadFiles);

// ✅ Download a file by ID
router.get('/download/:id', protect, downloadFile);

// ✅ Move file to trash
router.patch('/:id/trash', protect, moveToTrash);

// ✅ Restore file from trash
router.patch('/:id/restore', protect, restoreFile);

// ✅ Rename a file by ID
router.patch('/:id', protect, renameFile);

// ✅ Delete a file by ID
router.delete('/:id', protect, deleteFile);

module.exports = router;

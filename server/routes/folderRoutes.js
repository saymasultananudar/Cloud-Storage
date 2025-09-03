const express = require('express');
const { 
    createFolder, 
    getFolders, 
    renameFolder, 
    deleteFolder,
    moveToTrash,
    restoreFolder
} = require('../controllers/folderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
    .get(protect, getFolders)
    .post(protect, createFolder);

router.route('/:id/rename')
    .patch(protect, renameFolder);

router.route('/:id')
    .delete(protect, deleteFolder);

// ✅ Move folder to trash
router.patch('/:id/trash', protect, moveToTrash);

// ✅ Restore folder from trash
router.patch('/:id/restore', protect, restoreFolder);

module.exports = router;
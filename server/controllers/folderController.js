const Folder = require('../models/Folder');
const File = require('../models/File');
const User = require('../models/User');
const fs = require('fs');

// @desc    Create folder
// @route   POST /api/folders
// @access  Private
exports.createFolder = async (req, res, next) => {
    try {
        req.body.user = req.user.id;

        const folder = await Folder.create(req.body);

        res.status(201).json({
            success: true,
            data: folder
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all folders
// @route   GET /api/folders
// @access  Private
exports.getFolders = async (req, res, next) => {
    try {
        const folders = await Folder.find({
            user: req.user.id,
            isTrashed: { $ne: true } // Only get non-trashed folders
        });

        res.status(200).json({
            success: true,
            data: folders
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Rename folder
// @route   PATCH /api/folders/:id/rename
// @access  Private
exports.renameFolder = async (req, res, next) => {
    try {
        const folder = await Folder.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.user.id
            },
            { name: req.body.newName },
            { new: true, runValidators: true }
        );

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found'
            });
        }

        res.status(200).json({
            success: true,
            data: folder
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete folder
// @route   DELETE /api/folders/:id
// @access  Private
exports.deleteFolder = async (req, res, next) => {
    try {
        // Find folder and all subfolders
        const folder = await Folder.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found'
            });
        }

        // Recursively delete all files in this folder and subfolders
        await deleteFolderContents(req.params.id, req.user.id);

        // Delete the folder itself
        await Folder.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Move folder to trash
// @route   PATCH /api/folders/:id/trash
// @access  Private
exports.moveToTrash = async (req, res, next) => {
    try {
        const folder = await Folder.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { isTrashed: true, trashedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found'
            });
        }

        // Move all files in this folder to trash as well
        await File.updateMany(
            { folder: req.params.id, user: req.user.id },
            { isTrashed: true, trashedAt: new Date() }
        );

        // Move all subfolders to trash as well
        await moveSubfoldersToTrash(req.params.id, req.user.id);

        res.status(200).json({
            success: true,
            message: 'Folder moved to trash successfully',
            data: folder
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Restore folder from trash
// @route   PATCH /api/folders/:id/restore
// @access  Private
exports.restoreFolder = async (req, res, next) => {
    try {
        const folder = await Folder.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id, isTrashed: true },
            { isTrashed: false, trashedAt: null },
            { new: true, runValidators: true }
        );

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found in trash'
            });
        }

        // Restore all files in this folder from trash as well
        await File.updateMany(
            { folder: req.params.id, user: req.user.id },
            { isTrashed: false, trashedAt: null }
        );

        // Restore all subfolders from trash as well
        await restoreSubfoldersFromTrash(req.params.id, req.user.id);

        res.status(200).json({
            success: true,
            message: 'Folder restored successfully',
            data: folder
        });
    } catch (err) {
        next(err);
    }
};

// Helper function to recursively delete folder contents
async function deleteFolderContents(folderId, userId) {
    // Find all files in this folder
    const files = await File.find({ folder: folderId, user: userId });

    // Delete files from filesystem and database
    for (const file of files) {
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        await File.findByIdAndDelete(file._id);

        // Update user storage
        await User.findByIdAndUpdate(userId, {
            $inc: { storageUsed: -file.size }
        });
    }

    // Find all subfolders
    const subfolders = await Folder.find({ parentFolder: folderId, user: userId });

    // Recursively delete subfolders
    for (const subfolder of subfolders) {
        await deleteFolderContents(subfolder._id, userId);
        await Folder.findByIdAndDelete(subfolder._id);
    }
}

// Helper function to recursively move subfolders to trash
async function moveSubfoldersToTrash(folderId, userId) {
    const subfolders = await Folder.find({ parentFolder: folderId, user: userId });

    for (const subfolder of subfolders) {
        // Move files in subfolder to trash
        await File.updateMany(
            { folder: subfolder._id, user: userId },
            { isTrashed: true, trashedAt: new Date() }
        );

        // Move subfolder to trash
        await Folder.findByIdAndUpdate(subfolder._id, {
            isTrashed: true,
            trashedAt: new Date()
        });

        // Recursively move sub-subfolders
        await moveSubfoldersToTrash(subfolder._id, userId);
    }
}

// Helper function to recursively restore subfolders from trash
async function restoreSubfoldersFromTrash(folderId, userId) {
    const subfolders = await Folder.find({ parentFolder: folderId, user: userId });

    for (const subfolder of subfolders) {
        // Restore files in subfolder from trash
        await File.updateMany(
            { folder: subfolder._id, user: userId },
            { isTrashed: false, trashedAt: null }
        );

        // Restore subfolder from trash
        await Folder.findByIdAndUpdate(subfolder._id, {
            isTrashed: false,
            trashedAt: null
        });

        // Recursively restore sub-subfolders
        await restoreSubfoldersFromTrash(subfolder._id, userId);
    }
}
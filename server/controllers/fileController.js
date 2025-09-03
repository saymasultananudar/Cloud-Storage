const File = require('../models/File');
const Folder = require('../models/Folder');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// @desc    Upload files
// @route   POST /api/files/upload
// @access  Private
exports.uploadFiles = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please upload files'
            });
        }

        const files = req.files.map(file => ({
            name: file.originalname,
            path: file.path,
            size: file.size,
            type: file.mimetype,
            user: req.user.id,
            folder: req.body.folderId || null
        }));

        // Check storage space
        const user = await User.findById(req.user.id);
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);

        if (user.storageUsed + totalSize > user.storageLimit) {
            // Delete uploaded files if storage limit exceeded
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });

            return res.status(400).json({
                success: false,
                message: 'Storage limit exceeded'
            });
        }

        // Save files in DB
        const savedFiles = await File.insertMany(files);

        // Update user storage
        user.storageUsed += totalSize;
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Files uploaded successfully',
            data: savedFiles
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all files & folders inside a folder
// @route   GET /api/files
// @access  Private
exports.getFiles = async (req, res, next) => {
    try {
        const folderId = req.query.folderId || null;

        const files = await File.find({
            user: req.user.id,
            folder: folderId,
            isTrashed: { $ne: true } // Only get non-trashed files
        }).sort('-createdAt');

        const folders = await Folder.find({
            user: req.user.id,
            parentFolder: folderId,
            isTrashed: { $ne: true } // Only get non-trashed folders
        }).sort('-createdAt');

        res.status(200).json({
            success: true,
            message: 'Files and folders fetched successfully',
            files,
            folders
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Download file
// @route   GET /api/files/download/:id
// @access  Private
exports.downloadFile = async (req, res, next) => {
    try {
        const file = await File.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        if (!fs.existsSync(file.path)) {
            return res.status(404).json({
                success: false,
                message: 'File not found on server'
            });
        }

        // Update the updatedAt timestamp when file is accessed
        await File.findByIdAndUpdate(file._id, { updatedAt: new Date() });

        res.download(file.path, file.name);
    } catch (err) {
        next(err);
    }
};

// @desc    Rename file
// @route   PATCH /api/files/:id
// @access  Private
exports.renameFile = async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: 'New name is required'
            });
        }

        console.log(req.body)

        const file = await File.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { name: name.trim() },
            { new: true, runValidators: true }
        );

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'File renamed successfully',
            data: file
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete file
// @route   DELETE /api/files/:id
// @access  Private
exports.deleteFile = async (req, res, next) => {
    try {
        const file = await File.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // Delete file from filesystem
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        // Update user storage
        await User.findByIdAndUpdate(req.user.id, {
            $inc: { storageUsed: -file.size }
        });

        res.status(200).json({
            success: true,
            message: 'File deleted successfully',
            data: {}
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Move file to trash
// @route   PATCH /api/files/:id/trash
// @access  Private
exports.moveToTrash = async (req, res, next) => {
    try {
        const file = await File.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { isTrashed: true, trashedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'File moved to trash successfully',
            data: file
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Restore file from trash
// @route   PATCH /api/files/:id/restore
// @access  Private
exports.restoreFile = async (req, res, next) => {
    try {
        const file = await File.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id, isTrashed: true },
            { isTrashed: false, trashedAt: null },
            { new: true, runValidators: true }
        );

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found in trash'
            });
        }

        res.status(200).json({
            success: true,
            message: 'File restored successfully',
            data: file
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all trash items (files and folders)
// @route   GET /api/trash
// @access  Private
exports.getTrash = async (req, res, next) => {
    try {
        console.log('Getting trash for user:', req.user.id);

        // First, let's test if we can connect to the database
        const fileCount = await File.countDocuments({ user: req.user.id });
        const folderCount = await Folder.countDocuments({ user: req.user.id });
        console.log('Total files for user:', fileCount);
        console.log('Total folders for user:', folderCount);

        const files = await File.find({
            user: req.user.id,
            isTrashed: true
        }).sort('-createdAt');

        const folders = await Folder.find({
            user: req.user.id,
            isTrashed: true
        }).sort('-createdAt');

        console.log('Found trashed files:', files.length);
        console.log('Found trashed folders:', folders.length);

        res.status(200).json({
            success: true,
            message: 'Trash items fetched successfully',
            files,
            folders
        });
    } catch (err) {
        console.error('Error in getTrash:', err);
        next(err);
    }
};

// @desc    Update file access time
// @route   PATCH /api/files/:id/access
// @access  Private
exports.updateFileAccess = async (req, res, next) => {
    try {
        const file = await File.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'File access time updated',
            data: file
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get recent files (files accessed recently)
// @route   GET /api/files/recent
// @access  Private
exports.getRecentFiles = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 20; // Default to 20 recent files

        const recentFiles = await File.find({
            user: req.user.id,
            isTrashed: { $ne: true } // Only non-trashed files
        })
            .sort('-updatedAt') // Sort by most recently updated
            .limit(limit)
            .populate('folder', 'name'); // Include folder name if file is in a folder

        res.status(200).json({
            success: true,
            message: 'Recent files fetched successfully',
            data: recentFiles
        });
    } catch (err) {
        next(err);
    }
};

const mongoose = require('mongoose');
const path = require('path');

const FileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a file name']
    },
    path: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    folder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder'
    },
    isTrashed: {
        type: Boolean,
        default: false
    },
    trashedAt: {
        type: Date
    },
    originalFolder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: false // We'll handle timestamps manually for updatedAt
});

// Virtual for file URL - THIS IS CRITICAL
FileSchema.virtual('url').get(function () {
    // Extract just the filename from the full path
    const filename = path.basename(this.path);
    return `/uploads/${filename}`;
});

// Pre-save middleware to update updatedAt
FileSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Pre-update middleware to update updatedAt on findOneAndUpdate, updateOne, etc.
FileSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function (next) {
    this.set({ updatedAt: new Date() });
    next();
});

module.exports = mongoose.model('File', FileSchema);
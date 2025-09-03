const express = require('express');
const { pathToRegexp } = require('path-to-regexp');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

// ✅ Fix Express compatibility with path-to-regexp v6+
express.pathToRegexp = pathToRegexp;

const app = express();

// ---------------------
// Security Middleware
// ---------------------
// Temporarily disabled for development
// app.use(helmet({
//     contentSecurityPolicy: {
//         directives: {
//             defaultSrc: ["'self'"],
//             styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
//             scriptSrc: ["'self'", "'unsafe-inline'"],
//             fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
//             imgSrc: ["'self'", "data:", "blob:"],
//             connectSrc: ["'self'"]
//         }
//     }
// }));
app.disable('x-powered-by');     // Hide "X-Powered-By: Express"

// ---------------------
// Body Parsers
// ---------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // keep extended: true for nested objects

// ---------------------
// Static Files
// ---------------------
app.use('/uploads', express.static(path.join(__dirname, '../uploads'))); // File uploads
app.use(express.static(path.join(__dirname, '../public'))); // Public frontend files

// ---------------------
// Routes
// ---------------------
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const folderRoutes = require('./routes/folderRoutes');
const { notFound, errorHandler } = require('./middleware/error');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);

// Trash route (must come before the catch-all route)
app.get('/api/trash', require('./middleware/auth').protect, require('./controllers/fileController').getTrash);

// ---------------------
// Frontend Fallback (SPA)
// ---------------------
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// ---------------------
// Error Handling
// ---------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;

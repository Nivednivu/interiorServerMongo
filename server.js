import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import productRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import fs from "fs";
import { connectToDatabase, getConnectionStatus } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Created uploads directory:", uploadsDir);
}

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://interior-design-frontend.onrender.com',
      'https://*.onrender.com'
    ];
    
    // Allow any subdomain of onrender.com in production
    if (process.env.NODE_ENV === 'production') {
      if (origin.endsWith('.onrender.com')) {
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
    return callback(new Error(msg), false);
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from uploads directory with cache control
app.use("/uploads", express.static(uploadsDir, {
  maxAge: '1d', // Cache for 1 day
  setHeaders: (res, path) => {
    // Set proper content type based on file extension
    const ext = path.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'webm': 'video/webm',
      'webp': 'image/webp'
    };
    
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
    
    // Enable CORS for static files
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
  next();
});

// Routes
app.use("/api", productRoutes);
app.use("/api", uploadRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  const dbStatus = getConnectionStatus() ? "Connected" : "Disconnected";
  
  res.status(200).json({ 
    status: "OK", 
    message: "Server is running successfully",
    database: `MongoDB Atlas - ${dbStatus}`,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uploadsPath: `/uploads`,
    serverTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  });
});

// Server info route
app.get("/api/server-info", (req, res) => {
  const serverUrl = `${req.protocol}://${req.get('host')}`;
  
  res.status(200).json({ 
    serverUrl: serverUrl,
    uploadsUrl: `${serverUrl}/uploads`,
    apiBaseUrl: `${serverUrl}/api`,
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// Uploads directory info
app.get("/api/uploads-check", (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    
    const fileDetails = files.map(file => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      const fileUrl = `${serverUrl}/uploads/${file}`;
      
      return {
        name: file,
        url: fileUrl,
        size: stats.size,
        sizeMB: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
        created: stats.birthtime,
        type: path.extname(file).toLowerCase()
      };
    });
    
    res.status(200).json({ 
      success: true,
      uploadsDir: uploadsDir,
      serverUrl: serverUrl,
      fileCount: files.length,
      totalSizeMB: fileDetails.reduce((sum, file) => sum + (file.size / (1024 * 1024)), 0).toFixed(2),
      files: fileDetails
    });
  } catch (error) {
    console.error("❌ Uploads check error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to read uploads directory",
      message: error.message 
    });
  }
});

// Test route for file serving
app.get("/api/test-file/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: "File not found",
      path: filePath
    });
  }
  
  const stats = fs.statSync(filePath);
  const serverUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    success: true,
    filename: filename,
    filePath: filePath,
    fileUrl: `${serverUrl}/uploads/${filename}`,
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime
  });
});

// Clear uploads directory (use with caution)
app.delete("/api/clear-uploads", (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    let deletedCount = 0;
    
    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      fs.unlinkSync(filePath);
      deletedCount++;
    });
    
    res.json({
      success: true,
      message: `Cleared ${deletedCount} files from uploads directory`,
      directory: uploadsDir
    });
  } catch (error) {
    console.error("❌ Clear uploads error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error("🚨 Global Error Handler:", error.message);
  console.error("🚨 Stack:", error.stack);
  
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    timestamp: new Date().toISOString()
  }); 
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method
  });
});

// Database connection and server startup
const startServer = async () => {
  try {
    console.log("🚀 Starting Interior Design Server...");
    console.log("📍 Port:", process.env.PORT || 5000);
    console.log("🌐 Environment:", process.env.NODE_ENV || 'development');
    console.log("📁 Uploads Directory:", uploadsDir);
    
    // Connect to database
    await connectToDatabase();
    
    const PORT = process.env.PORT || 5000;
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log("\n🎉 Server Started Successfully!");
      console.log("══════════════════════════════════════════════════════");
      console.log(`📍 Local:        http://localhost:${PORT}`);
      console.log(`🔍 Health:       http://localhost:${PORT}/api/health`);
      console.log(`🛒 Products:     http://localhost:${PORT}/api/products`);
      console.log(`📤 Upload:       http://localhost:${PORT}/api/upload`);
      console.log(`📁 Uploads Info: http://localhost:${PORT}/api/uploads-check`);
      console.log(`🌐 Server Info:  http://localhost:${PORT}/api/server-info`);
      console.log("══════════════════════════════════════════════════════\n");
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use!`);
        console.log('💡 Try these solutions:');
        console.log('   1. killall node (on Mac/Linux)');
        console.log('   2. netstat -ano | findstr :${PORT} (on Windows)');
        console.log('   3. Change PORT in .env file');
        console.log('   4. Restart your computer');
      } else {
        console.error('❌ Server error:', error.message);
      }
      process.exit(1);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('💤 Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('👋 SIGINT received. Shutting down...');
      server.close(() => {
        console.log('💤 Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('💥 Failed to start server:', error.message);
    console.error('💥 Stack:', error.stack);
    process.exit(1);
  }
};

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  
  if (fs.existsSync(clientBuildPath)) {
    console.log("🏗️  Serving React app from:", clientBuildPath);
    
    // Serve static files from React build
    app.use(express.static(clientBuildPath, {
      maxAge: '1d',
      setHeaders: (res, path) => {
        // Cache static assets for longer
        if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        }
      }
    }));
    
    // ✅ FIXED: Catch-all route for React app - MUST BE LAST ROUTE
    app.get('*', (req, res, next) => {
      // Don't interfere with API routes
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
    
    console.log("✅ React app serving enabled");
  } else {
    console.log("⚠️  React build not found at:", clientBuildPath);
    console.log("⚠️  Running in API-only mode");
  }
}

// Start the server
startServer();
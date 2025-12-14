import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import productRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { connectToDatabase, getConnectionStatus } from "./db.js";
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
  next();
});

// Routes
app.use("/api", productRoutes);
app.use("/api", uploadRoutes);

// Health check route with Cloudinary status
app.get("/api/health", (req, res) => {
  const dbStatus = getConnectionStatus() ? "Connected" : "Disconnected";
  const cloudinaryStatus = process.env.CLOUDINARY_CLOUD_NAME ? "Configured" : "Not Configured";
  
  res.status(200).json({ 
    status: "OK", 
    message: "Server is running successfully",
    database: `MongoDB Atlas - ${dbStatus}`,
    cloudinary: `Cloudinary - ${cloudinaryStatus}`,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error("🚨 Global Error Handler:", error.message);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  }); 
});

// Database connection and server startup
const startServer = async () => {
  try {
    console.log("🚀 Starting Interior Design Server...");
    console.log("📍 Port:", process.env.PORT || 5000);
    console.log("🌐 Environment:", process.env.NODE_ENV);
    console.log("☁️  Cloudinary:", process.env.CLOUDINARY_CLOUD_NAME ? "Configured ✓" : "Not Configured ✗");
    
    await connectToDatabase();
    
    const PORT = process.env.PORT || 5000;
    
    const server = app.listen(PORT, () => {
      console.log("\n🎉 Server Started Successfully!");
      console.log("══════════════════════════════════════");
      console.log(`📍 Local:    http://localhost:${PORT}`);
      console.log(`🔍 Health:   http://localhost:${PORT}/api/health`);
      console.log(`🛒 Products: http://localhost:${PORT}/api/products`);
      console.log(`📤 Upload:   http://localhost:${PORT}/api/upload`);
      console.log("══════════════════════════════════════\n");
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use!`);
        console.log('💡 Try: killall node OR change PORT in .env file');
      } else {
        console.error('❌ Server error:', error.message);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('💥 Failed to start server:', error.message);
    process.exit(1);
  }
};

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
    
    console.log("✅ React app serving enabled");
  }
}

// Start the server
startServer();
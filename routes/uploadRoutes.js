import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Created uploads directory:", uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, "file-" + uniqueSuffix + fileExtension);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  }
});

// Upload endpoint - RETURN RELATIVE PATH ONLY
router.post("/upload", upload.single("file"), (req, res) => {
  try {
    console.log("📁 Upload request received");
    
    if (!req.file) {
      console.log("❌ No file in request");
      return res.status(400).json({ 
        success: false, 
        error: "No file uploaded or file type not supported" 
      });
    }

    console.log("✅ File uploaded:", req.file.filename);
    console.log("📁 File saved at:", req.file.path);

    // RETURN ONLY RELATIVE PATH - This is the key change
    const fileName = req.file.filename;
    const relativePath = `/uploads/${fileName}`;
    
    console.log("📁 Stored relative path:", relativePath);

    res.json({
      success: true,
      message: "File uploaded successfully",
      fileName: fileName,
      filePath: relativePath // Just the relative path
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Multer error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File too large. Maximum size is 50MB"
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        error: "Unexpected file field"
      });
    } 
  }
  
  console.error("❌ Upload middleware error:", error);
  res.status(500).json({ 
    success: false, 
    error: error.message 
  });
});

export default router;
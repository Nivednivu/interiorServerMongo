import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "cloudinary";
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Validate Cloudinary configuration
if (!process.env.CLOUDINARY_CLOUD_NAME || 
    !process.env.CLOUDINARY_API_KEY || 
    !process.env.CLOUDINARY_API_SECRET) {
  console.error("❌ Cloudinary environment variables are missing!");
  throw new Error("Cloudinary configuration is incomplete");
}

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Helper function to sanitize filenames
const sanitizeFilename = (filename) => {
  if (!filename) return 'uploaded-file';
  
  // Remove zero-width spaces and special characters
  let cleanName = filename
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    .replace(/[^\w\s.-]/gi, '') // Remove special characters except dots and hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .trim();
  
  // Ensure it has an extension
  const hasExtension = cleanName.includes('.');
  const nameWithoutExt = hasExtension ? cleanName.substring(0, cleanName.lastIndexOf('.')) : cleanName;
  const ext = hasExtension ? filename.split('.').pop().substring(0, 10) : '';
  
  // Limit total length to 100 characters
  const finalName = nameWithoutExt.substring(0, 90 - ext.length);
  return ext ? `${finalName}.${ext}` : finalName;
};

// Configure Cloudinary storage for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: 'interior-design-products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi', 'webm', 'mkv'],
    resource_type: 'auto', // Automatically detect image or video
    transformation: [
      { width: 1000, height: 1000, crop: 'limit', quality: 'auto' }
    ],
    unique_filename: true,
    overwrite: false
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = sanitizeFilename(file.originalname);
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 9);
    const nameWithoutExt = sanitizedFilename.substring(0, sanitizedFilename.lastIndexOf('.'));
    const extension = sanitizedFilename.substring(sanitizedFilename.lastIndexOf('.') + 1);
    const finalFilename = `${nameWithoutExt}-${timestamp}-${randomString}.${extension}`;
    cb(null, finalFilename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/x-matroska'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      // Log the file being uploaded
      console.log(`📤 File accepted: ${file.originalname} (${file.mimetype})`);
      cb(null, true);
    } else {
      console.log(`❌ File rejected: ${file.originalname} (${file.mimetype})`);
      cb(new Error("Only images (JPEG, PNG, GIF) and videos (MP4, MOV, AVI, WEBM) are allowed"));
    }
  }
});

// Test Cloudinary connection before upload route
router.get("/upload/test-cloudinary", async (req, res) => {
  try {
    console.log("🔍 Testing Cloudinary connection...");
    
    // Test with a simple API call
    const result = await cloudinary.v2.api.ping();
    
    // Also test uploader with a small operation
    const uploadTest = await cloudinary.v2.uploader.upload('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmZmYiLz48L3N2Zz4=', {
      public_id: 'test-connection',
      folder: 'interior-design-products',
      overwrite: true
    });
    
    console.log("✅ Cloudinary connection successful:", {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      testUpload: uploadTest.secure_url
    });
    
    res.json({
      success: true,
      message: "Cloudinary connection and upload test successful",
      cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        status: "Connected",
        test_upload_url: uploadTest.secure_url,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("❌ Cloudinary test failed:", error.message);
    console.error("Full error:", error);
    
    res.status(500).json({
      success: false,
      error: "Cloudinary connection failed",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Single file upload endpoint - Uploads to Cloudinary
// Update your upload route - Replace the entire POST /upload handler:
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("📁 Cloudinary upload request received");
    
    if (!req.file) {
      console.log("❌ No file in request");
      return res.status(400).json({ 
        success: false, 
        error: "No file uploaded or file type not supported" 
      });
    }

    console.log("✅ File uploaded to Cloudinary:", req.file);
    
    // Extract Cloudinary URL from path property
    const cloudinaryUrl = req.file.path;
    
    if (!cloudinaryUrl) {
      console.error("❌ No Cloudinary URL found in file object");
      return res.status(500).json({
        success: false,
        error: "Cloudinary upload failed - no URL returned",
        fileInfo: req.file
      });
    }
    
    // Extract public_id from the URL
    // URL format: https://res.cloudinary.com/dc2sd6qcd/image/upload/v1765727739/interior-design-products/lab0bq64vfedaefwegg7.png
    const urlParts = cloudinaryUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    let publicId = '';
    
    if (uploadIndex !== -1 && uploadIndex + 1 < urlParts.length) {
      // Get everything after 'upload/'
      const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
      // Remove version prefix (v1234567890/) if present
      publicId = pathAfterUpload.replace(/^v\d+\//, '');
      // Remove file extension
      publicId = publicId.replace(/\.[^/.]+$/, "");
    }
    
    // Determine resource type from mimetype
    const isVideo = req.file.mimetype.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';
    
    console.log("🌐 Extracted Cloudinary URL:", cloudinaryUrl);
    console.log("🔑 Extracted Public ID:", publicId);
    console.log("📁 File type:", resourceType);

    res.json({
      success: true,
      message: `File uploaded to Cloudinary successfully as ${resourceType}`,
      fileName: req.file.originalname,
      filePath: cloudinaryUrl, // Use the path property
      publicId: publicId,
      type: resourceType,
      bytes: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error.message);
    console.error("Stack trace:", error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Upload failed",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Alternative upload endpoint using direct Cloudinary API (fallback)
router.post("/upload-direct", async (req, res) => {
  try {
    // This is a fallback method using direct Cloudinary upload
    console.log("🔄 Using direct Cloudinary upload method");
    
    // You would need to handle multipart form data differently here
    // For now, this is just a placeholder to show the alternative
    
    res.status(501).json({
      success: false,
      error: "Direct upload endpoint not implemented",
      message: "Use the /upload endpoint with multer middleware"
    });
  } catch (error) {
    console.error("Direct upload error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete file from Cloudinary
router.delete("/upload/:publicId", async (req, res) => {
  try {
    const { publicId } = req.params;
    const resourceType = req.query.type || 'image';
    
    console.log(`🗑️ Deleting file from Cloudinary: ${publicId}, type: ${resourceType}`);
    
    const result = await cloudinary.v2.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });
    
    console.log("Cloudinary delete result:", result);
    
    if (result.result === 'ok' || result.result === 'not found') {
      res.json({
        success: true,
        message: result.result === 'not found' ? 
          "File not found in Cloudinary (may have been deleted already)" : 
          "File deleted from Cloudinary successfully"
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.result || "Failed to delete file",
        details: result
      });
    }
  } catch (error) {
    console.error("❌ Cloudinary delete error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// List files in Cloudinary folder
router.get("/upload/list", async (req, res) => {
  try {
    const result = await cloudinary.v2.api.resources({
      type: 'upload',
      prefix: 'interior-design-products/',
      max_results: 50
    });
    
    res.json({
      success: true,
      message: `Found ${result.resources.length} files in Cloudinary`,
      files: result.resources.map(resource => ({
        public_id: resource.public_id,
        secure_url: resource.secure_url,
        resource_type: resource.resource_type,
        format: resource.format,
        bytes: resource.bytes,
        created_at: resource.created_at
      })),
      count: result.resources.length
    });
  } catch (error) {
    console.error("❌ Error listing Cloudinary files:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Multer error handling middleware
router.use((error, req, res, next) => {
  console.log("=== UPLOAD ERROR HANDLER ===");
  console.log("Error name:", error.name);
  console.log("Error message:", error.message);
  console.log("Error code:", error.code);
  
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
    return res.status(400).json({
      success: false,
      error: `Upload error: ${error.message}`
    });
  }
  
  console.error("❌ Upload middleware error:", error.message);
  console.error("Stack:", error.stack);
  
  res.status(500).json({ 
    success: false, 
    error: error.message || "Upload failed",
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Upload service is running",
    cloudinary_configured: !!process.env.CLOUDINARY_CLOUD_NAME,
    timestamp: new Date().toISOString()
  });
});

export default router;
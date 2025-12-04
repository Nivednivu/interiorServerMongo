import express from "express";
import mongoose from 'mongoose'; // ✅ ADD THIS IMPORT
import Product from "../models/Product.js";

const router = express.Router();

// GET ALL PRODUCTS
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find({})
      .sort({ created_at: -1 })
      .lean();
    
    res.json({ 
      success: true, 
      count: products.length, 
      data: products 
    });
  } catch (err) {
    console.error("❌ Get Products Error:", err.message);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch products: " + err.message 
    });
  }
});

// GET SINGLE PRODUCT BY ID
router.get("/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid product ID format" 
      });
    }

    const product = await Product.findById(productId).lean();
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: "Product not found" 
      });
    }
    
    res.json({ 
      success: true, 
      data: product 
    });
  } catch (err) {
    console.error("❌ Get Product Error:", err.message);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch product: " + err.message 
    });
  }
});

// CREATE NEW PRODUCT
router.post("/products", async (req, res) => {
  console.log("📨 Received POST /products request");
  console.log("📦 Request body:", req.body);
  
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: "Request body is missing." 
    });
  }

  const { 
    product_name, 
    price_new, 
    brand, 
    category, 
    description = '', 
    image_url = '', 
    video_url = '' 
  } = req.body;
  
  // Validate required fields
  if (!product_name || !price_new || !brand || !category) {
    return res.status(400).json({ 
      success: false, 
      error: "Missing required fields: product_name, price_new, brand, category" 
    });
  }

  try {
    const productData = {
      product_name,
      price_new: parseFloat(price_new),
      brand,
      category,
      description,
      image_url,
      video_url
    };

    const product = new Product(productData);
    const savedProduct = await product.save();
    
    console.log("✅ Product created successfully, ID:", savedProduct._id);
    res.status(201).json({ 
      success: true, 
      message: "Product created successfully",
      productId: savedProduct._id,
      data: savedProduct
    });
  } catch (err) {
    console.error("❌ Create Product Error:", err.message);
    
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        success: false, 
        error: "Validation failed: " + errors.join(', ') 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: "Failed to create product: " + err.message 
    });
  }
});

// UPDATE PRODUCT
router.put("/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid product ID format" 
      });
    }

    // Check if product exists
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ 
        success: false, 
        error: "Product not found" 
      });
    }

    const { 
      product_name, 
      price_new, 
      brand, 
      category, 
      description = '', 
      image_url = '', 
      video_url = '' 
    } = req.body;

    const updateData = {
      product_name,
      price_new: parseFloat(price_new),
      brand,
      category,
      description,
      image_url,
      video_url
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({ 
      success: true, 
      message: "Product updated successfully",
      data: updatedProduct
    });
  } catch (err) {
    console.error("❌ Update Product Error:", err.message);
    
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        success: false, 
        error: "Validation failed: " + errors.join(', ') 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: "Failed to update product: " + err.message 
    });
  }
});

// DELETE PRODUCT
router.delete("/products/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid product ID format" 
      });
    }

    // Check if product exists
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ 
        success: false, 
        error: "Product not found" 
      });
    }
//   hjkk
    await Product.findByIdAndDelete(productId);

    res.json({ 
      success: true, 
      message: "Product deleted successfully"
    });
  } catch (err) {
    console.error("❌ Delete Product Error:", err.message);
    res.status(500).json({ 
      success: false, 
      error: "Failed to delete product: " + err.message 
    });
  }
});

export default router;
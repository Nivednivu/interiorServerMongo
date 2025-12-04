import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

let isConnected = false;

export const connectToDatabase = async () => {
  if (isConnected) {
    console.log('🔄 Using existing database connection');
    return;
  }

  try {
    console.log('🔗 Connecting to MongoDB Atlas with Mongoose...');
    
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // ✅ FIXED: Remove deprecated options
    await mongoose.connect(MONGODB_URI);
    
    isConnected = mongoose.connection.readyState === 1;
    
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connected to MongoDB Atlas');
      console.log('📊 Database:', mongoose.connection.db.databaseName);
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 Mongoose disconnected');
      isConnected = false;
    });

  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    console.error('💡 Please check your:');
    console.error('   - Connection string in .env file');
    console.error('   - MongoDB Atlas cluster status');
    console.error('   - Network connection and IP whitelist');
    throw error;
  }
};

export const getConnectionStatus = () => {
  return isConnected;
};

export default { connectToDatabase, getConnectionStatus };
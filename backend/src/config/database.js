const mongoose = require('mongoose');
const { assertAtlasConnection } = require('./atlas-assert');

// Only import memory database in development
let memoryDatabase = null;
if (process.env.NODE_ENV === 'development') {
  memoryDatabase = require('./database-memory');
}

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    try {
      // Use memory database for development ONLY if DB_KIND is not 'atlas'
      if (process.env.NODE_ENV === 'development' && process.env.DB_KIND !== 'atlas' && memoryDatabase) {
        await memoryDatabase.connect();
        this.isConnected = true;
        return;
      }

      // Validaciones estrictas para producción
      if (process.env.NODE_ENV === 'production') {
        if (process.env.DB_KIND !== 'atlas') {
          throw new Error('Production environment requires DB_KIND=atlas');
        }
        
        if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
          throw new Error('Production environment requires a valid MongoDB Atlas URI (mongodb+srv://)');
        }
        
        if (process.env.MONGODB_URI.includes('<PASSWORD>') || process.env.MONGODB_URI.includes('<CLUSTER>')) {
          throw new Error('Production environment requires real MongoDB credentials (no placeholders)');
        }
      }

      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false
      };

      await mongoose.connect(process.env.MONGODB_URI, options);
      this.isConnected = true;
      
      console.log('🚀 MongoDB connected successfully');
      
      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error.message);
      process.exit(1);
    }
  }

  async disconnect() {
    try {
      if (process.env.NODE_ENV === 'development' && memoryDatabase) {
        await memoryDatabase.disconnect();
        this.isConnected = false;
        return;
      }

      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log('🛑 MongoDB disconnected');
      }
      this.isConnected = false;
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }
}

module.exports = new DatabaseConnection();
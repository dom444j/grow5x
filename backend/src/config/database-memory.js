const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

class MemoryDatabaseConnection {
  constructor() {
    this.mongod = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Start MongoDB Memory Server
      this.mongod = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbName: 'grow5x_dev'
        }
      });

      const uri = this.mongod.getUri();
      console.log('🚀 MongoDB Memory Server started at:', uri);

      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false
      };

      await mongoose.connect(uri, options);
      this.isConnected = true;
      
      console.log('🚀 MongoDB Memory Server connected successfully');
      
      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected');
        this.isConnected = false;
      });

    } catch (error) {
      console.error('❌ Failed to start MongoDB Memory Server:', error.message);
      process.exit(1);
    }
  }

  async disconnect() {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      
      if (this.mongod) {
        await this.mongod.stop();
        console.log('🛑 MongoDB Memory Server stopped');
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
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }
}

module.exports = new MemoryDatabaseConnection();
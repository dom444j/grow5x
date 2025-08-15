/**
 * Wallets Seed Script
 * Creates the initial pool of payment wallets for BEP-20 USDT
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const database = require('../src/config/database');
const { Wallet } = require('../src/models');

// Wallet configurations
const WALLET_CONFIG = {
  network: 'BSC',
  networkName: 'Binance Smart Chain',
  tokenContract: '0x55d398326f99059fF775485246999027B3197955', // USDT BEP-20
  tokenSymbol: 'USDT',
  tokenDecimals: 18,
  isActive: true
};

// Sample wallet addresses (in production, these should be real wallet addresses)
const SAMPLE_WALLETS = [
  {
    address: '0x1234567890123456789012345678901234567890',
    label: 'Payment Wallet 1',
    description: 'Primary payment wallet for USDT BEP-20 transactions'
  },
  {
    address: '0x2345678901234567890123456789012345678901',
    label: 'Payment Wallet 2',
    description: 'Secondary payment wallet for USDT BEP-20 transactions'
  },
  {
    address: '0x3456789012345678901234567890123456789012',
    label: 'Payment Wallet 3',
    description: 'Tertiary payment wallet for USDT BEP-20 transactions'
  },
  {
    address: '0x4567890123456789012345678901234567890123',
    label: 'Payment Wallet 4',
    description: 'Backup payment wallet for USDT BEP-20 transactions'
  },
  {
    address: '0x5678901234567890123456789012345678901234',
    label: 'Payment Wallet 5',
    description: 'Reserve payment wallet for USDT BEP-20 transactions'
  }
];

// Function to generate a mock private key (for demonstration only)
function generateMockPrivateKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Function to encrypt private key (basic encryption for demo)
function encryptPrivateKey(privateKey, password = 'grow5x-secret-key') {
  const cipher = crypto.createCipher('aes-256-cbc', password);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

async function createWallet(walletData) {
  try {
    console.log(`💳 Checking if wallet '${walletData.address}' already exists...`);
    
    // Check if wallet already exists
    const existingWallet = await Wallet.findOne({
      address: walletData.address.toLowerCase()
    });
    
    if (existingWallet) {
      console.log(`⚠️ Wallet '${walletData.address}' already exists`);
      
      // Update existing wallet with new configuration
      Object.assign(existingWallet, {
        ...WALLET_CONFIG,
        label: walletData.label,
        description: walletData.description,
        updatedAt: new Date()
      });
      await existingWallet.save();
      
      console.log(`✅ Wallet '${walletData.address}' updated successfully`);
      return existingWallet;
    }
    
    console.log(`💳 Creating wallet '${walletData.address}'...`);
    
    // Generate mock private key and encrypt it
    const privateKey = generateMockPrivateKey();
    const encryptedPrivateKey = encryptPrivateKey(privateKey);
    
    // Create new wallet
    const newWallet = new Wallet({
      ...WALLET_CONFIG,
      address: walletData.address,
      label: walletData.label,
      description: walletData.description,
      encryptedPrivateKey: encryptedPrivateKey,
      createdBy: 'seed-script',
      lastHealthCheck: new Date(),
      healthStatus: 'healthy'
    });
    
    await newWallet.save();
    
    console.log(`✅ Wallet '${walletData.address}' created successfully:`);
    console.log(`   Wallet ID: ${newWallet.walletId}`);
    console.log(`   Network: ${newWallet.network}`);
    console.log(`   Token: ${newWallet.tokenSymbol}`);
    console.log(`   Status: ${newWallet.status}`);
    
    return newWallet;
    
  } catch (error) {
    console.error(`❌ Error creating wallet '${walletData.address}':`, error.message);
    throw error;
  }
}

async function seedWallets() {
  try {
    console.log('🚀 Starting wallets seed process...');
    console.log('=' .repeat(50));
    
    // Connect to database
    await database.connect();
    
    const createdWallets = [];
    
    // Create each wallet
    for (const walletData of SAMPLE_WALLETS) {
      const wallet = await createWallet(walletData);
      createdWallets.push(wallet);
      console.log(''); // Add spacing
    }
    
    console.log('=' .repeat(50));
    console.log('🎉 Wallets seed completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   Total wallets created/updated: ${createdWallets.length}`);
    console.log(`   Network: ${WALLET_CONFIG.network} (${WALLET_CONFIG.networkName})`);
    console.log(`   Token: ${WALLET_CONFIG.tokenSymbol}`);
    console.log(`   Contract: ${WALLET_CONFIG.tokenContract}`);
    console.log('');
    
    console.log('💳 Wallet Details:');
    createdWallets.forEach((wallet, index) => {
      console.log(`   ${index + 1}. ${wallet.label}`);
      console.log(`      Address: ${wallet.address}`);
      console.log(`      Status: ${wallet.status}`);
      console.log(`      Available: ${wallet.isAvailable ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    console.log('⚠️ IMPORTANT NOTES:');
    console.log('   - These are sample wallet addresses for development');
    console.log('   - In production, use real wallet addresses with proper private keys');
    console.log('   - Private keys are encrypted and stored securely');
    console.log('   - Monitor wallet health and balance regularly');
    console.log('   - Set up proper backup and recovery procedures');
    
  } catch (error) {
    console.error('💥 Wallets seed failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Disconnect from database
    await database.disconnect();
    process.exit(0);
  }
}

// Validation function
function validateEnvironment() {
  const requiredVars = ['MONGODB_URI'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    process.exit(1);
  }
}

// Validation function for wallet addresses
function validateWalletAddresses() {
  console.log('🔍 Validating wallet addresses...');
  
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  
  SAMPLE_WALLETS.forEach((wallet, index) => {
    if (!addressRegex.test(wallet.address)) {
      console.error(`❌ Wallet ${index + 1} has invalid address format:`, wallet.address);
      console.error('   Expected format: 0x followed by 40 hexadecimal characters');
      process.exit(1);
    }
    
    if (!wallet.label || wallet.label.trim().length === 0) {
      console.error(`❌ Wallet ${index + 1} missing label`);
      process.exit(1);
    }
    
    console.log(`✅ Wallet ${index + 1} (${wallet.label}) address is valid`);
  });
  
  // Check for duplicate addresses
  const addresses = SAMPLE_WALLETS.map(w => w.address.toLowerCase());
  const duplicates = addresses.filter((addr, index) => addresses.indexOf(addr) !== index);
  
  if (duplicates.length > 0) {
    console.error('❌ Duplicate wallet addresses found:', duplicates);
    process.exit(1);
  }
  
  console.log('✅ All wallet addresses are unique and valid');
}

// Function to add custom wallets
async function addCustomWallet(address, label, description) {
  try {
    if (!address || !label) {
      throw new Error('Address and label are required');
    }
    
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(address)) {
      throw new Error('Invalid wallet address format');
    }
    
    await database.connect();
    
    const wallet = await createWallet({
      address: address,
      label: label,
      description: description || `Custom wallet: ${label}`
    });
    
    console.log('✅ Custom wallet added successfully!');
    return wallet;
    
  } catch (error) {
    console.error('❌ Error adding custom wallet:', error.message);
    throw error;
  } finally {
    await database.disconnect();
  }
}

// Handle script execution
if (require.main === module) {
  console.log('🔧 Validating environment...');
  validateEnvironment();
  
  console.log('🔧 Validating wallet addresses...');
  validateWalletAddresses();
  
  console.log('🌱 Starting wallets seed...');
  seedWallets();
}

module.exports = {
  seedWallets,
  createWallet,
  addCustomWallet,
  WALLET_CONFIG,
  SAMPLE_WALLETS,
  encryptPrivateKey
};
/**
 * Admin Seed Script
 * Creates the initial admin user and special referral code
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const database = require('../src/config/database');
const { User, SpecialCode } = require('../src/models');

// Admin configuration
const ADMIN_CONFIG = {
  email: process.env.ADMIN_EMAIL || 'admin@grow5x.com',
  password: process.env.ADMIN_PASSWORD || 'Admin123!@#',
  firstName: 'Admin',
  lastName: 'Grow5X',
  phone: '+1234567890',
  country: 'Global',
  referralCode: 'GROW5X_ADMIN'
};

const SPECIAL_CODE_CONFIG = {
  code: 'GROW5X_ADMIN',
  type: 'admin_referral',
  description: 'Admin referral code for Grow5X platform'
};

async function createAdmin() {
  try {
    console.log('🔍 Checking if admin already exists...');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({
      $or: [
        { email: ADMIN_CONFIG.email },
        { referralCode: ADMIN_CONFIG.referralCode }
      ]
    });
    
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists:', existingAdmin.email);
      return existingAdmin;
    }
    
    console.log('👤 Creating admin user...');
    
    // Create admin user
    const adminUser = new User({
      ...ADMIN_CONFIG,
      role: 'admin',
      isActive: true,
      isVerified: true,
      registrationIP: '127.0.0.1',
      userAgent: 'Seed Script'
    });
    
    await adminUser.save();
    
    console.log('✅ Admin user created successfully:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   User ID: ${adminUser.userId}`);
    console.log(`   Referral Code: ${adminUser.referralCode}`);
    
    return adminUser;
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    throw error;
  }
}

async function createSpecialCode(adminUser) {
  try {
    console.log('🎫 Checking if special code already exists...');
    
    // Check if special code already exists
    const existingCode = await SpecialCode.findOne({
      code: SPECIAL_CODE_CONFIG.code
    });
    
    if (existingCode) {
      console.log('⚠️ Special code already exists:', existingCode.code);
      return existingCode;
    }
    
    console.log('🎫 Creating special referral code...');
    
    // Create special code
    const specialCode = new SpecialCode({
      ...SPECIAL_CODE_CONFIG,
      createdBy: adminUser._id,
      isActive: true,
      maxUses: null, // Unlimited uses
      validUntil: null // No expiration
    });
    
    await specialCode.save();
    
    console.log('✅ Special code created successfully:');
    console.log(`   Code: ${specialCode.code}`);
    console.log(`   Type: ${specialCode.type}`);
    console.log(`   Code ID: ${specialCode.codeId}`);
    
    return specialCode;
    
  } catch (error) {
    console.error('❌ Error creating special code:', error.message);
    throw error;
  }
}

async function seedAdmin() {
  try {
    console.log('🚀 Starting admin seed process...');
    console.log('=' .repeat(50));
    
    // Connect to database
    await database.connect();
    
    // Create admin user
    const adminUser = await createAdmin();
    
    // Create special code
    const specialCode = await createSpecialCode(adminUser);
    
    console.log('=' .repeat(50));
    console.log('🎉 Admin seed completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   Admin Email: ${adminUser.email}`);
    console.log(`   Admin Password: ${ADMIN_CONFIG.password}`);
    console.log(`   Referral Code: ${adminUser.referralCode}`);
    console.log(`   Special Code: ${specialCode.code}`);
    console.log('');
    console.log('⚠️ IMPORTANT: Change the admin password after first login!');
    
  } catch (error) {
    console.error('💥 Admin seed failed:', error.message);
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
  
  // Validate admin email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(ADMIN_CONFIG.email)) {
    console.error('❌ Invalid admin email format:', ADMIN_CONFIG.email);
    process.exit(1);
  }
  
  // Validate password strength
  if (ADMIN_CONFIG.password.length < 8) {
    console.error('❌ Admin password must be at least 8 characters long');
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  console.log('🔧 Validating environment...');
  validateEnvironment();
  
  console.log('🌱 Starting admin seed...');
  seedAdmin();
}

module.exports = {
  seedAdmin,
  createAdmin,
  createSpecialCode,
  ADMIN_CONFIG,
  SPECIAL_CODE_CONFIG
};
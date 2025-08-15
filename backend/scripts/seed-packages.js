/**
 * Packages Seed Script
 * Creates the initial license packages (Starter and Diamond)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const database = require('../src/config/database');
const { Package } = require('../src/models');

// Package configurations
const PACKAGES_CONFIG = [
  {
    name: 'Starter',
    price: 100,
    currency: 'USDT',
    dailyBenefitRate: 0.125, // 12.5%
    benefitDays: 8,
    totalCycles: 5,
    commissionRates: {
      level1: 0.10, // 10%
      level2: 0.05, // 5%
      level3: 0.03, // 3%
      level4: 0.02, // 2%
      level5: 0.01  // 1%
    },
    description: 'Licencia de entrada perfecta para comenzar tu journey en trading automatizado',
    features: [
      'Acceso completo al sistema de trading',
      'Beneficios diarios del 12.5%',
      '8 días por ciclo, 5 ciclos totales',
      'Comisiones de referidos hasta nivel 5',
      'Soporte técnico incluido',
      'Dashboard personalizado'
    ],
    isActive: true,
    isVisible: true,
    minPurchase: 1,
    maxPurchase: 1,
    sortOrder: 1
  },
  {
    name: 'Diamond',
    price: 500,
    currency: 'USDT',
    dailyBenefitRate: 0.125, // 12.5%
    benefitDays: 8,
    totalCycles: 5,
    commissionRates: {
      level1: 0.10, // 10%
      level2: 0.05, // 5%
      level3: 0.03, // 3%
      level4: 0.02, // 2%
      level5: 0.01  // 1%
    },
    description: 'Licencia premium con mayor capital y mejores retornos para traders experimentados',
    features: [
      'Acceso VIP al sistema de trading',
      'Beneficios diarios del 12.5%',
      '8 días por ciclo, 5 ciclos totales',
      'Comisiones de referidos hasta nivel 5',
      'Soporte prioritario 24/7',
      'Dashboard avanzado con analytics',
      'Acceso a estrategias premium',
      'Reportes detallados de performance'
    ],
    isActive: true,
    isVisible: true,
    minPurchase: 1,
    maxPurchase: 1,
    sortOrder: 2
  }
];

async function createPackage(packageConfig) {
  try {
    console.log(`📦 Checking if package '${packageConfig.name}' already exists...`);
    
    // Check if package already exists
    const existingPackage = await Package.findOne({
      name: packageConfig.name
    });
    
    if (existingPackage) {
      console.log(`⚠️ Package '${packageConfig.name}' already exists`);
      
      // Update existing package with new configuration
      Object.assign(existingPackage, packageConfig);
      await existingPackage.save();
      
      console.log(`✅ Package '${packageConfig.name}' updated successfully`);
      return existingPackage;
    }
    
    console.log(`📦 Creating package '${packageConfig.name}'...`);
    
    // Create new package
    const newPackage = new Package(packageConfig);
    await newPackage.save();
    
    console.log(`✅ Package '${packageConfig.name}' created successfully:`);
    console.log(`   Package ID: ${newPackage.packageId}`);
    console.log(`   Price: ${newPackage.price} ${newPackage.currency}`);
    console.log(`   Total ROI: ${newPackage.totalROI.toFixed(2)}%`);
    console.log(`   Duration: ${newPackage.totalDurationDays} days`);
    
    return newPackage;
    
  } catch (error) {
    console.error(`❌ Error creating package '${packageConfig.name}':`, error.message);
    throw error;
  }
}

async function seedPackages() {
  try {
    console.log('🚀 Starting packages seed process...');
    console.log('=' .repeat(50));
    
    // Connect to database
    await database.connect();
    
    const createdPackages = [];
    
    // Create each package
    for (const packageConfig of PACKAGES_CONFIG) {
      const package = await createPackage(packageConfig);
      createdPackages.push(package);
      console.log(''); // Add spacing
    }
    
    console.log('=' .repeat(50));
    console.log('🎉 Packages seed completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    
    createdPackages.forEach(pkg => {
      console.log(`   ${pkg.name}:`);
      console.log(`     - Price: ${pkg.price} ${pkg.currency}`);
      console.log(`     - Daily Rate: ${(pkg.dailyBenefitRate * 100).toFixed(1)}%`);
      console.log(`     - Total ROI: ${pkg.totalROI.toFixed(2)}%`);
      console.log(`     - Duration: ${pkg.totalDurationDays} days`);
      console.log(`     - Features: ${pkg.features.length} items`);
      console.log('');
    });
    
    // Display commission structure
    console.log('💰 Commission Structure:');
    const samplePackage = createdPackages[0];
    Object.entries(samplePackage.commissionRates).forEach(([level, rate]) => {
      console.log(`   ${level}: ${(rate * 100).toFixed(1)}%`);
    });
    
  } catch (error) {
    console.error('💥 Packages seed failed:', error.message);
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

// Validation function for package configuration
function validatePackageConfig() {
  console.log('🔍 Validating package configurations...');
  
  PACKAGES_CONFIG.forEach((pkg, index) => {
    // Validate required fields
    const requiredFields = ['name', 'price', 'dailyBenefitRate', 'benefitDays', 'totalCycles'];
    const missing = requiredFields.filter(field => pkg[field] === undefined || pkg[field] === null);
    
    if (missing.length > 0) {
      console.error(`❌ Package ${index + 1} missing required fields:`, missing);
      process.exit(1);
    }
    
    // Validate price
    if (pkg.price <= 0) {
      console.error(`❌ Package '${pkg.name}' has invalid price:`, pkg.price);
      process.exit(1);
    }
    
    // Validate daily benefit rate
    if (pkg.dailyBenefitRate <= 0 || pkg.dailyBenefitRate > 1) {
      console.error(`❌ Package '${pkg.name}' has invalid daily benefit rate:`, pkg.dailyBenefitRate);
      process.exit(1);
    }
    
    // Validate commission rates
    if (pkg.commissionRates) {
      Object.entries(pkg.commissionRates).forEach(([level, rate]) => {
        if (rate < 0 || rate > 1) {
          console.error(`❌ Package '${pkg.name}' has invalid commission rate for ${level}:`, rate);
          process.exit(1);
        }
      });
    }
    
    console.log(`✅ Package '${pkg.name}' configuration is valid`);
  });
}

// Handle script execution
if (require.main === module) {
  console.log('🔧 Validating environment...');
  validateEnvironment();
  
  console.log('🔧 Validating package configurations...');
  validatePackageConfig();
  
  console.log('🌱 Starting packages seed...');
  seedPackages();
}

module.exports = {
  seedPackages,
  createPackage,
  PACKAGES_CONFIG
};
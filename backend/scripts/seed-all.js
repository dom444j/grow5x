/**
 * Master Seed Script
 * Executes all seed scripts in the correct order
 */

require('dotenv').config();
const { seedAdmin } = require('./seed-admin');
const { seedPackages } = require('./seed-packages');
const { seedWallets } = require('./seed-wallets');

async function seedAll() {
  try {
    console.log('🚀 Starting complete database seeding process...');
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    
    // Step 1: Seed Admin
    console.log('\n📍 STEP 1: Seeding Admin User and Special Codes');
    console.log('-' .repeat(50));
    await seedAdmin();
    
    // Step 2: Seed Packages
    console.log('\n📍 STEP 2: Seeding License Packages');
    console.log('-' .repeat(50));
    await seedPackages();
    
    // Step 3: Seed Wallets
    console.log('\n📍 STEP 3: Seeding Payment Wallets');
    console.log('-' .repeat(50));
    await seedWallets();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 COMPLETE DATABASE SEEDING FINISHED SUCCESSFULLY!');
    console.log('=' .repeat(60));
    console.log('');
    console.log('📊 Summary:');
    console.log(`   ✅ Admin user and special codes created`);
    console.log(`   ✅ License packages (Starter & Diamond) created`);
    console.log(`   ✅ Payment wallet pool created`);
    console.log(`   ⏱️ Total execution time: ${duration} seconds`);
    console.log('');
    console.log('🚀 Your Grow5X backend is now ready!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Start the backend server: npm run dev');
    console.log('   2. Test the API endpoints');
    console.log('   3. Configure the frontend to connect to the backend');
    console.log('   4. Set up the cron jobs for daily benefits and commissions');
    console.log('');
    console.log('⚠️ IMPORTANT:');
    console.log('   - Change the admin password after first login');
    console.log('   - Replace sample wallet addresses with real ones in production');
    console.log('   - Set up proper environment variables for production');
    console.log('   - Configure SSL certificates for HTTPS');
    console.log('   - Set up database backups and monitoring');
    
  } catch (error) {
    console.error('\n💥 Database seeding failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  console.log('🌱 Starting complete database seeding...');
  seedAll();
}

module.exports = {
  seedAll
};
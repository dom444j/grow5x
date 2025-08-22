#!/usr/bin/env node
/**
 * Data Cleanup and Normalization Script for USDT/BEP20 Hardening
 * Cleans and normalizes existing data in MongoDB Atlas to comply with USDT/BEP20 only configuration
 * 
 * Usage:
 *   node cleanup-data-usdt-bep20.js [--dry-run] [--force] [--backup]
 * 
 * Options:
 *   --dry-run   Show what would be changed without making modifications
 *   --force     Skip confirmation prompts
 *   --backup    Create backup before making changes
 *   --help      Show this help message
 */

const mongoose = require('mongoose');
const { validateUSDTBEP20Address, validateUSDTBEP20Network, ALLOWED_CONFIG } = require('../validators/usdtBep20Validators');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const shouldBackup = args.includes('--backup');
const showHelp = args.includes('--help');

if (showHelp) {
  console.log(`
🧹 Script de Limpieza de Datos USDT/BEP20

Limpia y normaliza datos existentes para cumplir con el hardening USDT/BEP20.

Uso:
  node cleanup-data-usdt-bep20.js [opciones]

Opciones:
  --dry-run   Mostrar qué se cambiaría sin hacer modificaciones
  --force     Saltar confirmaciones
  --backup    Crear respaldo antes de hacer cambios
  --help      Mostrar este mensaje de ayuda

Ejemplos:
  node cleanup-data-usdt-bep20.js --dry-run      # Vista previa
  node cleanup-data-usdt-bep20.js --backup       # Limpiar con respaldo
  node cleanup-data-usdt-bep20.js --force        # Limpiar sin confirmación
`);
  process.exit(0);
}

/**
 * Statistics tracking
 */
let stats = {
  wallets: { total: 0, invalid: 0, updated: 0, disabled: 0 },
  withdrawals: { total: 0, invalid: 0, updated: 0, cancelled: 0 },
  purchases: { total: 0, invalid: 0, updated: 0, cancelled: 0 },
  transactions: { total: 0, invalid: 0, updated: 0, cancelled: 0 }
};

/**
 * Create backup of collections
 */
async function createBackup(db) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPrefix = `backup_${timestamp}`;
  
  console.log(`📦 Creando respaldo con prefijo: ${backupPrefix}`);
  
  const collections = ['wallets', 'withdrawals', 'purchases', 'transactions'];
  
  for (const collection of collections) {
    try {
      const backupName = `${backupPrefix}_${collection}`;
      
      // Use aggregation to copy collection
      await db.collection(collection).aggregate([
        { $match: {} },
        { $out: backupName }
      ]).toArray();
      
      const count = await db.collection(backupName).countDocuments();
      console.log(`  ✅ ${collection} -> ${backupName} (${count} documentos)`);
      
    } catch (error) {
      console.error(`  ❌ Error respaldando ${collection}:`, error.message);
      throw error;
    }
  }
  
  console.log('✅ Respaldo completado exitosamente');
  return backupPrefix;
}

/**
 * Clean wallets collection
 */
async function cleanWallets(db, dryRun = false) {
  console.log('\n🔍 Analizando colección de wallets...');
  
  const wallets = await db.collection('wallets').find({}).toArray();
  stats.wallets.total = wallets.length;
  
  const invalidWallets = [];
  const walletsToUpdate = [];
  
  for (const wallet of wallets) {
    let isInvalid = false;
    let needsUpdate = false;
    const updates = {};
    
    // Check address format
    if (wallet.address && !validateUSDTBEP20Address(wallet.address)) {
      isInvalid = true;
    }
    
    // Check network
    if (wallet.network && !validateUSDTBEP20Network(wallet.network)) {
      if (wallet.network === 'BSC' || wallet.network === 'Binance Smart Chain') {
        updates.network = ALLOWED_CONFIG.network;
        needsUpdate = true;
      } else {
        isInvalid = true;
      }
    } else if (!wallet.network) {
      updates.network = ALLOWED_CONFIG.network;
      needsUpdate = true;
    }
    
    // Check currency
    if (wallet.currency && wallet.currency !== ALLOWED_CONFIG.currency) {
      if (['USDT', 'usdt', 'Tether', 'USDT-BEP20'].includes(wallet.currency)) {
        updates.currency = ALLOWED_CONFIG.currency;
        needsUpdate = true;
      } else {
        isInvalid = true;
      }
    } else if (!wallet.currency) {
      updates.currency = ALLOWED_CONFIG.currency;
      needsUpdate = true;
    }
    
    if (isInvalid) {
      invalidWallets.push({
        _id: wallet._id,
        address: wallet.address,
        network: wallet.network,
        currency: wallet.currency,
        reason: 'Invalid address format or unsupported network/currency'
      });
      stats.wallets.invalid++;
    } else if (needsUpdate) {
      walletsToUpdate.push({
        _id: wallet._id,
        updates
      });
      stats.wallets.updated++;
    }
  }
  
  console.log(`📊 Wallets encontradas: ${stats.wallets.total}`);
  console.log(`❌ Wallets inválidas: ${stats.wallets.invalid}`);
  console.log(`🔄 Wallets a actualizar: ${stats.wallets.updated}`);
  
  if (invalidWallets.length > 0) {
    console.log('\n❌ Wallets inválidas encontradas:');
    invalidWallets.forEach(w => {
      console.log(`  • ${w._id}: ${w.address} (${w.network}/${w.currency}) - ${w.reason}`);
    });
  }
  
  if (!dryRun) {
    // Disable invalid wallets
    if (invalidWallets.length > 0) {
      const invalidIds = invalidWallets.map(w => w._id);
      await db.collection('wallets').updateMany(
        { _id: { $in: invalidIds } },
        { 
          $set: { 
            isActive: false, 
            status: 'DISABLED',
            notes: 'Deshabilitada por hardening USDT/BEP20 - formato inválido'
          }
        }
      );
      stats.wallets.disabled = invalidWallets.length;
    }
    
    // Update wallets that can be normalized
    for (const wallet of walletsToUpdate) {
      await db.collection('wallets').updateOne(
        { _id: wallet._id },
        { $set: wallet.updates }
      );
    }
  }
  
  return { invalidWallets, walletsToUpdate };
}

/**
 * Clean withdrawals collection
 */
async function cleanWithdrawals(db, dryRun = false) {
  console.log('\n🔍 Analizando colección de retiros...');
  
  const withdrawals = await db.collection('withdrawals').find({}).toArray();
  stats.withdrawals.total = withdrawals.length;
  
  const invalidWithdrawals = [];
  const withdrawalsToUpdate = [];
  
  for (const withdrawal of withdrawals) {
    let isInvalid = false;
    let needsUpdate = false;
    const updates = {};
    
    // Check wallet address
    if (withdrawal.walletAddress && !validateUSDTBEP20Address(withdrawal.walletAddress)) {
      isInvalid = true;
    }
    
    // Check network
    if (withdrawal.network && !validateUSDTBEP20Network(withdrawal.network)) {
      if (withdrawal.network === 'BSC' || withdrawal.network === 'Binance Smart Chain') {
        updates.network = ALLOWED_CONFIG.network;
        needsUpdate = true;
      } else {
        isInvalid = true;
      }
    }
    
    // Check currency
    if (withdrawal.currency && withdrawal.currency !== ALLOWED_CONFIG.currency) {
      if (['USDT', 'usdt', 'Tether', 'USDT-BEP20'].includes(withdrawal.currency)) {
        updates.currency = ALLOWED_CONFIG.currency;
        needsUpdate = true;
      } else {
        isInvalid = true;
      }
    }
    
    if (isInvalid) {
      invalidWithdrawals.push({
        _id: withdrawal._id,
        walletAddress: withdrawal.walletAddress,
        network: withdrawal.network,
        currency: withdrawal.currency,
        status: withdrawal.status
      });
      stats.withdrawals.invalid++;
    } else if (needsUpdate) {
      withdrawalsToUpdate.push({
        _id: withdrawal._id,
        updates
      });
      stats.withdrawals.updated++;
    }
  }
  
  console.log(`📊 Retiros encontrados: ${stats.withdrawals.total}`);
  console.log(`❌ Retiros inválidos: ${stats.withdrawals.invalid}`);
  console.log(`🔄 Retiros a actualizar: ${stats.withdrawals.updated}`);
  
  if (!dryRun) {
    // Cancel invalid withdrawals that are still pending
    if (invalidWithdrawals.length > 0) {
      const pendingInvalidIds = invalidWithdrawals
        .filter(w => ['PENDING', 'APPROVED'].includes(w.status))
        .map(w => w._id);
      
      if (pendingInvalidIds.length > 0) {
        await db.collection('withdrawals').updateMany(
          { _id: { $in: pendingInvalidIds } },
          { 
            $set: { 
              status: 'CANCELLED',
              rejectionReason: 'Cancelado por hardening USDT/BEP20 - formato inválido'
            }
          }
        );
        stats.withdrawals.cancelled = pendingInvalidIds.length;
      }
    }
    
    // Update withdrawals that can be normalized
    for (const withdrawal of withdrawalsToUpdate) {
      await db.collection('withdrawals').updateOne(
        { _id: withdrawal._id },
        { $set: withdrawal.updates }
      );
    }
  }
  
  return { invalidWithdrawals, withdrawalsToUpdate };
}

/**
 * Clean purchases collection
 */
async function cleanPurchases(db, dryRun = false) {
  console.log('\n🔍 Analizando colección de compras...');
  
  const purchases = await db.collection('purchases').find({}).toArray();
  stats.purchases.total = purchases.length;
  
  const invalidPurchases = [];
  const purchasesToUpdate = [];
  
  for (const purchase of purchases) {
    let isInvalid = false;
    let needsUpdate = false;
    const updates = {};
    
    // Check payment addresses
    const paymentAddress = purchase.payTo || purchase.paymentAddress;
    if (paymentAddress && !validateUSDTBEP20Address(paymentAddress)) {
      isInvalid = true;
    }
    
    // Check network
    if (purchase.network && !validateUSDTBEP20Network(purchase.network)) {
      if (purchase.network === 'BSC' || purchase.network === 'Binance Smart Chain') {
        updates.network = ALLOWED_CONFIG.network;
        needsUpdate = true;
      } else {
        isInvalid = true;
      }
    }
    
    // Check currency
    if (purchase.currency && purchase.currency !== ALLOWED_CONFIG.currency) {
      if (['USDT', 'usdt', 'Tether', 'USDT-BEP20'].includes(purchase.currency)) {
        updates.currency = ALLOWED_CONFIG.currency;
        needsUpdate = true;
      } else {
        isInvalid = true;
      }
    }
    
    if (isInvalid) {
      invalidPurchases.push({
        _id: purchase._id,
        paymentAddress,
        network: purchase.network,
        currency: purchase.currency,
        status: purchase.status
      });
      stats.purchases.invalid++;
    } else if (needsUpdate) {
      purchasesToUpdate.push({
        _id: purchase._id,
        updates
      });
      stats.purchases.updated++;
    }
  }
  
  console.log(`📊 Compras encontradas: ${stats.purchases.total}`);
  console.log(`❌ Compras inválidas: ${stats.purchases.invalid}`);
  console.log(`🔄 Compras a actualizar: ${stats.purchases.updated}`);
  
  if (!dryRun) {
    // Cancel invalid purchases that are still pending
    if (invalidPurchases.length > 0) {
      const pendingInvalidIds = invalidPurchases
        .filter(p => ['PENDING'].includes(p.status))
        .map(p => p._id);
      
      if (pendingInvalidIds.length > 0) {
        await db.collection('purchases').updateMany(
          { _id: { $in: pendingInvalidIds } },
          { 
            $set: { 
              status: 'CANCELLED'
            }
          }
        );
        stats.purchases.cancelled = pendingInvalidIds.length;
      }
    }
    
    // Update purchases that can be normalized
    for (const purchase of purchasesToUpdate) {
      await db.collection('purchases').updateOne(
        { _id: purchase._id },
        { $set: purchase.updates }
      );
    }
  }
  
  return { invalidPurchases, purchasesToUpdate };
}

/**
 * Clean transactions collection
 */
async function cleanTransactions(db, dryRun = false) {
  console.log('\n🔍 Analizando colección de transacciones...');
  
  const transactions = await db.collection('transactions').find({}).toArray();
  stats.transactions.total = transactions.length;
  
  const invalidTransactions = [];
  const transactionsToUpdate = [];
  
  for (const transaction of transactions) {
    let isInvalid = false;
    let needsUpdate = false;
    const updates = {};
    
    // Check wallet address
    if (transaction.walletAddress && !validateUSDTBEP20Address(transaction.walletAddress)) {
      isInvalid = true;
    }
    
    // Check network
    if (transaction.network && !validateUSDTBEP20Network(transaction.network)) {
      if (transaction.network === 'BSC' || transaction.network === 'Binance Smart Chain') {
        updates.network = ALLOWED_CONFIG.network;
        needsUpdate = true;
      } else {
        isInvalid = true;
      }
    }
    
    // Check currency
    if (transaction.currency && transaction.currency !== ALLOWED_CONFIG.currency) {
      if (['USDT', 'usdt', 'Tether', 'USDT-BEP20'].includes(transaction.currency)) {
        updates.currency = ALLOWED_CONFIG.currency;
        needsUpdate = true;
      } else {
        isInvalid = true;
      }
    }
    
    if (isInvalid) {
      invalidTransactions.push({
        _id: transaction._id,
        walletAddress: transaction.walletAddress,
        network: transaction.network,
        currency: transaction.currency,
        status: transaction.status
      });
      stats.transactions.invalid++;
    } else if (needsUpdate) {
      transactionsToUpdate.push({
        _id: transaction._id,
        updates
      });
      stats.transactions.updated++;
    }
  }
  
  console.log(`📊 Transacciones encontradas: ${stats.transactions.total}`);
  console.log(`❌ Transacciones inválidas: ${stats.transactions.invalid}`);
  console.log(`🔄 Transacciones a actualizar: ${stats.transactions.updated}`);
  
  if (!dryRun) {
    // Cancel invalid transactions that are still pending
    if (invalidTransactions.length > 0) {
      const pendingInvalidIds = invalidTransactions
        .filter(t => ['PENDING'].includes(t.status))
        .map(t => t._id);
      
      if (pendingInvalidIds.length > 0) {
        await db.collection('transactions').updateMany(
          { _id: { $in: pendingInvalidIds } },
          { 
            $set: { 
              status: 'CANCELLED'
            }
          }
        );
        stats.transactions.cancelled = pendingInvalidIds.length;
      }
    }
    
    // Update transactions that can be normalized
    for (const transaction of transactionsToUpdate) {
      await db.collection('transactions').updateOne(
        { _id: transaction._id },
        { $set: transaction.updates }
      );
    }
  }
  
  return { invalidTransactions, transactionsToUpdate };
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🧹 Iniciando limpieza de datos USDT/BEP20...');
    
    if (!process.env.MONGODB_URI) {
      console.error('❌ Error: MONGODB_URI no está configurado');
      process.exit(1);
    }
    
    console.log('🔌 Conectando a MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    console.log('✅ Conectado exitosamente');
    
    if (isDryRun) {
      console.log('\n🔍 MODO DRY-RUN: Analizando datos sin hacer cambios...');
    } else if (!isForce) {
      console.log('\n⚠️  ADVERTENCIA: Este script modificará datos en la base de datos.');
      console.log('   Asegúrate de tener un respaldo antes de continuar.');
      
      // In a real implementation, you'd want to add readline for user confirmation
      console.log('   Usa --force para saltar esta confirmación.');
      if (!shouldBackup) {
        console.log('   Usa --backup para crear un respaldo automático.');
        process.exit(1);
      }
    }
    
    let backupPrefix = null;
    if (shouldBackup && !isDryRun) {
      backupPrefix = await createBackup(db);
    }
    
    // Clean all collections
    await cleanWallets(db, isDryRun);
    await cleanWithdrawals(db, isDryRun);
    await cleanPurchases(db, isDryRun);
    await cleanTransactions(db, isDryRun);
    
    // Print summary
    console.log('\n📊 RESUMEN DE LIMPIEZA:');
    console.log('========================');
    
    Object.entries(stats).forEach(([collection, data]) => {
      console.log(`\n${collection.toUpperCase()}:`);
      console.log(`  📄 Total: ${data.total}`);
      console.log(`  ❌ Inválidos: ${data.invalid}`);
      console.log(`  🔄 Actualizados: ${data.updated}`);
      if (data.disabled) console.log(`  🚫 Deshabilitados: ${data.disabled}`);
      if (data.cancelled) console.log(`  ❌ Cancelados: ${data.cancelled}`);
    });
    
    if (isDryRun) {
      console.log('\n💡 Ejecuta sin --dry-run para aplicar los cambios');
    } else {
      console.log('\n✅ Limpieza completada exitosamente');
      if (backupPrefix) {
        console.log(`📦 Respaldo creado con prefijo: ${backupPrefix}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error.message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error no manejado:', error);
    process.exit(1);
  });
}

module.exports = { main };
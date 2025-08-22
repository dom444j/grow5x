#!/usr/bin/env node
/**
 * Apply MongoDB Atlas Schema Validations Script
 * Applies USDT/BEP20 hardening schema validations to MongoDB Atlas collections
 * 
 * Usage:
 *   node apply-mongo-schemas.js [--remove] [--dry-run]
 * 
 * Options:
 *   --remove    Remove existing schema validations
 *   --dry-run   Show what would be applied without making changes
 *   --help      Show this help message
 */

const { MongoClient } = require('mongodb');
const { applyAllSchemaValidations, removeAllSchemaValidations } = require('../validators/mongoSchemas');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const shouldRemove = args.includes('--remove');
const isDryRun = args.includes('--dry-run');
const showHelp = args.includes('--help');

if (showHelp) {
  console.log(`
🔒 MongoDB Atlas Schema Validation Script

Aplica validaciones de esquema USDT/BEP20 a las colecciones de MongoDB Atlas.

Uso:
  node apply-mongo-schemas.js [opciones]

Opciones:
  --remove    Remover validaciones existentes
  --dry-run   Mostrar qué se aplicaría sin hacer cambios
  --help      Mostrar este mensaje de ayuda

Ejemplos:
  node apply-mongo-schemas.js                    # Aplicar validaciones
  node apply-mongo-schemas.js --dry-run          # Vista previa
  node apply-mongo-schemas.js --remove           # Remover validaciones
`);
  process.exit(0);
}

// Global client variable for proper cleanup
let client = null;

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Iniciando script de validaciones de esquema MongoDB Atlas...');
    
    // Check MongoDB connection string
    if (!process.env.MONGODB_URI) {
      console.error('❌ Error: MONGODB_URI no está configurado en las variables de entorno');
      console.log('💡 Asegúrate de tener un archivo .env con MONGODB_URI configurado');
      process.exit(1);
    }
    
    console.log('🔌 Conectando a MongoDB Atlas...');
    console.log(`📍 URI: ${process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    
    // Connect to MongoDB using native client
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    console.log('✅ Conectado a MongoDB Atlas exitosamente');
    
    // Get database instance
    const dbName = process.env.MONGODB_URI.split('/').pop().split('?')[0];
    const db = client.db(dbName);
    
    // Verify connection by testing a simple command
    await db.admin().ping();
    
    if (isDryRun) {
      console.log('\n🔍 MODO DRY-RUN: Mostrando qué se aplicaría...');
      
      if (shouldRemove) {
        console.log('\n📋 Se removerían las validaciones de las siguientes colecciones:');
        console.log('  - wallets');
        console.log('  - withdrawals');
        console.log('  - purchases');
        console.log('  - transactions');
      } else {
        console.log('\n📋 Se aplicarían validaciones USDT/BEP20 a las siguientes colecciones:');
        console.log('  - wallets (solo direcciones BEP20, moneda USDT)');
        console.log('  - withdrawals (solo retiros USDT/BEP20)');
        console.log('  - purchases (solo compras USDT/BEP20)');
        console.log('  - transactions (solo transacciones USDT/BEP20)');
      }
      
      console.log('\n💡 Ejecuta sin --dry-run para aplicar los cambios');
      return;
    }
    
    let results;
    
    if (shouldRemove) {
      console.log('\n🔓 Removiendo validaciones de esquema...');
      results = await removeAllSchemaValidations(db);
      
      console.log('\n📊 Resultados de remoción:');
      results.forEach(({ collection, result }) => {
        console.log(`  ✅ ${collection}: ${result.ok ? 'Exitoso' : 'Falló'}`);
      });
      
    } else {
      console.log('\n🔒 Aplicando validaciones de esquema USDT/BEP20...');
      results = await applyAllSchemaValidations(db);
      
      console.log('\n📊 Resultados de aplicación:');
      results.forEach(({ collection, result }) => {
        console.log(`  ✅ ${collection}: ${result.ok ? 'Exitoso' : 'Falló'}`);
      });
      
      console.log('\n🛡️ Validaciones aplicadas exitosamente!');
      console.log('\n📝 Las siguientes reglas están ahora activas:');
      console.log('  • Solo direcciones BEP20 válidas (0x...)');
      console.log('  • Solo moneda USDT permitida');
      console.log('  • Solo red BEP20 permitida');
      console.log('  • Validación estricta en todas las operaciones');
      
      console.log('\n⚠️  IMPORTANTE:');
      console.log('  • Cualquier intento de insertar datos no conformes será rechazado');
      console.log('  • Esto incluye operaciones desde la aplicación y herramientas externas');
      console.log('  • Para desarrollo, usa --remove para desactivar temporalmente');
    }
    
  } catch (error) {
    console.error('\n❌ Error ejecutando script:', error.message);
    
    if (error.code === 8000) {
      console.log('\n💡 Sugerencias para error de autenticación:');
      console.log('  • Verifica que MONGODB_URI tenga las credenciales correctas');
      console.log('  • Asegúrate de que el usuario tenga permisos de escritura');
      console.log('  • Verifica que la IP esté en la whitelist de MongoDB Atlas');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Sugerencias para error de conexión:');
      console.log('  • Verifica tu conexión a internet');
      console.log('  • Asegúrate de que la URL de MongoDB Atlas sea correcta');
      console.log('  • Verifica que el cluster esté activo');
    } else if (error.message.includes('validator')) {
      console.log('\n💡 Sugerencias para error de validación:');
      console.log('  • Puede haber datos existentes que no cumplen el esquema');
      console.log('  • Ejecuta el script de limpieza de datos primero');
      console.log('  • Usa --dry-run para verificar antes de aplicar');
    }
    
    process.exit(1);
    
  } finally {
    if (client) {
      console.log('\n🔌 Cerrando conexión a MongoDB...');
      await client.close();
    }
  }
}

/**
 * Handle process termination
 */
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Script interrumpido por el usuario');
  if (client) {
    await client.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Script terminado');
  if (client) {
    await client.close();
  }
  process.exit(0);
});

// Execute main function
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error no manejado:', error);
    process.exit(1);
  });
}

module.exports = { main };
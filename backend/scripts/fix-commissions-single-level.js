/**
 * Script para limpiar comisiones multinivel y convertir a sistema simplificado
 * Elimina comisiones con level > 1 y tipos incorrectos
 * Remueve el campo level de todas las comisiones
 */

require('dotenv/config');
const mongoose = require('mongoose');
const { Commission } = require('../src/models');

async function cleanupCommissions() {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // 1. Eliminar comisiones con level > 1 o tipos incorrectos
    console.log('\n🧹 Eliminando comisiones multinivel...');
    const deleteResult = await Commission.deleteMany({
      $or: [
        { level: { $gt: 1 } },
        { type: { $nin: ['direct_referral', 'parent_bonus'] } }
      ]
    });
    console.log(`   Comisiones eliminadas: ${deleteResult.deletedCount}`);

    // 2. Remover campo level de todas las comisiones restantes
    console.log('\n🔧 Limpiando campo level...');
    const updateResult = await Commission.updateMany(
      { level: { $exists: true } },
      { $unset: { level: 1 } }
    );
    console.log(`   Comisiones actualizadas: ${updateResult.modifiedCount}`);

    // 3. Mostrar estadísticas finales
    console.log('\n📊 Estadísticas finales:');
    const stats = await Commission.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$commissionAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    stats.forEach(stat => {
      console.log(`   ${stat._id || 'sin_tipo'}: ${stat.count} comisiones, $${stat.totalAmount.toFixed(2)} USDT`);
    });

    const totalCommissions = await Commission.countDocuments();
    console.log(`   Total: ${totalCommissions} comisiones`);

    console.log('\n✅ Limpieza completada exitosamente');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

if (require.main === module) {
  cleanupCommissions();
}

module.exports = { cleanupCommissions };
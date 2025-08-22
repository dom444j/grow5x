#!/usr/bin/env node
/**
 * CI/CD Hardening Check Script for USDT/BEP20 Enforcement
 * Detects violations of USDT/BEP20 hardening policies in code and configurations
 * 
 * Usage:
 *   node ci-hardening-check.js [--fix] [--strict] [--output=json|text]
 * 
 * Options:
 *   --fix       Attempt to auto-fix violations where possible
 *   --strict    Fail on any violation (for CI/CD pipelines)
 *   --output    Output format: json or text (default: text)
 *   --help      Show this help message
 * 
 * Exit codes:
 *   0 - No violations found
 *   1 - Violations found (in strict mode)
 *   2 - Script error
 */

const fs = require('fs');
const path = require('path');
const { validateUSDTBEP20Address, validateUSDTBEP20Network, ALLOWED_CONFIG } = require('../validators/usdtBep20Validators');

// Parse command line arguments
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const isStrict = args.includes('--strict');
const outputFormat = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'text';
const showHelp = args.includes('--help');

if (showHelp) {
  console.log(`
🔒 CI/CD Hardening Check Script

Detecta violaciones de las políticas de hardening USDT/BEP20.

Uso:
  node ci-hardening-check.js [opciones]

Opciones:
  --fix       Intentar auto-corregir violaciones donde sea posible
  --strict    Fallar en cualquier violación (para pipelines CI/CD)
  --output    Formato de salida: json o text (default: text)
  --help      Mostrar este mensaje de ayuda

Códigos de salida:
  0 - No se encontraron violaciones
  1 - Violaciones encontradas (en modo strict)
  2 - Error del script

Ejemplos:
  node ci-hardening-check.js                    # Verificación básica
  node ci-hardening-check.js --strict           # Para CI/CD
  node ci-hardening-check.js --fix              # Auto-corregir
  node ci-hardening-check.js --output=json      # Salida JSON
`);
  process.exit(0);
}

/**
 * Violation tracking
 */
let violations = {
  critical: [],
  warning: [],
  info: []
};

/**
 * Add violation to tracking
 */
function addViolation(level, type, file, line, message, suggestion = null) {
  violations[level].push({
    type,
    file,
    line,
    message,
    suggestion,
    timestamp: new Date().toISOString()
  });
}

/**
 * Check for hardcoded non-USDT/BEP20 configurations
 */
function checkHardcodedConfigurations(projectRoot) {
  const configPatterns = [
    // Network patterns
    { pattern: /['"]network['"]\s*:\s*['"](?!BEP20)[^'"]+['"]/gi, type: 'network', severity: 'critical' },
    { pattern: /network\s*=\s*['"](?!BEP20)[^'"]+['"]/gi, type: 'network', severity: 'critical' },
    
    // Currency patterns
    { pattern: /['"]currency['"]\s*:\s*['"](?!USDT)[^'"]+['"]/gi, type: 'currency', severity: 'critical' },
    { pattern: /currency\s*=\s*['"](?!USDT)[^'"]+['"]/gi, type: 'currency', severity: 'critical' },
    
    // Address patterns (non-BEP20)
    { pattern: /['"]address['"]\s*:\s*['"][13][a-km-zA-HJ-NP-Z1-9]{25,34}['"]/gi, type: 'bitcoin_address', severity: 'critical' },
    { pattern: /['"]address['"]\s*:\s*['"]T[A-Za-z1-9]{33}['"]/gi, type: 'tron_address', severity: 'critical' },
    
    // Legacy wallet references
    { pattern: /bitcoin|btc|ethereum|eth(?!_)|tron|trx|litecoin|ltc/gi, type: 'legacy_crypto', severity: 'warning' },
    
    // Forbidden networks
    { pattern: /mainnet|testnet|polygon|arbitrum|avalanche/gi, type: 'forbidden_network', severity: 'warning' }
  ];
  
  const filesToCheck = [
    'src/**/*.js',
    'src/**/*.json',
    'scripts/**/*.js',
    '.env.example',
    'package.json'
  ];
  
  function checkFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      configPatterns.forEach(({ pattern, type, severity }) => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split('\n').length;
          const lineContent = lines[lineNumber - 1]?.trim();
          
          addViolation(
            severity,
            type,
            path.relative(projectRoot, filePath),
            lineNumber,
            `Configuración hardcodeada detectada: ${match[0]}`,
            `Usar ALLOWED_CONFIG.${type === 'network' ? 'network' : type === 'currency' ? 'currency' : 'address'} en su lugar`
          );
        }
      });
      
    } catch (error) {
      addViolation('warning', 'file_error', filePath, 0, `Error leyendo archivo: ${error.message}`);
    }
  }
  
  function walkDirectory(dir, patterns) {
    try {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          walkDirectory(fullPath, patterns);
        } else if (stat.isFile()) {
          const ext = path.extname(file);
          if (['.js', '.json', '.env'].includes(ext) || file === '.env.example') {
            checkFile(fullPath);
          }
        }
      });
    } catch (error) {
      addViolation('warning', 'directory_error', dir, 0, `Error accediendo directorio: ${error.message}`);
    }
  }
  
  walkDirectory(projectRoot);
}

/**
 * Check middleware integration
 */
function checkMiddlewareIntegration(projectRoot) {
  const routesDir = path.join(projectRoot, 'src', 'routes');
  const criticalRoutes = ['admin.js', 'user.js', 'checkout.js', 'payments.js', 'withdrawals.js'];
  
  criticalRoutes.forEach(routeFile => {
    const filePath = path.join(routesDir, routeFile);
    
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for middleware imports
        const hasMiddlewareImport = /require\(['"][^'"]*usdtBep20Hardening['"]/g.test(content);
        
        if (!hasMiddlewareImport) {
          addViolation(
            'critical',
            'missing_middleware',
            path.relative(projectRoot, filePath),
            1,
            'Middleware de hardening USDT/BEP20 no importado',
            'Agregar: const { validateWalletAddress } = require(\'../middleware/usdtBep20Hardening\');'
          );
        }
        
        // Check for middleware usage in critical endpoints
        const criticalEndpoints = [
          { pattern: /router\.(post|put)\(['"][^'"]*wallet/, name: 'wallet operations' },
          { pattern: /router\.post\(['"][^'"]*withdrawal/, name: 'withdrawal operations' },
          { pattern: /router\.post\(['"][^'"]*checkout/, name: 'checkout operations' },
          { pattern: /router\.post\(['"][^'"]*payment/, name: 'payment operations' }
        ];
        
        criticalEndpoints.forEach(({ pattern, name }) => {
          const matches = content.match(pattern);
          if (matches) {
            matches.forEach(match => {
              const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
              const line = content.split('\n')[lineNumber - 1];
              
              if (!line.includes('validate') && !line.includes('hardening')) {
                addViolation(
                  'critical',
                  'unprotected_endpoint',
                  path.relative(projectRoot, filePath),
                  lineNumber,
                  `Endpoint crítico sin middleware de hardening: ${name}`,
                  'Agregar middleware de validación USDT/BEP20'
                );
              }
            });
          }
        });
        
      } catch (error) {
        addViolation('warning', 'file_error', routeFile, 0, `Error verificando middleware: ${error.message}`);
      }
    } else {
      addViolation('info', 'missing_file', routeFile, 0, 'Archivo de ruta no encontrado');
    }
  });
}

/**
 * Check model schemas
 */
function checkModelSchemas(projectRoot) {
  const modelsDir = path.join(projectRoot, 'src', 'models');
  const criticalModels = ['Wallet.js', 'Purchase.js', 'Withdrawal.js', 'Transaction.js'];
  
  criticalModels.forEach(modelFile => {
    const filePath = path.join(modelsDir, modelFile);
    
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for USDT/BEP20 validators
        const hasValidators = /validateUSDTBEP20|ALLOWED_CONFIG/g.test(content);
        
        if (!hasValidators) {
          addViolation(
            'warning',
            'missing_validators',
            path.relative(projectRoot, filePath),
            1,
            'Modelo sin validadores USDT/BEP20',
            'Agregar validadores de hardening al esquema'
          );
        }
        
        // Check for hardcoded enum values
        const enumPatterns = [
          { pattern: /enum\s*:\s*\[[^\]]*['"](?!USDT|BEP20)[A-Z]{3,}['"]/g, type: 'enum_values' }
        ];
        
        enumPatterns.forEach(({ pattern, type }) => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            
            addViolation(
              'warning',
              type,
              path.relative(projectRoot, filePath),
              lineNumber,
              `Valores enum hardcodeados detectados: ${match[0]}`,
              'Usar ALLOWED_CONFIG para valores permitidos'
            );
          }
        });
        
      } catch (error) {
        addViolation('warning', 'file_error', modelFile, 0, `Error verificando modelo: ${error.message}`);
      }
    }
  });
}

/**
 * Check environment configuration
 */
function checkEnvironmentConfig(projectRoot) {
  const envFiles = ['.env.example', '.env.production', '.env.staging'];
  
  envFiles.forEach(envFile => {
    const filePath = path.join(projectRoot, envFile);
    
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for required USDT/BEP20 configurations
        const requiredConfigs = [
          'ALLOWED_NETWORK=BEP20',
          'ALLOWED_CURRENCY=USDT'
        ];
        
        requiredConfigs.forEach(config => {
          if (!content.includes(config)) {
            addViolation(
              'warning',
              'missing_env_config',
              envFile,
              0,
              `Configuración de entorno faltante: ${config}`,
              `Agregar ${config} al archivo de entorno`
            );
          }
        });
        
        // Check for forbidden configurations
        const forbiddenPatterns = [
          { pattern: /NETWORK.*=.*(?!BEP20)/gi, message: 'Red no permitida en configuración' },
          { pattern: /CURRENCY.*=.*(?!USDT)/gi, message: 'Moneda no permitida en configuración' }
        ];
        
        forbiddenPatterns.forEach(({ pattern, message }) => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            
            addViolation(
              'critical',
              'forbidden_env_config',
              envFile,
              lineNumber,
              `${message}: ${match[0]}`,
              'Cambiar a configuración USDT/BEP20'
            );
          }
        });
        
      } catch (error) {
        addViolation('warning', 'file_error', envFile, 0, `Error verificando configuración: ${error.message}`);
      }
    }
  });
}

/**
 * Check package.json for forbidden dependencies
 */
function checkDependencies(projectRoot) {
  const packagePath = path.join(projectRoot, 'package.json');
  
  if (fs.existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const forbiddenDeps = [
        'bitcoin', 'bitcoinjs-lib', 'btc',
        'ethereum', 'ethers', 'web3',
        'tron', 'tronweb',
        'litecoin', 'ltc'
      ];
      
      const allDeps = {
        ...packageJson.dependencies || {},
        ...packageJson.devDependencies || {}
      };
      
      forbiddenDeps.forEach(dep => {
        if (allDeps[dep]) {
          addViolation(
            'warning',
            'forbidden_dependency',
            'package.json',
            0,
            `Dependencia no permitida encontrada: ${dep}`,
            'Remover dependencias de criptomonedas no soportadas'
          );
        }
      });
      
    } catch (error) {
      addViolation('warning', 'file_error', 'package.json', 0, `Error verificando dependencias: ${error.message}`);
    }
  }
}

/**
 * Auto-fix violations where possible
 */
function autoFixViolations(projectRoot) {
  if (!shouldFix) return;
  
  let fixedCount = 0;
  
  violations.critical.concat(violations.warning).forEach(violation => {
    if (violation.type === 'network' && violation.suggestion) {
      try {
        const filePath = path.join(projectRoot, violation.file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Simple replacements for common patterns
        content = content.replace(/network['"]\s*:\s*['"]BSC['"]/gi, 'network": "BEP20"');
        content = content.replace(/currency['"]\s*:\s*['"]USDT-BEP20['"]/gi, 'currency": "USDT"');
        
        fs.writeFileSync(filePath, content);
        fixedCount++;
        
      } catch (error) {
        addViolation('warning', 'fix_error', violation.file, violation.line, `Error auto-corrigiendo: ${error.message}`);
      }
    }
  });
  
  if (fixedCount > 0) {
    console.log(`🔧 Auto-corregidas ${fixedCount} violaciones`);
  }
}

/**
 * Output results
 */
function outputResults() {
  const totalViolations = violations.critical.length + violations.warning.length + violations.info.length;
  
  if (outputFormat === 'json') {
    console.log(JSON.stringify({
      summary: {
        total: totalViolations,
        critical: violations.critical.length,
        warning: violations.warning.length,
        info: violations.info.length
      },
      violations
    }, null, 2));
  } else {
    console.log('\n🔒 REPORTE DE HARDENING USDT/BEP20');
    console.log('=====================================');
    
    console.log(`\n📊 RESUMEN:`);
    console.log(`  🔴 Críticas: ${violations.critical.length}`);
    console.log(`  🟡 Advertencias: ${violations.warning.length}`);
    console.log(`  🔵 Información: ${violations.info.length}`);
    console.log(`  📋 Total: ${totalViolations}`);
    
    ['critical', 'warning', 'info'].forEach(level => {
      if (violations[level].length > 0) {
        const emoji = level === 'critical' ? '🔴' : level === 'warning' ? '🟡' : '🔵';
        console.log(`\n${emoji} ${level.toUpperCase()}:`);
        
        violations[level].forEach((violation, index) => {
          console.log(`\n  ${index + 1}. ${violation.message}`);
          console.log(`     📁 Archivo: ${violation.file}`);
          if (violation.line > 0) console.log(`     📍 Línea: ${violation.line}`);
          console.log(`     🏷️  Tipo: ${violation.type}`);
          if (violation.suggestion) console.log(`     💡 Sugerencia: ${violation.suggestion}`);
        });
      }
    });
    
    if (totalViolations === 0) {
      console.log('\n✅ ¡No se encontraron violaciones de hardening!');
      console.log('   El proyecto cumple con las políticas USDT/BEP20.');
    } else {
      console.log('\n⚠️  Se encontraron violaciones de hardening.');
      console.log('   Revisa y corrige las violaciones antes del despliegue.');
      
      if (shouldFix) {
        console.log('\n🔧 Algunas violaciones pueden auto-corregirse con --fix');
      }
    }
  }
  
  return totalViolations;
}

/**
 * Main execution function
 */
function main() {
  try {
    const projectRoot = process.cwd();
    
    console.log('🔍 Iniciando verificación de hardening USDT/BEP20...');
    console.log(`📁 Directorio del proyecto: ${projectRoot}`);
    
    // Run all checks
    checkHardcodedConfigurations(projectRoot);
    checkMiddlewareIntegration(projectRoot);
    checkModelSchemas(projectRoot);
    checkEnvironmentConfig(projectRoot);
    checkDependencies(projectRoot);
    
    // Auto-fix if requested
    autoFixViolations(projectRoot);
    
    // Output results
    const totalViolations = outputResults();
    
    // Exit with appropriate code
    if (isStrict && totalViolations > 0) {
      console.log('\n❌ Modo strict: Fallando debido a violaciones encontradas');
      process.exit(1);
    } else if (violations.critical.length > 0) {
      console.log('\n⚠️  Violaciones críticas encontradas');
      process.exit(isStrict ? 1 : 0);
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando verificación de hardening:', error.message);
    process.exit(2);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { main, checkHardcodedConfigurations, checkMiddlewareIntegration };
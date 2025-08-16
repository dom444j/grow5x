# 🔧 Documentación Técnica de Seguridad

## 🏗️ Arquitectura de Seguridad

### Diagrama de Flujo de Validaciones

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Git Push      │───▶│  GitHub Actions  │───▶│   Merge Block   │
│   (Código)      │    │   CI Pipeline    │    │  (Si falla)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  CODEOWNERS     │    │  Security Guard  │    │   Deploy Block  │
│  Review Req.    │    │   Validation     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Approved      │    │   Tests Pass     │    │   Safe Deploy   │
│   Changes       │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌──────────────────┐
                    │   VPS Deploy     │
                    │   + Prestart     │
                    │   Validation     │
                    └──────────────────┘
                                 │
                                 ▼
                    ┌──────────────────┐
                    │   Runtime        │
                    │   Immutable      │
                    │   Constants      │
                    └──────────────────┘
```

## 🔍 Análisis de Componentes de Seguridad

### 1. Script de Validación Principal

**Archivo:** `backend/scripts/fix-commissions-single-level.js`

#### Funciones Principales

```javascript
// Función de validación de configuración
function validateCommissionConfig() {
  const configPath = path.join(__dirname, '../src/config/commissions.js');
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  // Patrones de detección multinivel
  const multiLevelPatterns = [
    /MAX_LEVELS\s*[>:]\s*[2-9]/,           // MAX_LEVELS > 1
    /level[s]?\s*[>:]\s*[2-9]/i,          // levels > 1
    /tier[s]?\s*[>:]\s*[2-9]/i,           // tiers > 1
    /depth\s*[>:]\s*[2-9]/i,              // depth > 1
    /cascade\s*[>:]\s*true/i,             // cascade: true
    /multilevel\s*[>:]\s*true/i,          // multilevel: true
    /pyramid\s*[>:]\s*true/i,             // pyramid: true
    /referral_levels\s*[>:]\s*[2-9]/i     // referral_levels > 1
  ];
  
  // Verificación de patrones
  for (const pattern of multiLevelPatterns) {
    if (pattern.test(configContent)) {
      console.error(`🚨 SECURITY ALERT: Multi-level pattern detected: ${pattern}`);
      console.error('📍 Location: commissions.js configuration file');
      console.error('🛑 Action: Deployment blocked for security');
      process.exit(1);
    }
  }
}

// Función de limpieza de archivos temporales
function cleanupTempFiles() {
  const tempPatterns = [
    'temp_commission_*.js',
    'backup_commission_*.js',
    '*.tmp',
    '.commission_cache'
  ];
  
  tempPatterns.forEach(pattern => {
    const files = glob.sync(pattern, { cwd: process.cwd() });
    files.forEach(file => {
      fs.unlinkSync(file);
      console.log(`🧹 Cleaned temporary file: ${file}`);
    });
  });
}

// Función de verificación de integridad
function verifyFileIntegrity() {
  const criticalFiles = [
    'backend/src/config/commissions.js',
    'backend/scripts/fix-commissions-single-level.js',
    '.github/workflows/guard.yml',
    '.github/CODEOWNERS'
  ];
  
  criticalFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      console.error(`🚨 CRITICAL: Missing security file: ${file}`);
      process.exit(1);
    }
  });
  
  console.log('✅ All critical security files present');
}
```

#### Algoritmo de Detección

1. **Lectura de archivos:** Escanea archivos de configuración
2. **Análisis de patrones:** Aplica regex para detectar configuraciones multinivel
3. **Validación de integridad:** Verifica presencia de archivos críticos
4. **Limpieza:** Elimina archivos temporales sospechosos
5. **Reporte:** Genera logs detallados de la validación

### 2. Configuración de Comisiones Inmutable

**Archivo:** `backend/src/config/commissions.js`

#### Estructura de Seguridad

```javascript
// Configuración base inmutable
const BASE_COMMISSION_CONFIG = {
  // Límite máximo de niveles (CRÍTICO)
  MAX_LEVELS: 1,
  
  // Tasa de comisión única
  SINGLE_LEVEL_RATE: 0.05, // 5%
  
  // Configuraciones de seguridad
  SECURITY: {
    MULTI_LEVEL_BLOCKED: true,
    PYRAMID_SCHEME_DETECTION: true,
    CASCADE_DISABLED: true
  },
  
  // Metadatos de validación
  VALIDATION: {
    LAST_CHECKED: new Date().toISOString(),
    SECURITY_VERSION: '1.0.0',
    COMPLIANCE_LEVEL: 'SINGLE_LEVEL_ONLY'
  }
};

// Función de validación en runtime
function validateRuntimeConfig(config) {
  // Verificaciones críticas
  if (config.MAX_LEVELS !== 1) {
    throw new Error('SECURITY VIOLATION: MAX_LEVELS must be 1');
  }
  
  if (config.SECURITY.MULTI_LEVEL_BLOCKED !== true) {
    throw new Error('SECURITY VIOLATION: Multi-level must be blocked');
  }
  
  if (config.SECURITY.CASCADE_DISABLED !== true) {
    throw new Error('SECURITY VIOLATION: Cascade must be disabled');
  }
  
  // Verificación de tipos
  if (typeof config.SINGLE_LEVEL_RATE !== 'number') {
    throw new Error('SECURITY VIOLATION: Invalid commission rate type');
  }
  
  if (config.SINGLE_LEVEL_RATE < 0 || config.SINGLE_LEVEL_RATE > 1) {
    throw new Error('SECURITY VIOLATION: Commission rate out of bounds');
  }
  
  return true;
}

// Aplicar validación y congelar configuración
validateRuntimeConfig(BASE_COMMISSION_CONFIG);
const COMMISSION_CONFIG = Object.freeze(BASE_COMMISSION_CONFIG);

// Verificación final antes de exportar
if (Object.isFrozen(COMMISSION_CONFIG) === false) {
  throw new Error('SECURITY VIOLATION: Configuration not properly frozen');
}

module.exports = COMMISSION_CONFIG;
```

### 3. GitHub Actions Workflow

**Archivo:** `.github/workflows/guard.yml`

#### Pipeline de Seguridad

```yaml
name: Security Guard Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    # Ejecutar verificación diaria a las 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  security-scan:
    name: Security Validation
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch completo para análisis histórico
      
      - name: Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: '18.x'
          cache: 'npm'
          cache-dependency-path: 'backend/package-lock.json'
      
      - name: Install Dependencies
        run: |
          cd backend
          npm ci --only=production
      
      - name: Run Security Validation
        run: |
          cd backend
          echo "🔍 Starting security validation..."
          npm run ci:guard
          echo "✅ Security validation completed"
      
      - name: Verify File Integrity
        run: |
          echo "🔍 Verifying critical files..."
          
          # Verificar archivos críticos
          critical_files=(
            "backend/src/config/commissions.js"
            "backend/scripts/fix-commissions-single-level.js"
            ".github/workflows/guard.yml"
            ".github/CODEOWNERS"
          )
          
          for file in "${critical_files[@]}"; do
            if [ ! -f "$file" ]; then
              echo "🚨 CRITICAL: Missing file $file"
              exit 1
            fi
            echo "✅ Found: $file"
          done
      
      - name: Code Pattern Analysis
        run: |
          echo "🔍 Analyzing code patterns..."
          
          # Buscar patrones sospechosos
          suspicious_patterns=(
            "multilevel"
            "pyramid"
            "cascade.*true"
            "MAX_LEVELS.*[2-9]"
            "levels.*[2-9]"
          )
          
          for pattern in "${suspicious_patterns[@]}"; do
            if grep -r -i "$pattern" backend/src/ --exclude-dir=node_modules; then
              echo "🚨 SUSPICIOUS PATTERN FOUND: $pattern"
              exit 1
            fi
          done
          
          echo "✅ No suspicious patterns detected"
      
      - name: Generate Security Report
        if: always()
        run: |
          echo "📊 Security Scan Report" > security-report.txt
          echo "========================" >> security-report.txt
          echo "Timestamp: $(date)" >> security-report.txt
          echo "Commit: $GITHUB_SHA" >> security-report.txt
          echo "Branch: $GITHUB_REF_NAME" >> security-report.txt
          echo "Status: ${{ job.status }}" >> security-report.txt
      
      - name: Upload Security Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-report
          path: security-report.txt
          retention-days: 30

  dependency-audit:
    name: Dependency Security Audit
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.x'
      
      - name: Run npm audit
        run: |
          cd backend
          npm audit --audit-level=moderate
      
      - name: Check for known vulnerabilities
        run: |
          cd backend
          npx audit-ci --moderate
```

### 4. CODEOWNERS Configuration

**Archivo:** `.github/CODEOWNERS`

#### Reglas de Protección

```bash
# =============================================================================
# CODEOWNERS - Protección de Archivos Críticos
# =============================================================================
# 
# Este archivo define qué usuarios deben revisar cambios en archivos específicos.
# Todos los archivos listados requieren aprobación obligatoria.
#

# Configuración de comisiones (CRÍTICO)
backend/src/config/commissions.js @dom444j
backend/src/config/ @dom444j

# Scripts de seguridad (CRÍTICO)
backend/scripts/fix-commissions-single-level.js @dom444j
backend/scripts/ @dom444j

# Workflows de GitHub Actions (CRÍTICO)
.github/workflows/ @dom444j
.github/workflows/guard.yml @dom444j

# Archivos de configuración de seguridad (CRÍTICO)
.github/CODEOWNERS @dom444j

# Archivos de configuración del proyecto
package.json @dom444j
backend/package.json @dom444j

# Documentación de seguridad
SECURITY-*.md @dom444j
TECHNICAL-SECURITY-*.md @dom444j

# Archivos de despliegue
deploy/ @dom444j
DEPLOY.md @dom444j

# Configuración de base de datos
backend/src/models/ @dom444j
backend/src/database/ @dom444j

# =============================================================================
# Reglas Globales
# =============================================================================

# Cualquier archivo que contenga "commission" en el nombre
*commission* @dom444j
*Commission* @dom444j

# Cualquier archivo que contenga "security" en el nombre
*security* @dom444j
*Security* @dom444j

# Archivos de configuración raíz
/.* @dom444j
```

## 🔐 Matriz de Seguridad

### Niveles de Protección

| Componente | Nivel | Automatización | Bloqueo | Alertas |
|------------|-------|----------------|---------|----------|
| Runtime Validation | CRÍTICO | ✅ | ✅ | ✅ |
| GitHub Actions | ALTO | ✅ | ✅ | ✅ |
| CODEOWNERS | ALTO | ⚠️ Manual | ✅ | ✅ |
| Prestart Scripts | MEDIO | ✅ | ✅ | ✅ |
| File Integrity | MEDIO | ✅ | ✅ | ⚠️ |

### Puntos de Fallo y Mitigación

1. **Bypass de validación prestart**
   - **Riesgo:** Medio
   - **Mitigación:** Runtime checks inmutables
   - **Detección:** Logs de aplicación

2. **Modificación directa en producción**
   - **Riesgo:** Alto
   - **Mitigación:** Constantes congeladas + PM2 restart
   - **Detección:** Health checks automáticos

3. **Compromiso de GitHub Actions**
   - **Riesgo:** Alto
   - **Mitigación:** CODEOWNERS + Branch protection
   - **Detección:** Audit logs de GitHub

## 📈 Métricas y Monitoreo

### KPIs de Seguridad

- **Tiempo de detección:** < 5 minutos
- **Tiempo de bloqueo:** < 1 minuto
- **Falsos positivos:** < 1%
- **Cobertura de código:** 100% archivos críticos

### Dashboards Recomendados

1. **GitHub Actions Status**
2. **CODEOWNERS Review Queue**
3. **PM2 Process Health**
4. **Security Validation Logs**

---

**Documento técnico v1.0**
**Última actualización:** 16 de Agosto, 2025
**Responsable técnico:** @dom444j
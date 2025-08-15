/**
 * Atlas Connection Assertion
 * Validates that we're using MongoDB Atlas in production
 */

function assertAtlasConnection() {
  const { DB_KIND, MONGODB_URI } = process.env;

  // Validate DB_KIND
  if (DB_KIND !== 'atlas') {
    throw new Error(`Invalid DB_KIND: expected 'atlas', got '${DB_KIND}'`);
  }

  // Validate MONGODB_URI format
  if (!MONGODB_URI || !MONGODB_URI.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI must start with "mongodb+srv://" for Atlas connection');
  }

  // Additional validation for Atlas URI structure
  if (!MONGODB_URI.includes('@') || !MONGODB_URI.includes('.mongodb.net')) {
    throw new Error('MONGODB_URI does not appear to be a valid Atlas connection string');
  }

  console.log('✅ Atlas connection configuration validated');
}

module.exports = { assertAtlasConnection };
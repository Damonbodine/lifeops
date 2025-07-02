require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Token Migration Script
 * Migrates existing token.json to new EmailService location
 */

async function migrateTokens() {
  console.log('🔄 Migrating existing tokens to new EmailService...');
  console.log('='.repeat(50));

  try {
    // Read existing token.json
    const oldTokenPath = path.join(__dirname, 'token.json');
    const tokenData = await fs.readFile(oldTokenPath, 'utf8');
    const tokens = JSON.parse(tokenData);
    
    console.log('✅ Found existing token.json');
    console.log(`Token expiry: ${new Date(tokens.expiry_date)}`);
    console.log(`Scopes: ${tokens.scope}`);

    // Create new token location
    const newTokenPath = path.join(os.homedir(), '.lifeops', 'gmail-tokens.json');
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(newTokenPath), { recursive: true });
    
    // Write tokens to new location
    await fs.writeFile(newTokenPath, JSON.stringify(tokens, null, 2));
    
    console.log('✅ Tokens migrated successfully');
    console.log(`New location: ${newTokenPath}`);

    // Test the migration by loading EmailService
    const emailService = require('./services/emailService');
    
    // Give it a moment to load tokens
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const authStatus = emailService.getAuthStatus();
    console.log('\n🔐 New Authentication Status:');
    console.log(`Authenticated: ${authStatus.authenticated ? '✅' : '❌'}`);
    console.log(`Has Refresh Token: ${authStatus.hasRefreshToken ? '✅' : '❌'}`);
    
    if (authStatus.authenticated) {
      console.log('\n🎉 MIGRATION SUCCESSFUL!');
      console.log('EmailService is now authenticated and ready to use.');
    } else {
      console.log('\n⚠️ Migration completed but authentication failed');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
migrateTokens();
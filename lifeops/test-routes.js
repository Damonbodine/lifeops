require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// Test basic endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Basic server working' });
});

// Try to load productivity routes
try {
  console.log('📦 Loading productivity routes...');
  const productivityRoutes = require('./routes/productivity');
  app.use('/api/productivity', productivityRoutes);
  console.log('✅ Productivity routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading productivity routes:', error.message);
  console.error('Stack:', error.stack);
}

const port = 3001;
app.listen(port, () => {
  console.log(`✅ Test server running on http://localhost:${port}`);
  console.log('Testing routes...');
  
  // Test basic endpoint
  setTimeout(() => {
    const http = require('http');
    
    http.get('http://localhost:3001/test', (res) => {
      console.log('✅ Basic endpoint working');
    }).on('error', (err) => {
      console.log('❌ Basic endpoint failed:', err.message);
    });
    
    // Test productivity health endpoint
    http.get('http://localhost:3001/api/productivity/health', (res) => {
      console.log('✅ Productivity health endpoint working');
      process.exit(0);
    }).on('error', (err) => {
      console.log('❌ Productivity health endpoint failed:', err.message);
      process.exit(1);
    });
  }, 1000);
});
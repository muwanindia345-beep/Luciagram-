const https = require('https');

const SERVICES = [
  'https://luciagram-backend.onrender.com',
];

const ping = () => {
  SERVICES.forEach(url => {
    https.get(url, (res) => {
      console.log(`✅ [${new Date().toLocaleTimeString()}] Pinged ${url} - Status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.log(`❌ [${new Date().toLocaleTimeString()}] Failed to ping ${url} - ${err.message}`);
    });
  });
};

// Ping every 5 minutes to prevent Render cold start + socket drops
ping();
setInterval(ping, 5 * 60 * 1000);

console.log('🤖 Luciagram Keep-Alive Bot started!');
console.log('⏰ Pinging every 5 minutes...');

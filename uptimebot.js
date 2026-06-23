const https = require('https');
const http = require('http');

class LuciagramUptimeBot {
  constructor() {
    this.services = [
      { name: 'Luciagram Backend', url: 'https://luciagram-production.up.railway.app', status: 'unknown' },
      { name: 'Luciagram Frontend', url: 'https://luciagram.onrender.com', status: 'unknown' },
    ];
    this.pingCount = 0;
    this.startTime = new Date();
    this.logs = [];
  }

  ping(service) {
    return new Promise((resolve) => {
      const start = Date.now();
      const client = service.url.startsWith('https') ? https : http;
      const req = client.get(service.url, (res) => {
        const responseTime = Date.now() - start;
        const status = res.statusCode === 200 ? 'UP' : 'DEGRADED';
        resolve({ status, responseTime, statusCode: res.statusCode });
      });
      req.on('error', () => {
        resolve({ status: 'DOWN', responseTime: 0, statusCode: 0 });
      });
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ status: 'TIMEOUT', responseTime: 10000, statusCode: 0 });
      });
    });
  }

  getUptime() {
    const diff = Date.now() - this.startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  }

  async pingAll() {
    this.pingCount++;
    const time = new Date().toLocaleTimeString();
    console.log(`\n🤖 [Ping #${this.pingCount}] ${time} | Bot Uptime: ${this.getUptime()}`);
    console.log('─'.repeat(50));

    for (const service of this.services) {
      const result = await this.ping(service);
      const prev = service.status;
      service.status = result.status;

      const icon = result.status === 'UP' ? '🟢' : result.status === 'DOWN' ? '🔴' : '🟡';
      console.log(`${icon} ${service.name}`);
      console.log(`   Status: ${result.status} | Response: ${result.responseTime}ms | Code: ${result.statusCode}`);

      if (prev !== 'unknown' && prev !== result.status) {
        if (result.status === 'DOWN') {
          console.log(`   ⚠️  ALERT: ${service.name} went DOWN!`);
        } else if (result.status === 'UP' && prev === 'DOWN') {
          console.log(`   ✅ RECOVERY: ${service.name} is back UP!`);
        }
      }

      this.logs.push({
        service: service.name,
        status: result.status,
        responseTime: result.responseTime,
        time: new Date().toISOString(),
      });

      if (this.logs.length > 100) this.logs.shift();
    }
  }

  getReport() {
    return {
      botUptime: this.getUptime(),
      pingCount: this.pingCount,
      services: this.services.map(s => ({
        name: s.name,
        status: s.status,
      })),
      recentLogs: this.logs.slice(-10),
    };
  }

  start() {
    console.log('🚀 Luciagram UptimeBot Started!');
    console.log('📡 Monitoring all services every 5 minutes');
    console.log('🔗 Services:');
    this.services.forEach(s => console.log(`   - ${s.name}: ${s.url}`));

    this.pingAll();
    setInterval(() => this.pingAll(), 5 * 60 * 1000);
  }
}

module.exports = LuciagramUptimeBot;

const http = require('http');

const url = process.env.HEALTH_URL || 'http://localhost:3000/health';

http
  .get(url, (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      console.log(`HTTP ${res.statusCode}`);
      console.log(data);
      process.exit(res.statusCode === 200 ? 0 : 1);
    });
  })
  .on('error', (err) => {
    console.error('Request failed:', err.message);
    process.exit(1);
  });


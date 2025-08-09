const http = require('http');

function testAPI(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing Service Management API...\n');
  
  try {
    // Test get services
    console.log('1. GET /api/queue/services');
    const servicesResult = await testAPI('/api/queue/services');
    console.log(`Status: ${servicesResult.status}`);
    console.log(`Response: ${servicesResult.data}\n`);
    
    // Test active service status
    console.log('2. GET /api/queue/services/active');
    const activeResult = await testAPI('/api/queue/services/active');
    console.log(`Status: ${activeResult.status}`);
    console.log(`Response: ${activeResult.data}\n`);
    
    // Test logs with service filtering
    console.log('3. GET /api/queue/logs?serviceId=dinochrome&limit=5');
    const logsResult = await testAPI('/api/queue/logs?serviceId=dinochrome&limit=5');
    console.log(`Status: ${logsResult.status}`);
    console.log(`Response: ${logsResult.data}\n`);
    
    // Test service stats
    console.log('4. GET /api/queue/services/stats');
    const statsResult = await testAPI('/api/queue/services/stats');
    console.log(`Status: ${statsResult.status}`);
    console.log(`Response: ${statsResult.data}\n`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests();
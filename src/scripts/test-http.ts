import http from 'http';
import { createHmac } from 'crypto';

// Create a test JWT token for user 1
function createTestJWT() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = Buffer.from(JSON.stringify({ userId: 1, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signature = createHmac('sha256', 'test-secret').update(`${header}.${payload}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${payload}.${signature}`;
}

function makeRequest(path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function test() {
  console.log('🧪 Testing /api/day endpoints...\n');

  const token = createTestJWT();

  // Test 3 dates
  const dates = ['2026-03-21', '2026-03-22', '2026-03-23'];

  for (const date of dates) {
    console.log(`\n📅 Testing ${date}:`);
    try {
      const result = await makeRequest(`/api/day/${date}`, token);

      if (result.error) {
        console.log(`  ❌ Error: ${result.error}`);
      } else {
        const entry = result.entry ? '✅' : '❌';
        const msgs = result.messages?.length || 0;
        const habits = result.habits?.length || 0;
        const goals = result.goals?.length || 0;

        console.log(`  Entry: ${entry}`);
        console.log(`  Messages: ${msgs}`);
        console.log(`  Habits: ${habits}`);
        console.log(`  Goals: ${goals}`);

        if (result.entry) {
          console.log(`  Mood: ${result.entry.mood}, Energy: ${result.entry.energyLevel}`);
        }
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err}`);
    }
  }

  process.exit(0);
}

test().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

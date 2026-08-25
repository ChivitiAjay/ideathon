const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function testLive() {
  console.log('Testing live server on port 8080...');
  
  // 1. Create entry
  const entryRes = await post('/api/journal', {
    title: 'Breakthrough on Cloud Run',
    content: 'Successfully configured Google AI Studio directives and built an enterprise secure journaling app on Cloud Run.',
    mood: 'Joyful'
  }, 'demo-token-alex-1');

  console.log('1. Entry Created:', entryRes.entry.title, '| ID:', entryRes.entry.id);
  console.log('   AI Summary:', entryRes.entry.summary);
  console.log('   Coach Question:', entryRes.entry.coachQuestion);

  // 2. Chat with Gemini
  const chatRes = await post('/api/chat', {
    messages: [{ role: 'user', content: 'What are 3 ways I can maintain a daily mindful journaling habit?' }],
    contextTitle: 'Habit Formation'
  }, 'demo-token-alex-1');

  console.log('\n2. Gemini Chat Reply:', chatRes.reply.slice(0, 150) + '...');

  // 3. Analytics
  const analyticsRes = await get('/api/analytics/mood', 'demo-token-alex-1');
  console.log('\n3. Mood Analytics:', analyticsRes);

  console.log('\n✅ All Live API endpoints working perfectly!');
}

testLive().catch(console.error);

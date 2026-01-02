const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: body ? JSON.parse(body) : {} }));
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function verify() {
    console.log('Starting verification...');

    // 1. Test Login
    console.log('\n--- Testing Login ---');
    const loginRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'admin123' });

    console.log('Login Status:', loginRes.statusCode);
    if (loginRes.statusCode !== 200) {
        console.error('Login failed:', loginRes.body);
        process.exit(1);
    }
    const token = loginRes.body.token;
    console.log('Token received');

    // 2. Test Create Appointment
    console.log('\n--- Testing Create Appointment ---');
    const apptData = {
        name: "Test Patient",
        email: "test@example.com",
        phone: "1234567890",
        date: "2026-01-10",
        time: "10:00",
        service: "musculoskeletal",
        notes: "Test notes"
    };

    const createRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/appointments',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, apptData);

    console.log('Create Appointment Status:', createRes.statusCode);
    if (createRes.statusCode !== 201) {
        console.error('Create failed:', createRes.body);
    } else {
        console.log('Appointment created, check server logs for notifications.');
    }

    // 3. Test Get Appointments (Admin)
    console.log('\n--- Testing Get Appointments (Admin) ---');
    const getRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/appointments',
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${token}`
        }
    });

    console.log('Get Appointments Status:', getRes.statusCode);
    console.log('Appointments count:', Array.isArray(getRes.body) ? getRes.body.length : 'Error');

    console.log('\nVerification Complete.');
}

// Wait for server to start
setTimeout(verify, 3000);

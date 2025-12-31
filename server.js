const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false
}));
app.use(express.json());

const BASE_URL = 'https://api.kushal.kimbal.io';

// Route: Login proxy (Using Env Variables)
app.post('/api/login', async (req, res) => {
    try {
        const response = await fetch(`${BASE_URL}/api/TokenAuth/Authenticate`, {
            method: 'POST',
            headers: {
                'accept': 'text/plain',
                'Content-Type': 'application/json-patch+json',
                'Abp.TenantId': process.env.KIMBAL_TENANT_ID || '1'
            },
            body: JSON.stringify({
                userNameOrEmailAddress: process.env.KIMBAL_API_USER,
                password: process.env.KIMBAL_API_PASS,
                rememberClient: false
            })
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        console.error('Login proxy error:', err);
        res.status(500).send('Failed to reach auth server');
    }
});

// Route: Get All Clients
app.get('/api/clients', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).send('Unauthorized');

    try {
        const response = await fetch(`${BASE_URL}/client/api/v1/Client/GetAll`, {
            headers: { Authorization: token }
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('GetClients error:', err);
        res.status(500).send('Failed to fetch clients');
    }
});

// Route: Get MO Numbers By Client
app.get('/api/mo-numbers', async (req, res) => {
    const { clientId } = req.query;
    const token = req.headers.authorization;

    if (!token) return res.status(401).send('Unauthorized');
    if (!clientId) return res.status(400).send('ClientId required');

    try {
        const url = `${BASE_URL}/meterreport/api/v1/MeterReportService/GetMONumbersByClient?Id=${clientId}`;
        const response = await fetch(url, {
            headers: { Authorization: token }
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('GetMONumbers error:', err);
        res.status(500).send('Failed to fetch MO numbers');
    }
});

const PORT = 5001;
app.listen(PORT, () => {
    console.log(`✅ Proxy server running at http://localhost:${PORT}`);
});

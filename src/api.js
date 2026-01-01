// API Configuration
// Frontend will use this to make requests to the backend

const API_CONFIG = {
    // Backend proxy URL - production mein naya backend use karega
    BACKEND_URL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000',
    
    // API endpoints
    LOGIN: '/api/loginV2',
    CLIENTS: '/api/clients',           // ← Yeh public API clients ke liye
    MOBY_CLIENTS: '/api/mobyclients',
};

// Fetch wrapper with auth token
export const fetchWithAuth = async (endpoint, options = {}) => {
    const token = localStorage.getItem('authToken');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_CONFIG.BACKEND_URL}${endpoint}`, {
        ...options,
        headers,
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    
    return response.json();
};

// Login function
export const login = async (userNameOrEmailAddress, password) => {
    const response = await fetch(`${API_CONFIG.BACKEND_URL}${API_CONFIG.LOGIN}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'text/plain'
        },
        body: JSON.stringify({
            userNameOrEmailAddress,
            password,
            rememberClient: false
        }),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Login failed: ${response.status} - ${errorText}`);
    }
    
    return response.json();
};

// Get all main clients (PUBLIC API - recommended)
export const getClients = async () => {
    return fetchWithAuth(`${API_CONFIG.CLIENTS}?skipCount=0&maxResultCount=1000`);
};

// Get all moby clients
export const getMobyClients = async () => {
    return fetchWithAuth(API_CONFIG.MOBY_CLIENTS);
};

// Get single client
export const getClient = async (id) => {
    return fetchWithAuth(`${API_CONFIG.CLIENTS}/${id}`);
};

// PROXY: Get meter reports (MO numbers) for a client
export const getMeterReportsByClient = async (clientId) => {
    if (!clientId) {
        throw new Error('Client ID is required');
    }
    return fetchWithAuth(`/proxy/meter-reports/${clientId}`);
};

// Optional: agar future mein proxy wala use karna ho toh rakh lo
// export const getProxyClients = async () => {
//     return fetchWithAuth('/proxy/clients');
// };

export default API_CONFIG;
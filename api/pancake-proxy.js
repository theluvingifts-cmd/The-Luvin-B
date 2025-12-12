
export default async function handler(req, res) {
    // 1. CORS Headers to allow your frontend to call this function
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { endpoint, method, payload } = req.body;

    if (!endpoint) {
        return res.status(400).json({ error: 'Missing endpoint' });
    }

    try {
        console.log(`Proxying ${method || 'POST'} to: ${endpoint}`);

        // 2. Forward request to Pancake
        const response = await fetch(endpoint, {
            method: method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Fake User-Agent to look like a browser or legitimate client
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://pos.pancake.vn', // Trick Pancake into thinking request comes from their domain
                'Referer': 'https://pos.pancake.vn/'
            },
            body: payload ? JSON.stringify(payload) : undefined
        });

        // 3. Handle response
        const data = await response.json();
        
        // Forward the status code from Pancake
        return res.status(response.status).json(data);

    } catch (error) {
        console.error('Pancake Proxy Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal Server Error' 
        });
    }
}

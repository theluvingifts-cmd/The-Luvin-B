
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, chatId, text } = req.body;

    if (!token || !chatId || !text) {
        return res.status(400).json({ error: 'Missing required parameters (token, chatId, text)' });
    }

    try {
        const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML', // Allows bold/italic styling
            }),
        });

        const data = await response.json();

        if (data.ok) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(500).json({ error: data.description });
        }
    } catch (error) {
        console.error('Telegram API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

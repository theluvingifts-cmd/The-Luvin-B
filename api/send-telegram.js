
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, chatId, text, photoUrl } = req.body;

    if (!token || !chatId || !text) {
        return res.status(400).json({ error: 'Missing required parameters (token, chatId, text)' });
    }

    try {
        // Nếu có photoUrl, sử dụng sendPhoto, ngược lại dùng sendMessage
        const method = photoUrl ? 'sendPhoto' : 'sendMessage';
        const telegramUrl = `https://api.telegram.org/bot${token}/${method}`;
        
        const payload = photoUrl 
            ? {
                chat_id: chatId,
                photo: photoUrl,
                caption: text, // Tin nhắn sẽ trở thành chú thích cho ảnh
                parse_mode: 'HTML'
              }
            : {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
              };

        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (data.ok) {
            return res.status(200).json({ success: true });
        } else {
            // Log lỗi từ Telegram để debug nếu cần
            console.error('Telegram API Error Details:', data);
            return res.status(500).json({ error: data.description });
        }
    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

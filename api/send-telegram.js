
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, chatId, text, photoUrl } = req.body;

    if (!token || !chatId || !text) {
        return res.status(400).json({ error: 'Missing required parameters (token, chatId, text)' });
    }

    // Helper to validate if photoUrl is a valid public absolute URL that Telegram can access
    const isValidPublicUrl = (url) => {
        if (!url || typeof url !== 'string') return false;
        const normalized = url.trim().toLowerCase();
        // Must start with http:// or https://
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) return false;
        // Exclude localhost/local IPs which are unreachable by Telegram's external servers
        if (normalized.includes('localhost') || normalized.includes('127.0.0.1') || normalized.includes('0.0.0.0')) return false;
        return true;
    };

    const canSendPhoto = isValidPublicUrl(photoUrl);

    try {
        const method = canSendPhoto ? 'sendPhoto' : 'sendMessage';
        const telegramUrl = `https://api.telegram.org/bot${token}/${method}`;
        
        const payload = canSendPhoto 
            ? {
                chat_id: chatId,
                photo: photoUrl.trim(),
                caption: text, // Tin nhắn sẽ trở thành chú thích cho ảnh
                parse_mode: 'HTML'
              }
            : {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
              };

        let response = await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        let data = await response.json();

        // FALLBACK 1: If sendPhoto failed, automatically fall back to text message
        if (!data.ok && method === 'sendPhoto') {
            console.warn('Telegram sendPhoto failed, falling back to sendMessage. Reason:', data.description || 'Unknown');
            
            // Append the image URL so the shop owner can still click and see it
            const fallbackText = `${text}\n\n🖼️ <b>Link ảnh thiết kế:</b> <a href="${photoUrl}">${photoUrl}</a>`;
            const fallbackPayload = {
                chat_id: chatId,
                text: fallbackText,
                parse_mode: 'HTML'
            };
            const fallbackUrl = `https://api.telegram.org/bot${token}/sendMessage`;

            response = await fetch(fallbackUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(fallbackPayload),
            });
            data = await response.json();
        }

        // FALLBACK 2: If HTML delivery still failed, send as pure PLAIN TEXT (no parse_mode) to ensure delivery at all costs!
        if (!data.ok) {
            console.warn('Telegram HTML delivery failed, falling back to PLAIN TEXT. Reason:', data.description || 'Unknown');
            
            // Strip HTML tags for clean plain text, and append photoUrl if available
            const plainText = text.replace(/<[^>]+>/g, '') + (photoUrl ? `\n\n[Image URL]: ${photoUrl}` : '');
            const plainPayload = {
                chat_id: chatId,
                text: plainText
            };
            const plainUrl = `https://api.telegram.org/bot${token}/sendMessage`;

            response = await fetch(plainUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(plainPayload),
            });
            data = await response.json();
        }

        if (data.ok) {
            return res.status(200).json({ success: true, method_used: data.result?.photo ? 'sendPhoto' : 'sendMessage' });
        } else {
            console.error('Telegram API Error Details:', data);
            return res.status(500).json({ error: data.description });
        }
    } catch (error) {
        console.error('Server Error in Telegram Route:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

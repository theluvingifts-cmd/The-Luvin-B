// api/send-email.js
import nodemailer from 'nodemailer';

// Cấu hình tài khoản gửi mail (Nên dùng biến môi trường, nhưng hardcode tạm để test)
// SAU NÀY NÊN ĐƯA VÀO FILE .env ĐỂ BẢO MẬT
const EMAIL_USER = "theluvin.gifts@gmail.com"; // Thay bằng email của bạn
const EMAIL_PASS = "issa rseg memb fhoa";      // Thay bằng Mật khẩu ứng dụng 16 ký tự bạn vừa lấy

export default async function handler(req, res) {
    // Chỉ chấp nhận method POST
    if (req.method !== 'POST') {
        return res.status(405).send({ message: 'Only POST requests allowed' });
    }

    const { to_name, to_email, order_id, total_price, address, items_list, type = 'confirmation' } = req.body;

    // Tạo transporter (người vận chuyển)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
    });

    let mailOptions;

    if (type === 'thank_you') {
        mailOptions = {
            from: `"The Luvin" <${EMAIL_USER}>`,
            to: to_email,
            subject: `Cảm ơn bạn đã tin chọn món quà từ The Luvin! - Đơn #GP${order_id.slice(-5).toUpperCase()}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
                    <h2 style="color: #e63946;">Chào ${to_name} thân mến,</h2>
                    <p>Món quà ý nghĩa của bạn đã được giao đến nơi an toàn! The Luvin xin gửi lời cảm ơn chân thành nhất vì bạn đã tin tưởng để chúng mình đồng hành trong nhịp cầu gửi gắm yêu thương.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>📦 Thông tin đơn hàng:</strong> #GP${order_id.slice(-5).toUpperCase()}</p>
                        <p style="margin: 0;">Nếu có bất kỳ thắc mắc nào về sản phẩm, đừng ngần ngại nhắn tin cho The Luvin nhé!</p>
                    </div>

                    <h3 style="color: #1d3557;">🎁 Bạn có muốn lan tỏa yêu thương và nhận thêm thu nhập?</h3>
                    <p>The Luvin đang tìm kiếm những người bạn đồng hành trong chương trình <strong>Cộng tác viên (Affiliate)</strong>:</p>
                    <ul style="padding-left: 20px;">
                        <li>Hoa hồng hấp dẫn trên mỗi đơn hàng thành công.</li>
                        <li>Được hỗ trợ hình ảnh, tư vấn miễn phí.</li>
                        <li>Không cần ôm hàng, không rủi ro.</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://theluvin.gifts/ctv" style="background-color: #e63946; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Đăng ký Cộng tác viên ngay</a>
                    </div>

                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #777;">
                        The Luvin - Personalized Lego Frame Gifts<br>
                        Hotline: 0968 432 043 - 0345 126 019<br>
                        Website: <a href="https://theluvin.gifts">theluvin.gifts</a>
                    </p>
                </div>
            `
        };
    } else {
        // Nội dung email mặc định (Xác nhận đơn hàng)
        mailOptions = {
            from: `"The Luvin" <${EMAIL_USER}>`,
            to: to_email,
            subject: `Xác nhận đơn hàng ${order_id} - The Luvin`,
            text: `
Xin chào ${to_name},

Cảm ơn bạn đã đặt hàng tại The Luvin! Đơn hàng của bạn đã được ghi nhận.

📦 Mã đơn hàng: ${order_id}
💰 Tổng tiền: ${total_price}
📍 Địa chỉ nhận: ${address}

Chi tiết sản phẩm:
${items_list}

-------------------------
Chúng tôi sẽ sớm liên hệ để xác nhận và giao hàng.
Hotline: 0968 432 043 - 0345 126 019
            `,
        };
    }

    try {
        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
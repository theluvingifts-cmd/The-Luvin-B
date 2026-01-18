
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Khởi tạo client Gemini. 
 * process.env.API_KEY sẽ được lấy trực tiếp từ môi trường thực thi của trình duyệt/nền tảng 
 * mà không bị lộ trong mã nguồn tĩnh sau khi build.
 */
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface VerificationResult {
    isMatch: boolean;
    detectedAmount: number;
    detectedContent: string;
    reason: string;
}

/**
 * Sử dụng Gemini 3 Flash để quét ảnh biên lai và xác thực thanh toán
 */
export const verifyPaymentProof = async (base64Image: string, expectedAmount: number, orderId: string): Promise<VerificationResult> => {
    try {
        const imageData = base64Image.split(',')[1] || base64Image;
        
        const prompt = `
            Phân tích ảnh biên lai chuyển khoản ngân hàng này.
            Số tiền cần khớp: ${expectedAmount}
            Nội dung cần khớp: ${orderId}
            
            Quy tắc xác nhận:
            - is_match = true nếu số tiền khớp 100%.
            - Nếu không thấy nội dung chuyển khoản nhưng số tiền khớp hoàn toàn, vẫn đặt is_match = true.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: "image/png",
                                data: imageData
                            }
                        }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        amount_found: { type: Type.NUMBER },
                        content_found: { type: Type.STRING },
                        is_match: { type: Type.BOOLEAN },
                        reason: { type: Type.STRING }
                    },
                    required: ["amount_found", "content_found", "is_match", "reason"]
                }
            }
        });

        const result = JSON.parse(response.text || "{}");

        return {
            isMatch: result.is_match,
            detectedAmount: result.amount_found,
            detectedContent: result.content_found,
            reason: result.reason
        };
    } catch (error) {
        console.error("AI Verification Error:", error);
        return {
            isMatch: false,
            detectedAmount: 0,
            detectedContent: '',
            reason: "Không thể kết nối với dịch vụ xác thực AI."
        };
    }
};

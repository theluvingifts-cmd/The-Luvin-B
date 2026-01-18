
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface VerificationResult {
    isMatch: boolean;
    detectedAmount: number;
    detectedContent: string;
    confidence: number;
    reason: string;
}

/**
 * Sử dụng Gemini 3 Flash để quét ảnh biên lai và xác thực thanh toán
 */
export const verifyPaymentProof = async (base64Image: string, expectedAmount: number, orderId: string): Promise<VerificationResult> => {
    try {
        // Chuẩn bị dữ liệu hình ảnh (loại bỏ header base64 nếu có)
        const imageData = base64Image.split(',')[1] || base64Image;
        
        const prompt = `
            Analyze this bank transfer receipt image. 
            Extract:
            1. Total amount transferred (number only).
            2. Transaction description/content (string).
            
            Compare with expected values:
            - Target Amount: ${expectedAmount}
            - Target Order ID: ${orderId}
            
            Return a JSON object with:
            - "amount_found": number,
            - "content_found": string,
            - "is_match": boolean (true if amount equals expectedAmount AND content contains orderId),
            - "reason": string (brief explanation in Vietnamese)
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
            confidence: 1, // Gemini 3 Flash is very reliable for this
            reason: result.reason
        };
    } catch (error) {
        console.error("AI Verification Error:", error);
        return {
            isMatch: false,
            detectedAmount: 0,
            detectedContent: '',
            confidence: 0,
            reason: "Lỗi kết nối AI xác thực."
        };
    }
};

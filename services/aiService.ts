
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
 * Logic mới: Ưu tiên số tiền, nếu nội dung bị thiếu vẫn có thể xác nhận nếu số tiền khớp 100%.
 */
export const verifyPaymentProof = async (base64Image: string, expectedAmount: number, orderId: string): Promise<VerificationResult> => {
    try {
        const imageData = base64Image.split(',')[1] || base64Image;
        
        const prompt = `
            Analyze this bank transfer receipt image. 
            Required Information:
            1. Total amount transferred (look for large numbers near 'VND' or 'Số tiền').
            2. Transaction description/content (look for '${orderId}' or similar text).
            
            Strict Matching Rules:
            - Target Amount: ${expectedAmount}
            - Target Order ID: ${orderId}
            
            Decision Logic:
            - If Amount found equals Target Amount AND Content contains Target Order ID -> set is_match = true.
            - If Amount found equals Target Amount BUT Content is NOT VISIBLE (some bank apps hide it) -> set is_match = true (Flex confirmation).
            - If Amount does not match -> set is_match = false.
            
            Return a JSON object:
            {
                "amount_found": number,
                "content_found": "string or empty",
                "is_match": boolean,
                "reason": "Giải thích ngắn gọn bằng tiếng Việt"
            }
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
            confidence: 1,
            reason: result.reason
        };
    } catch (error) {
        console.error("AI Verification Error:", error);
        return {
            isMatch: false,
            detectedAmount: 0,
            detectedContent: '',
            confidence: 0,
            reason: "Không thể quét được thông tin từ ảnh này."
        };
    }
};

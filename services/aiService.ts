
import { GoogleGenAI, Type } from "@google/genai";
import { FrameConfig, TextConfig, DraggableItem, LegoCharacterConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * AI Service to magically arrange items in the frame
 */
export const suggestSmartLayout = async (config: FrameConfig): Promise<Partial<FrameConfig> | null> => {
  try {
    const prompt = `
      You are a professional graphic designer. Your task is to arrange items in a LEGO frame (100x100 coordinate system).
      
      Current items:
      - Characters: ${config.characters.length}
      - Texts: ${config.texts.map(t => `ID:${t.id}, Content:"${t.content}", Role:"${t.linkedFieldId || 'general'}"`).join('; ')}
      - Accessories/Items: ${config.draggableItems.map(i => `ID:${i.id}, Type:${i.type}`).join('; ')}
      
      Rules for layout:
      1. Center 'names' text at the top (y: 15-25) with larger scale (1.5 - 2.0).
      2. Align Characters horizontally in the center-lower area (y: 65-75). If multiple characters, spread them evenly (x: 20 to 80).
      3. Place 'message' text at the bottom (y: 85-92) with smaller scale (0.8 - 1.0).
      4. Scatter Accessories naturally near characters or at corners.
      5. Shapes should be used as decorative borders or backgrounds (centered).
      
      Output ONLY a JSON object with updated coordinates (x, y, rotation, scale, width) for each item ID.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error("AI Layout Error:", error);
    return null;
  }
};

/**
 * Chatbot Service for Customer Consultation
 */
export const chatWithLuvinBot = async (
    message: string, 
    history: { role: 'user' | 'model', parts: { text: string }[] }[],
    instruction: string,
    examples?: { question: string, answer: string }[]
) => {
    try {
        // Xây dựng System Instruction bao gồm cả ví dụ mẫu (Few-shot)
        let fullInstruction = instruction;
        if (examples && examples.length > 0) {
            fullInstruction += "\n\nDưới đây là một số ví dụ về cách trả lời chuẩn mực mà bạn PHẢI học theo:\n";
            examples.forEach(ex => {
                fullInstruction += `Khách: "${ex.question}" -> Bot: "${ex.answer}"\n`;
            });
        }
        
        fullInstruction += "\nLƯU Ý: Nếu khách hỏi điều gì bạn không biết chắc chắn, tuyệt đối không tự bịa ra giá hay chính sách. Hãy bảo khách chờ một chút để nhân viên thật hỗ trợ.";

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [...history, { role: 'user', parts: [{ text: message }] }],
            config: {
                systemInstruction: fullInstruction,
                temperature: 0.5, // Giảm temperature để AI trả lời ổn định, ít "bay bổng" hơn
                maxOutputTokens: 800,
            }
        });
        return response.text;
    } catch (error) {
        console.error("Chatbot Error:", error);
        return "Xin lỗi Luviner, mình đang bận một chút. Bạn nhắn tin qua Zalo 0964 393 115 để mình hỗ trợ ngay nhé!";
    }
};

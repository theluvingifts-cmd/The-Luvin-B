
import React, { useState, useEffect, useRef } from 'react';
import { StoreConfig, updateStoreConfig, ChatExample } from '../../services/configService';
import { chatWithLuvinBot } from '../../services/aiService';

export const AdminChatbot: React.FC<{ storeConfig: StoreConfig }> = ({ storeConfig }) => {
    const [isEnabled, setIsEnabled] = useState(storeConfig.chatbotEnabled || false);
    const [instruction, setInstruction] = useState(storeConfig.chatbotInstruction || "");
    const [welcomeMsg, setWelcomeMsg] = useState(storeConfig.chatbotWelcomeMessage || "");
    const [examples, setExamples] = useState<ChatExample[]>(storeConfig.chatbotExamples || []);
    const [isSaving, setIsSaving] = useState(false);

    // New Example Form State
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswer, setNewAnswer] = useState('');

    // Sandbox state
    const [testMessages, setTestMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [testInput, setTestInput] = useState('');
    const [isBotTyping, setIsBotTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const handleSave = async () => {
        setIsSaving(true);
        const success = await updateStoreConfig({
            chatbotEnabled: isEnabled,
            chatbotInstruction: instruction,
            chatbotWelcomeMessage: welcomeMsg,
            chatbotExamples: examples
        });
        if (success) alert("Đã cập nhật cấu hình và bộ ví dụ Chatbot!");
        setIsSaving(false);
    };

    const handleAddExample = () => {
        if (!newQuestion.trim() || !newAnswer.trim()) return;
        setExamples([...examples, { question: newQuestion.trim(), answer: newAnswer.trim() }]);
        setNewQuestion('');
        setNewAnswer('');
    };

    const handleRemoveExample = (index: number) => {
        setExamples(examples.filter((_, i) => i !== index));
    };

    const handleTestSend = async () => {
        if (!testInput.trim() || isBotTyping) return;
        const msg = testInput.trim();
        setTestInput('');
        setTestMessages(prev => [...prev, { role: 'user', text: msg }]);
        setIsBotTyping(true);

        const history = testMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        const response = await chatWithLuvinBot(msg, history, instruction, examples);

        setTestMessages(prev => [...prev, { role: 'model', text: response || "" }]);
        setIsBotTyping(false);
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [testMessages, isBotTyping]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in items-start">
            {/* Left: Configuration & Examples */}
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Cấu hình chung</h3>
                            <p className="text-xs text-gray-400 mt-1">Bật/tắt và thiết lập tính cách cho Bot</p>
                        </div>
                        <button 
                            onClick={() => setIsEnabled(!isEnabled)}
                            className={`w-14 h-7 rounded-full p-1 transition-colors ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-7' : ''}`}></div>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-2">Lời chào mặc định</label>
                            <input 
                                className="w-full p-3 border rounded-xl bg-gray-50 text-sm" 
                                value={welcomeMsg} 
                                onChange={e => setWelcomeMsg(e.target.value)}
                                placeholder="Chào Luviner!..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-2">Tính cách & Quy tắc (Instruction)</label>
                            <textarea 
                                className="w-full p-4 border rounded-xl bg-gray-50 text-sm font-medium leading-relaxed h-[150px] focus:bg-white transition-all outline-none" 
                                value={instruction}
                                onChange={e => setInstruction(e.target.value)}
                                placeholder="Bạn là trợ lý The Luvin, phong cách nhẹ nhàng..."
                            />
                        </div>
                    </div>
                </div>

                {/* AI Examples Section - THE "TEACHING" PART */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Dạy AI qua ví dụ (Vô cùng quan trọng)</h3>
                        <p className="text-xs text-gray-400 mt-1">Đưa ra các tình huống thực tế để AI bắt chước tông giọng của bạn</p>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                            <input 
                                placeholder="Câu hỏi khách hay hỏi..." 
                                className="w-full p-2.5 border rounded-lg text-sm"
                                value={newQuestion}
                                onChange={e => setNewQuestion(e.target.value)}
                            />
                            <textarea 
                                placeholder="Cách bạn muốn Bot trả lời (câu trả lời chuẩn mực)..." 
                                className="w-full p-2.5 border rounded-lg text-sm"
                                rows={2}
                                value={newAnswer}
                                onChange={e => setNewAnswer(e.target.value)}
                            />
                            <button 
                                onClick={handleAddExample}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                            >
                                + THÊM VÍ DỤ NÀY
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {examples.map((ex, idx) => (
                                <div key={idx} className="p-3 border rounded-xl bg-white relative group hover:border-blue-200 transition-colors">
                                    <button 
                                        onClick={() => handleRemoveExample(idx)}
                                        className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Ví dụ {idx + 1}</p>
                                    <p className="text-xs font-bold text-gray-700 italic">Q: {ex.question}</p>
                                    <p className="text-xs text-gray-600 mt-1">A: {ex.answer}</p>
                                </div>
                            ))}
                            {examples.length === 0 && <p className="text-center py-6 text-gray-400 text-xs italic">Chưa có ví dụ mẫu nào.</p>}
                        </div>
                    </div>

                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-gray-900 text-white py-4 rounded-xl font-black shadow-lg hover:bg-black disabled:opacity-50 transition-all active:scale-95"
                    >
                        {isSaving ? "ĐANG LƯU..." : "CẬP NHẬT TẤT CẢ KIẾN THỨC"}
                    </button>
                </div>
            </div>

            {/* Right: Sandbox Testing */}
            <div className="bg-gray-900 rounded-[2.5rem] p-4 flex flex-col h-[750px] shadow-2xl relative overflow-hidden lg:sticky lg:top-24">
                <div className="flex items-center gap-3 p-4 border-b border-gray-800 relative z-20">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-xl animate-pulse">🧪</div>
                    <div>
                        <h4 className="text-white font-bold text-sm">Sandbox (Thử nghiệm)</h4>
                        <p className="text-[10px] text-gray-500 uppercase font-black">Test Bot với các ví dụ vừa thêm</p>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {testMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'}`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {isBotTyping && <div className="text-[10px] text-blue-400 font-bold animate-pulse px-2">AI đang suy nghĩ dựa trên kiến thức bạn dạy...</div>}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-gray-800/50 rounded-3xl mt-2 flex gap-2">
                    <input 
                        className="flex-grow bg-transparent border-none text-white text-sm focus:ring-0 outline-none p-2" 
                        placeholder="Thử hỏi AI..."
                        value={testInput}
                        onChange={e => setTestInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleTestSend()}
                    />
                    <button onClick={handleTestSend} className="bg-white text-black px-4 py-2 rounded-2xl font-bold text-xs hover:bg-blue-400 hover:text-white transition-all">GỬI</button>
                </div>
            </div>
        </div>
    );
};

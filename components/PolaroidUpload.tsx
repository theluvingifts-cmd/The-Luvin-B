
import React, { useState, useRef } from 'react';
import { useLanguage } from '../src/contexts/LanguageContext';
import { uploadFile } from '../services/uploadService';
import { motion, AnimatePresence } from 'motion/react';

interface PolaroidUploadProps {
    count: number;
    images: string[];
    onImagesChange: (images: string[]) => void;
}

const PolaroidUpload: React.FC<PolaroidUploadProps> = ({ count, images, onImagesChange }) => {
    const { t } = useLanguage();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList) as File[];
        const remainingCount = count - images.length;
        const filesToUpload = files.slice(0, remainingCount);

        if (files.length > remainingCount) {
            alert(t('checkout.polaroid_upload_limit', { count }));
        }

        setIsUploading(true);
        const newImages = [...images];

        for (const file of filesToUpload) {
            // Validation: Size < 5MB
            if (file.size > 5 * 1024 * 1024) {
                alert(t('checkout.polaroid_upload_error_size', { name: file.name }));
                continue;
            }

            const url = await uploadFile(file, 'polaroids');
            if (url) {
                newImages.push(url);
            }
        }

        onImagesChange(newImages);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeImage = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        onImagesChange(newImages);
    };

    return (
        <div className="mt-3.5 space-y-2 animate-fade-in px-0.5 pt-3 border-t border-gray-100">
            <div className="flex flex-col gap-0.5 mb-2 px-1">
                <span className="text-[12px] font-bold text-gray-800 tracking-tight">{t('checkout.polaroid_upload_title')} <span className="text-luvin-pink bg-pink-50 px-1.5 py-0.5 rounded-md ml-1">({images.length}/{count})</span></span>
                <p className="text-[9px] text-gray-400 italic font-medium leading-tight mt-0.5">{t('checkout.polaroid_upload_note')}</p>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
                <AnimatePresence>
                    {images.map((url, idx) => (
                        <motion.div 
                            key={`${url}-${idx}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="relative aspect-[3/4] bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm group"
                        >
                            <img src={url} alt={`Polaroid ${idx + 1}`} className="w-full h-full object-cover" />
                            <button 
                                type="button"
                                onClick={() => removeImage(idx)}
                                className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-sm"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </motion.div>
                    ))}
                    
                    {images.length < count && (
                        <motion.button
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className={`aspect-[3/4] border border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1.5 hover:border-luvin-pink hover:bg-pink-50 transition-all text-gray-300 group ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isUploading ? (
                                <div className="w-4 h-4 border-2 border-luvin-pink border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-pink-100 group-hover:text-luvin-pink transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <span className="text-[8px] font-black uppercase tracking-tight text-gray-400 group-hover:text-luvin-pink">{t('checkout.polaroid_upload_placeholder')}</span>
                                </>
                            )}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                multiple 
                accept="image/*" 
            />
        </div>
    );
};

export default PolaroidUpload;

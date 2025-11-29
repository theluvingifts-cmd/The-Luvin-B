
// services/uploadService.ts

// --- CẤU HÌNH CLOUDINARY ---
const CLOUD_NAME = "dbdqd93km"; 
// QUAN TRỌNG: Bạn cần tạo Upload Preset tên là "the-luvin-preset" và chọn chế độ "Unsigned" trong Settings > Upload của Cloudinary
const UPLOAD_PRESET = "the-luvin-preset"; 

export const uploadToCloudinary = async (file: File | string): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
        // Sử dụng resource_type = 'auto' để Cloudinary tự nhận diện là image, video, hay raw (font file)
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Cloudinary error:", errorData);
            throw new Error(errorData.error?.message || "Upload failed");
        }

        const data = await response.json();
        return data.secure_url; // Trả về đường dẫn HTTPS
    } catch (error) {
        console.error("Lỗi upload file:", error);
        return null;
    }
};


import { LegoPart, FrameOption, PresetBackground } from '../types';
import { getEffectivePrice, formatCurrency } from './pricing';

/**
 * Chuyển đổi mảng đối tượng thành chuỗi CSV chuẩn
 */
const convertToCSV = (headers: string[], rows: any[][]) => {
    const csvContent = [
        headers.join(','),
        ...rows.map(row => 
            row.map(cell => {
                const str = String(cell || '').replace(/"/g, '""'); // Thoát dấu nháy kép
                return `"${str}"`; // Bao bọc bằng nháy kép để xử lý dấu phẩy trong dữ liệu
            }).join(',')
        )
    ].join('\n');

    // Thêm BOM để Excel nhận diện được font tiếng Việt (UTF-8)
    return '\uFEFF' + csvContent;
};

/**
 * Xuất file Catalog tổng hợp
 */
export const exportCatalogToCSV = (
    products: LegoPart[], 
    frames: FrameOption[], 
    backgrounds: PresetBackground[]
) => {
    const headers = ['Loại sản phẩm', 'Tên sản phẩm', 'Giá bán lẻ (VNĐ)', 'Tồn kho', 'Mô tả/Kích thước', 'Link ảnh xem mẫu'];
    
    const rows: any[][] = [];

    // 1. Thêm Khung
    frames.forEach(f => {
        rows.push([
            'Khung Tranh',
            f.name,
            getEffectivePrice(f),
            f.stock,
            `${f.frameWidthCm}x${f.frameHeightCm}cm - ${f.description}`,
            f.imageUrl
        ]);
    });

    // 2. Thêm Linh kiện Lego
    const typeMap: Record<string, string> = {
        'hair': 'Tóc', 'face': 'Khuôn mặt', 'shirt': 'Trang phục', 
        'pants': 'Quần', 'hat': 'Mũ', 'accessory': 'Phụ kiện', 
        'pet': 'Thú cưng', 'set': 'Bộ Vest'
    };

    products.forEach(p => {
        rows.push([
            `Lego: ${typeMap[p.type] || p.type}`,
            p.name,
            getEffectivePrice(p),
            p.stock ?? 'Vô hạn',
            p.category || '',
            p.imageUrl
        ]);
    });

    // 3. Thêm Background
    backgrounds.forEach(bg => {
        rows.push([
            'Nền (Background)',
            bg.name,
            'Đã bao gồm trong khung',
            'Sẵn có',
            `${bg.type === 'square' ? 'Vuông' : 'Chữ nhật'} - ${bg.category}`,
            bg.url
        ]);
    });

    const csvData = convertToCSV(headers, rows);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const fileName = `TheLuvin_Catalog_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

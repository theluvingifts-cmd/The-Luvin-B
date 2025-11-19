import type { FrameOption, LegoPart, FrameConfig, OutfitColor, Order } from './types';


export const FRAME_OPTIONS: FrameOption[] = [
  { id: 'sm', name: '15x15cm', frameWidthCm: 15, frameHeightCm: 15, backgroundWidthCm: 12, backgroundHeightCm: 12, price: 210000, imageUrl: 'https://i.imgur.com/O1x9h2j.jpg', description: 'Nhỏ gọn, tinh tế' },
  { id: 'md', name: '14.8x21cm', frameWidthCm: 14.8, frameHeightCm: 21, backgroundWidthCm: 11.8, backgroundHeightCm: 18, price: 220000, imageUrl: 'https://i.imgur.com/p3QZgff.jpg', description: 'Thanh lịch, đứng dáng' },
  { id: 'lg', name: '23x23cm', frameWidthCm: 23, frameHeightCm: 23, backgroundWidthCm: 20, backgroundHeightCm: 20, price: 230000, imageUrl: 'https://i.imgur.com/fL39v3o.jpg', description: 'Sang trọng, ấn tượng' },
];

const defaultShirtColors: OutfitColor[] = [
    { name: 'Trắng', hex: '#F8F8F8', imageUrl: 'https://lh3.googleusercontent.com/pw/AP1GczOVLrstztihrJqNhJzCC-d8TpHh0Bir1z82KMOOpuq3GOwWu6K9T6JDAyjgIBq8dj3jQaLWA9zAlZjGg2raYeER8dIVtBwMPUw6c-NbcsSlMvgYqbag39RYLuxKFZJ7Y4CkIpD3tDLQf4YkbTsrF6nT=w295-h472-s-no-gm?authuser=0', price: 0 },
    { name: 'Đỏ', hex: '#E53E3E', imageUrl: 'https://lh3.googleusercontent.com/pw/AP1GczNe9ZxuP5uYenmJ2OkBjYnoygoVshgZ2TDD8YKieOfsRQ-VLXe-lxNMIwn71vsmW7yNXS8RPo8ynHrj74ZawXVU6kwr5qbeqpDgzEBD0Zs_OiVXE-LojwwEsCVGDb6fG6DNDzDMcnIiN74tMHe9SDt9=w295-h154-s-no-gm?authuser=0', price: 10000 },
    { name: 'Xanh', hex: '#3B82F6', imageUrl: 'https://i.imgur.com/YAnk5Fv.png', price: 10000 },
];

const defaultPantsColors: OutfitColor[] = [
    { name: 'Đen', hex: '#1A202C', imageUrl: 'https://lh3.googleusercontent.com/pw/AP1GczPc3y3ZtsrHwqrhSrem6tH0Sb2jTukrs6IqM3ZcNWruncnNtpL7ysCpSNtTna2ZXX57U0imYog1TnHiBcE8P_286llBYKGzl_L0z9stZ7jhCwEYZf4BPSCsnKscwR5hqKydGhZvt6XY60yk3luu3CXi=w295-h472-s-no-gm?authuser=0', price: 0 },
    { name: 'Be', hex: '#F5F5DC', imageUrl: 'https://lh3.googleusercontent.com/pw/AP1GczNcsJgRKdG0ms5JKkz8Ka8pBJsocsiYcXh7fli0HGxzyNpQTaGvOWg3x-_Qh3Y1ZI6tRdLjAFvrt6ANJzk43UYJedjTpEJFit_UBDs_TkKMcSfPYHtvJgKFrS9iOvSXEKdjMpL-i_IfrgxVcYpZyyrC=w295-h154-s-no-gm?authuser=0', price: 10000 },
    { name: 'Xám', hex: '#A0AEC0', imageUrl: 'https://i.imgur.com/J4p3pAv.png', price: 10000 },
];


// Standardized dimensions based on the new specification
const HEAD_W_CM = 1.0;
const HEAD_H_CM = 1.0;
const TORSO_W_CM = 2.5;
const TORSO_H_CM = 1.3;
const LEGS_W_CM = 1.5;
const LEGS_H_CM = 1.6;
const HAT_H_CM = 0.8; // A reasonable height for hats

export const LEGO_PARTS: {
  hair: LegoPart[];
  face: LegoPart[];
  shirt: LegoPart[];
  pants: LegoPart[];
  hat: LegoPart[];
  accessory: LegoPart[];
  pet: LegoPart[];
} = {
  hair: [
    { id: 'hair1', name: 'Tóc 1', price: 25000, imageUrl: 'https://lh3.googleusercontent.com/pw/AP1GczPCPpvDr-CQgRqa-w3G1jvJG2pX5oytXcg2X94eCfbQ40ugBPz6o9ZpMybJU8AffRZci6joKyD3lX0iXpcGo7YP-uaHwATVtZq0mziKnIiK6nENRrsLUkSTaHiNqU6KP9YuBESqLV8VtCeF68434gJp=w295-h472-s-no-gm?authuser=0', type: 'hair', widthCm: 2.7, heightCm: 1.8, attach: { x: 0.5, y: 0.25 } },
    { id: 'hair2', name: 'Tóc 2', price: 25000, imageUrl: 'https://i.imgur.com/2aLDUY1.png', type: 'hair', widthCm: 2.7, heightCm: 1.8, attach: { x: 0.5, y: 0.25 } },
    { id: 'hair3', name: 'Tóc 3', price: 25000, imageUrl: 'https://i.imgur.com/8SLnM32.png', type: 'hair', widthCm: 2.7, heightCm: 1.8, attach: { x: 0.5, y: 0.25 } },
    { id: 'hair4', name: 'Tóc 4', price: 25000, imageUrl: 'https://i.imgur.com/N2sDbvV.png', type: 'hair', widthCm: 2.7, heightCm: 1.8, attach: { x: 0.5, y: 0.25 } },
    { id: 'hair5', name: 'Tóc 5', price: 25000, imageUrl: 'https://i.imgur.com/L13p78E.png', type: 'hair', widthCm: 2.7, heightCm: 1.8, attach: { x: 0.5, y: 0.25 } },
  ],
  face: [
    { id: 'face1', name: 'Mặt 1', price: 0, imageUrl: 'https://lh3.googleusercontent.com/pw/AP1GczO06-xgcPdmnVF7c4hWm6N-DG59zpDg89AtodzS9BDbf5VMc5vnV5l8xSHybBeRorRf4nxADzRbVLcZ2IoFzkxC6ypL7O3yMkRNVl6XGDpfDe4zA1lGbSMTG9z07of7w2unrLqeabCrgMaz6f4c8pHO=w295-h472-s-no-gm?authuser=0', type: 'face', widthCm: HEAD_W_CM, heightCm: HEAD_H_CM },
    { id: 'face2', name: 'Mặt 2', price: 0, imageUrl: 'https://i.imgur.com/hgzcT7A.png', type: 'face', widthCm: HEAD_W_CM, heightCm: HEAD_H_CM },
    { id: 'face3', name: 'Mặt 3', price: 0, imageUrl: 'https://i.imgur.com/lsmh2J8.png', type: 'face', widthCm: HEAD_W_CM, heightCm: HEAD_H_CM },
    { id: 'face4', name: 'Mặt 4', price: 0, imageUrl: 'https://i.imgur.com/9nQlqnM.png', type: 'face', widthCm: HEAD_W_CM, heightCm: HEAD_H_CM },
    { id: 'face5', name: 'Mặt 5', price: 0, imageUrl: 'https://i.imgur.com/AEf47k0.png', type: 'face', widthCm: HEAD_W_CM, heightCm: HEAD_H_CM },
  ],
  shirt: [
    { id: 'shirt1', name: 'Áo trơn', price: 0, imageUrl: defaultShirtColors[0].imageUrl, type: 'shirt', widthCm: TORSO_W_CM, heightCm: TORSO_H_CM, colors: defaultShirtColors },
    { id: 'shirt2', name: 'Áo 2', price: 15000, imageUrl: 'https://i.imgur.com/sKTB6aF.png', type: 'shirt', widthCm: TORSO_W_CM, heightCm: TORSO_H_CM },
    { id: 'shirt3', name: 'Áo 3', price: 15000, imageUrl: 'https://i.imgur.com/2uIJT8n.png', type: 'shirt', widthCm: TORSO_W_CM, heightCm: TORSO_H_CM },
    { id: 'shirt4', name: 'Áo 4', price: 15000, imageUrl: 'https://i.imgur.com/dKGAi2f.png', type: 'shirt', widthCm: TORSO_W_CM, heightCm: TORSO_H_CM },
    { id: 'shirt5', name: 'Áo 5', price: 15000, imageUrl: 'https://i.imgur.com/yLohj2r.png', type: 'shirt', widthCm: TORSO_W_CM, heightCm: TORSO_H_CM },
  ],
  pants: [
    { id: 'pants1', name: 'Quần trơn', price: 0, imageUrl: defaultPantsColors[0].imageUrl, type: 'pants', widthCm: LEGS_W_CM, heightCm: LEGS_H_CM, colors: defaultPantsColors },
    { id: 'pants2', name: 'Quần 2', price: 15000, imageUrl: 'https://i.imgur.com/xQy2S8U.png', type: 'pants', widthCm: LEGS_W_CM, heightCm: LEGS_H_CM },
    { id: 'pants3', name: 'Quần 3', price: 15000, imageUrl: 'https://i.imgur.com/L79Qn5V.png', type: 'pants', widthCm: LEGS_W_CM, heightCm: LEGS_H_CM },
    { id: 'pants4', name: 'Quần 4', price: 15000, imageUrl: 'https://i.imgur.com/MhQZJ3n.png', type: 'pants', widthCm: LEGS_W_CM, heightCm: LEGS_H_CM },
    { id: 'pants5', name: 'Quần 5', price: 15000, imageUrl: 'https://i.imgur.com/XGsaM1v.png', type: 'pants', widthCm: LEGS_W_CM, heightCm: LEGS_H_CM },
  ],
  hat: [
    { id: 'hat1', name: 'Mũ 1', price: 30000, imageUrl: 'https://i.imgur.com/sZ0XwxN.png', type: 'hat', widthCm: 2.5, heightCm: HAT_H_CM },
    { id: 'hat2', name: 'Mũ 2', price: 30000, imageUrl: 'https://i.imgur.com/iJEuYwH.png', type: 'hat', widthCm: 2.5, heightCm: HAT_H_CM },
    { id: 'hat3', name: 'Mũ 3', price: 30000, imageUrl: 'https://i.imgur.com/4q4g16H.png', type: 'hat', widthCm: 2.5, heightCm: HAT_H_CM },
  ],
  accessory: [
    { id: 'accessory1', name: 'Phụ kiện 1', price: 5000, imageUrl: 'https://i.imgur.com/g0S9eYT.png', type: 'accessory', widthCm: 0.8, heightCm: 0.8 },
    { id: 'accessory2', name: 'Phụ kiện 2', price: 5000, imageUrl: 'https://i.imgur.com/u3gLV0t.png', type: 'accessory', widthCm: 0.8, heightCm: 0.8 },
    { id: 'accessory3', name: 'Phụ kiện 3', price: 5000, imageUrl: 'https://i.imgur.com/5Jz8OxC.png', type: 'accessory', widthCm: 0.8, heightCm: 0.8 },
    { id: 'accessory4', name: 'Phụ kiện 4', price: 40000, imageUrl: 'https://i.imgur.com/bUnGPfW.png', type: 'accessory', widthCm: 1, heightCm: 1 },
    { id: 'accessory5', name: 'Phụ kiện 5', price: 40000, imageUrl: 'https://i.imgur.com/1nQjJ7W.png', type: 'accessory', widthCm: 1, heightCm: 1 },
  ],
  pet: [
    { id: 'pet1', name: 'Thú cưng 1', price: 15000, imageUrl: 'https://i.imgur.com/1v2sJ2b.png', type: 'pet', widthCm: 2, heightCm: 1.8 },
    { id: 'pet2', name: 'Thú cưng 2', price: 15000, imageUrl: 'https://i.imgur.com/N6LJ2y2.png', type: 'pet', widthCm: 2, heightCm: 1.8 },
    { id: 'pet3', name: 'Thú cưng 3', price: 15000, imageUrl: 'https://i.imgur.com/e3yGz0d.png', type: 'pet', widthCm: 2, heightCm: 1.8 },
  ],
};


// ===================================================================================
// =================== CHỈNH SỬA CÁC MẪU NỀN CÓ SẴN TẠI ĐÂY =========================
// ===================================================================================
// Hướng dẫn: 
// - Thêm/sửa/xóa các mẫu cho từng loại khung trong các mảng tương ứng dưới đây.
// - `name`: Tên hiển thị của mẫu.
// - `url`: Dán trực tiếp đường dẫn URL hình ảnh vào đây.
// - `category`: Dịp của mẫu (để khách hàng lọc, vd: 'Kỷ niệm', 'Sinh nhật').
// ===================================================================================

/**
 * === KHUNG VUÔNG ===
 * Áp dụng cho cả 2 cỡ: 15x15cm & 23x23cm
 * Thêm hoặc sửa các mẫu cho khung vuông ở đây.
 */
export const PRESET_BACKGROUNDS_SQUARE: { name: string; url: string; category: string; }[] = [
    { name: 'Kỷ niệm 1', url: 'https://lh3.googleusercontent.com/pw/AP1GczM0nRHEo2eAVli4BgIMG_JIeNPoeyxfEPrX1oiK9jA7c4w-bK0kOsD8D9UycqckgTqhq55378s_aHLW6-ZGSrI5RnnzXKX_ojRsW2rNaW1P6ufoVX-HsAg2A51HVC5H6BAq8sJg6UxsEWFnx_d8h_0=w1031-h1034-s-no-gm?authuser=0', category: 'Kỷ niệm' },
    { name: 'Kỷ niệm 3', url: 'https://lh3.googleusercontent.com/pw/AP1GczNQIZZ5Q51k0rVMcXZchzlDCyjRzuWIrJF7h8EGiVrUNc6hXv86ltXjaN49aJz1u0Jz0Y5rmZSuCaJ_T538jr7sCIfX3Yiphd_UpM_JQLRhbZh2jXAOhhL1HcjEs3bZrI2MCVcxt2jivjC5OzdqGTI=w1138-h1134-s-no-gm?authuser=0', category: 'Kỷ niệm' },
    { name: 'Kỷ niệm 4', url: 'http://lh3.googleusercontent.com/pw/AP1GczOyTho_e-2YwjZAAxanbpIl_cy91I_gynW4-6KHqTVHHOw8OCx40V9IOH9h8CY2T7yQlhYtwJlg8VZbieJgLGmYpjUxRXJ5QU0MnRRGHVwIBELZJJjL5rz0IjAjBXdNaB42a8_drRxfMlC3I1F1qIg=w1128-h1131-s-no-gm?authuser=0', category: 'Kỷ niệm' },
    { name: 'Sinh nhật 1', url: 'https://lh3.googleusercontent.com/pw/AP1GczM-SMSA6DnWoorLbnq6DyDPQ3QN1EUDfZhP47DphHOVt9mEnwohm1awE0t8L4Y5DLW-7M3rvpiG35-6iz8T1kUrvhUUUkXiiv7QTxMXJmD2UqlNXLbUGv5OOGfR8X04jjazCko4cNov9lbM-xAzWek=w1148-h1132-s-no-gm?authuser=0', category: 'Sinh nhật' },
    { name: 'Sinh nhật 4', url: 'https://lh3.googleusercontent.com/pw/AP1GczOAwzsnaFQ8tGobLpeFseXAhtRTaHFiaZgNxQ4GPiS5I1dkvb2dwenM8XJ3QPrbL-ltVQQ6SXuKW1ul3mRmkA30ACqAflpcVA7zM39nlpftxIHAxx94kxXQIi3ASQYsnmoMN9Ia2eLGxTD51VDqOwk=w1128-h1123-s-no-gm?authuser=0', category: 'Sinh nhật' },
    { name: 'Sinh nhật 5', url: 'https://lh3.googleusercontent.com/pw/AP1GczNQQTFoQOmoe9mdqJKUcwpKJm5R8CG_p8SDm0ipY5ERyicBBFCK4bUJ_aVGpiC8K0ARbsPhaTZ8vf1cSzMWElbw-Ze8sSXY2EhLIr6nvlu42UC9qvseXalPlrK9iBPKor5jnB5vc2dBmfwnR1uDbXk=w1130-h1134-s-no-gm?authuser=0', category: 'Sinh nhật' },
    { name: 'Tốt nghiệp 2', url: 'https://lh3.googleusercontent.com/pw/AP1GczMdnvFOdBp9ClYfoe_8m4twzxTz1IA1YbmTpfBkDIpGxIWOUxRHoOrFYOy18UGnWzhXvD2Cy6kEoGdHnMS_y05PIVQcYGw3J4_cgrKJvh3iNusRIXpfn6tQenwLUHa155LLgl3GhzMpLzyNBnJHZp0=w1271-h1276-s-no-gm?authuser=0', category: 'Tốt nghiệp' },
    { name: 'Valentine', url: 'https://i.imgur.com/g0Ab5kG.jpg', category: 'Valentine' },
    { name: 'Đám cưới', url: 'https://i.imgur.com/w2Y3gbS.jpg', category: 'Đám cưới' },
    { name: 'Spotify', url: 'https://i.imgur.com/U8I3uY0.png', category: 'Spotify' },
];

/**
 * === KHUNG CHỮ NHẬT ===
 * Áp dụng cho cỡ A5: 14.8x21cm
 * Thêm hoặc sửa các mẫu cho khung chữ nhật (A5) ở đây.
 */
export const PRESET_BACKGROUNDS_RECTANGLE: { name: string; url: string; category: string; }[] = [
    { name: 'FootBall 1', url: 'https://lh3.googleusercontent.com/pw/AP1GczP0iky6n0xl4zx_yGr1tIcZPQAr8aDG9bT_uo_Ya8hreVOUxtQggqMhotXOealT9yMWllM7nT6NIFT5hqEcPUKUgwzFEYcqbmn6R1hbGjW-0mE9eYtyIyCeRmsCvm6P0gVTJveCYf_u1hTrGCTWu_gU=w515-h733-s-no-gm?authuser=0', category: 'Kỷ niệm' },
    { name: 'FootBall 2', url: 'https://lh3.googleusercontent.com/pw/AP1GczMQ5y2_-1hToGCgRoixEhm-cuf1HwT7M41wk_e4G2b9IcRPvgtNueJXVb8kI7aCmxO63J7l_C8tra_rjNSDQnb0i4TdxEVIyY1hIfHuvy2WT0Y61MCrc427TxEwEBf4MAXCHSto0DYVjUfzIww9yXfo=w512-h739-s-no-gm?authuser=0', category: 'Sinh nhật' },
    { name: 'FootBall 3', url: 'https://lh3.googleusercontent.com/pw/AP1GczO7JgLHHBw6mVgTCLLM4UocVFDzSgPJiPH5beQ2x0G0_aGDHB2-CYdny3pk6FIQVJeyqfpkWnm1XsgolB_o8CLgUI_VJrW4yfFPvEniWkFmEbe_L0X6UFgmjea1Ua23GjJjRwIicv_I51N7z6TsRljU=w512-h736-s-no-gm?authuser=0', category: 'Sinh nhật' },
    { name: 'FootBall 4', url: 'https://lh3.googleusercontent.com/pw/AP1GczPhO-fWNQfBVSOPZdN_weLxO-0pE_F42zJWCzAig3Z7iCYwoTMHz-9VhuZPzy1bVtJslvP-hfpm1fTx567j8rEHM8DBTgeWaCun-rU6x41LLulNOnJIkdqnHqls7vocer-aF79LPgt0TX46WacvIIrS=w513-h739-s-no-gm?authuser=0', category: 'Tốt nghiệp' },
    { name: 'Tốt nghiệp 3', url: 'https://i.imgur.com/pBf1gV2.jpg', category: 'Tốt nghiệp' },
    { name: 'Album 1', url: 'https://i.imgur.com/qT1qB1k.jpg', category: 'Album' },
    { name: 'Album 2', url: 'https://i.imgur.com/sC03b30.jpg', category: 'Album' },
];

export const INITIAL_FRAME_CONFIG: FrameConfig = {
  frameId: 'sm',
  background: { type: 'color', value: '#f4eee8' },
  characters: [],
  texts: [],
  draggableItems: [],
};

const initialTextConfig = {
    id: 1,
    content: 'Our Special Day',
    font: 'Anniversary',
    size: 50,
    color: '#333333',
    x: 50,
    y: 20,
    rotation: -5,
    scale: 1.2,
    background: true,
    textAlign: 'center' as const,
};

export const COLLECTION_TEMPLATES: { name: string; imageUrl: string; config: FrameConfig }[] = [
    {
        name: 'Wedding Day',
        imageUrl: 'https://i.imgur.com/8aQp57m.jpg',
        config: {
            frameId: 'lg',
            background: { type: 'image', value: 'https://i.imgur.com/g0Ab5kG.jpg' },
            texts: [initialTextConfig],
            characters: [
                { id: 1, shirt: LEGO_PARTS.shirt[1], pants: LEGO_PARTS.pants[1], face: LEGO_PARTS.face[1], hair: LEGO_PARTS.hair[1], x: 40, y: 75, rotation: 0, scale: 1 },
                { id: 2, shirt: LEGO_PARTS.shirt[2], pants: LEGO_PARTS.pants[2], face: LEGO_PARTS.face[2], hair: LEGO_PARTS.hair[2], x: 60, y: 75, rotation: 0, scale: 1 },
            ],
            draggableItems: [],
        }
    },
    {
        name: 'Graduation',
        imageUrl: 'https://i.imgur.com/pBf1gV2.jpg',
        config: {
            frameId: 'md',
            background: { type: 'color', value: '#e0f2fe' },
            texts: [{...initialTextConfig, id: 2, content: 'Class of 2024', y: 10, rotation: 0, scale: 1}],
            characters: [
                { id: 1, shirt: LEGO_PARTS.shirt[3], pants: LEGO_PARTS.pants[3], face: LEGO_PARTS.face[3], hat: LEGO_PARTS.hat[0], x: 50, y: 75, rotation: 0, scale: 1 },
            ],
            draggableItems: [{ id: Date.now(), partId: 'accessory1', type: 'accessory', x: 70, y: 70, rotation: 15, scale: 1 }],
        }
    },
    {
        name: 'Birthday Fun',
        imageUrl: 'https://i.imgur.com/kY8P8eH.jpg',
        config: {
            frameId: 'sm',
            background: { type: 'image', value: 'https://i.imgur.com/0o3bY8U.jpg' },
            texts: [{...initialTextConfig, id: 3, content: 'Happy Birthday!', y: 25, rotation: 0, scale: 1}],
            characters: [
                { id: 1, shirt: LEGO_PARTS.shirt[4], pants: LEGO_PARTS.pants[4], face: LEGO_PARTS.face[4], hair: LEGO_PARTS.hair[4], x: 50, y: 75, rotation: 0, scale: 1 },
            ],
            draggableItems: [{id: Date.now(), partId: 'pet1', type: 'pet', x: 20, y: 80, rotation: -10, scale: 1}],
        }
    }
];

export const FEEDBACK_ITEMS = [
    { name: 'Minh & Anh', text: 'Món quà kỷ niệm cưới tuyệt vời, chồng mình rất thích!', imageUrl: 'https://i.imgur.com/rQ8aY2w.jpg' },
    { name: 'Gia đình bé Bắp', text: 'Bé nhà mình rất hào hứng khi thấy cả nhà trong khung hình LEGO.', imageUrl: 'https://i.imgur.com/sC03b30.jpg' },
    { name: 'Hoàng Long', text: 'Shop tư vấn nhiệt tình, giao hàng nhanh. Sẽ ủng hộ lần tới!', imageUrl: 'https://i.imgur.com/w2Y3gbS.jpg' },
    { name: 'Thùy Chi', text: 'Chất lượng sản phẩm rất tốt, chi tiết sắc nét.', imageUrl: 'https://i.imgur.com/pBf1gV2.jpg' },
];

export const MOCK_ORDERS: Record<string, Order> = {
  "#TL012804": {
    id: "#TL012804",
    status: "Đang xử lý",
    customer: {
      name: "Dương",
      phone: "0964064015",
      email: "customer@example.com",
      address: "Khu A, Phường Trúc Bạch, Quận Ba Đình, Thành phố Hà Nội",
    },
    delivery: {
      date: "2025-11-28",
      notes: "Giao giờ hành chính",
    },
    items: [{
      ...COLLECTION_TEMPLATES[0].config,
      frameId: 'lg',
      previewImageUrl: 'https://i.imgur.com/fL39v3o.jpg'
    }],
    addGiftBox: false,
    shipping: {
      method: 'standard',
      fee: 25000,
    },
    payment: {
      method: 'deposit',
    },
    totalPrice: 235000,
    amountToPay: 164500,
  },
  "#TL123884": {
    id: "#TL123884",
    status: "Chờ thanh toán",
     customer: {
      name: "Dương",
      phone: "0964064015",
      email: "customer@example.com",
      address: "Khu A, Phường Trúc Bạch, Quận Ba Đình, Thành phố Hà Nội",
    },
     delivery: {
      date: "2025-11-28",
      notes: "",
    },
    items: [{...COLLECTION_TEMPLATES[1].config, previewImageUrl: 'https://i.imgur.com/pBf1gV2.jpg'}],
    addGiftBox: false,
    shipping: {
      method: 'standard',
      fee: 25000,
    },
    payment: {
      method: 'deposit',
    },
    totalPrice: 235000,
    amountToPay: 164500,
  }
};


export const PRODUCT_HIGHLIGHTS = [
    {id: 1, name: 'Khung Kỷ niệm Ngày cưới', collection: 'Bộ sưu tập Tình yêu', imageUrl: 'https://i.imgur.com/8aQp57m.jpg' },
    {id: 2, name: 'Khung Tốt nghiệp', collection: 'Bộ sưu tập Dấu ấn', imageUrl: 'https://i.imgur.com/pBf1gV2.jpg' },
    {id: 3, name: 'Khung Gia đình', collection: 'Bộ sưu tập Gia đình', imageUrl: 'https://i.imgur.com/sC03b30.jpg' },
    {id: 4, name: 'Khung Sinh nhật Vui vẻ', collection: 'Bộ sưu tập Mừng tuổi mới', imageUrl: 'https://i.imgur.com/kY8P8eH.jpg' },
]

export const GENERAL_ASSETS = {
  hero: 'https://i.imgur.com/8mPmG9W.jpg',
  inspire: 'https://i.imgur.com/v8uYwRj.jpg',
  giftbox: 'https://i.imgur.com/7gDkS1Q.png',
  vietqr: 'https://i.imgur.com/pYCb0a9.png'
}
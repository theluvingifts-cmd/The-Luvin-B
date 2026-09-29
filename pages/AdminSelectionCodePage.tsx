import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import type { LegoPart, OutfitColor } from '../types';
import { AdminLogin } from '../components/admin/AdminLogin';
import { CharacterPreview } from '../components/shared/CharacterPreview';
import { SmartImage } from '../components/shared/SmartImage';
import { getAllParts } from '../services/productService';
import { getStoreConfig } from '../services/configService';
import { decodeSelectionCode, type DecodedSelection } from '../utils/selectionCode';
import { formatCurrency, getEffectivePrice, getPartImageUrl } from '../utils/pricing';

const getDisplayPrice = (part?: LegoPart, color?: OutfitColor, quantity = 1) => {
  if (!part) return 0;
  return getEffectivePrice(part, quantity, part.bulkPricing) + (color?.price || 0);
};

const applyAdminStandaloneBranding = (config: any) => {
  document.title = 'Đọc mã lựa chọn | The Luvin';

  const bodyFont = config?.theme?.global?.typography?.bodyFont || 'Montserrat';
  const cleanBodyFont = String(bodyFont).replace(/['"]/g, '');
  document.documentElement.style.setProperty('--font-body', `'${cleanBodyFont}'`);

  const uploadedFonts = Array.isArray(config?.uploadedFonts) ? config.uploadedFonts : [];
  if (uploadedFonts.length) {
    const styleId = 'selection-admin-uploaded-fonts';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.innerHTML = uploadedFonts.map((font: any) => {
      const safeName = String(font.name || '').replace(/[^a-zA-Z0-9\s-]/g, '');
      return safeName && font.url ? `@font-face{font-family:'${safeName}';src:url('${font.url}');font-weight:100 900;font-style:normal;font-display:swap;}` : '';
    }).join('\n');
  }

  const iconUrl = config?.faviconUrl || config?.appIconUrl || config?.logoUrl;
  if (!iconUrl) return;
  let favicon = (document.getElementById('favicon-link') || document.querySelector("link[rel~='icon']")) as HTMLLinkElement | null;
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.id = 'favicon-link';
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = iconUrl;

  let appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
  if (!appleIcon) {
    appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = config?.appIconUrl || iconUrl;
};

const PartRow: React.FC<{ label: string; part?: LegoPart; color?: OutfitColor; showPrice?: boolean }> = ({ label, part, color, showPrice }) => (
  <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2.5 last:border-0">
    <span className="shrink-0 text-xs font-bold text-gray-400">{label}</span>
    {part ? (
      <div className="text-right">
        <p className="text-xs font-extrabold text-gray-800">{part.name}</p>
        <p className="mt-0.5 font-mono text-[10px] font-bold text-gray-400">{part.id}</p>
        {color && <p className="mt-0.5 text-[10px] font-bold text-[#b8566d]">Màu: {color.name}</p>}
        {showPrice && <p className="mt-0.5 text-[10px] font-extrabold text-[#b8566d]">+{formatCurrency(getDisplayPrice(part, color))}</p>}
      </div>
    ) : <span className="text-xs font-semibold text-gray-300">Không có</span>}
  </div>
);

export const AdminSelectionCodePage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [parts, setParts] = useState<LegoPart[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [storeConfig, setStoreConfig] = useState<any>({});
  const [code, setCode] = useState('');
  const [decoded, setDecoded] = useState<DecodedSelection | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    setPartsLoading(true);
    Promise.all([getAllParts(), getStoreConfig()])
      .then(([nextParts, config]) => {
        if (!active) return;
        setParts(nextParts || []);
        setStoreConfig(config || {});
        if (config?.logoUrl) setLogoUrl(config.logoUrl);
        applyAdminStandaloneBranding(config);
      })
      .finally(() => active && setPartsLoading(false));
    return () => { active = false; };
  }, [currentUser]);

  const handleDecode = (value = code) => {
    setError('');
    setDecoded(null);
    try {
      if (!value.trim()) throw new Error('Hãy dán mã khách gửi trước.');
      if (!parts.length) throw new Error('Danh sách linh kiện chưa tải xong.');
      const result = decodeSelectionCode(value, parts);
      setDecoded(result);
    } catch (err: any) {
      setError(err?.message || 'Không đọc được mã lựa chọn.');
    }
  };

  const textSummary = useMemo(() => {
    if (!decoded) return '';
    const rows: string[] = ['THE LUVIN - LỰA CHỌN KHÁCH'];
    decoded.characters.forEach((character, index) => {
      rows.push(`\nNhân vật ${index + 1}`);
      const list: Array<[string, LegoPart | undefined, OutfitColor | undefined]> = [
        ['Tóc', character.hair, character.selectedHairColor],
        ['Mặt', character.face, undefined],
        ['Bộ đồ', character.set, character.selectedSetColor],
        ['Áo', character.set ? undefined : character.shirt, character.selectedShirtColor],
        ['Quần', character.set ? undefined : character.pants, character.selectedPantsColor],
      ];
      list.filter(([, part]) => Boolean(part)).forEach(([label, part, color]) => {
        rows.push(`- ${label}: ${part?.name} [${part?.id}]${color ? ` - ${color.name}` : ''}`);
      });
      const printOption = character.customPrintOption || 'none';
      const printLabel = printOption === 'standard' ? 'In thường' : printOption === 'premium' ? 'In cao cấp' : 'Không in';
      rows.push(`- In quần áo: ${printLabel}${(character.customPrintPrice || 0) > 0 ? ` (+${formatCurrency(character.customPrintPrice || 0)})` : ''}`);
    });
    if (decoded.charms.length) {
      rows.push('\nCharm / phụ kiện');
      decoded.charms.forEach(item => rows.push(`- ${item.part.name} [${item.part.id}] x${item.quantity}${item.selectedColor ? ` - ${item.selectedColor.name}` : ''}`));
    }
    return rows.join('\n');
  }, [decoded]);

  const copySummary = async () => {
    if (!textSummary) return;
    await navigator.clipboard.writeText(textSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const totalExtras = useMemo(() => {
    if (!decoded) return 0;
    const sets = decoded.characters.reduce((sum, character) => sum + getDisplayPrice(character.set, character.selectedSetColor), 0);
    const customPrints = decoded.characters.reduce((sum, character) => sum + Math.max(0, Number(character.customPrintPrice) || 0), 0);
    const charms = decoded.charms.reduce((sum, item) => sum + getDisplayPrice(item.part, item.selectedColor, item.quantity) * item.quantity, 0);
    return sets + customPrints + charms;
  }, [decoded]);

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" /></div>;
  }
  if (!currentUser) return <AdminLogin />;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" style={{ fontFamily: 'var(--font-body), Montserrat, sans-serif' }}>
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? <img src={logoUrl} className="h-8 max-w-[100px] object-contain" alt="The Luvin" /> : <span className="text-sm font-black">THE LUVIN</span>}
            <div className="h-5 w-px bg-gray-200" />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">Đọc mã lựa chọn</p>
              <p className="hidden text-[10px] font-semibold text-gray-400 sm:block">Nhân vật, in quần áo & charm khách đã chọn</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { window.location.href = '/admin'; }} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">← Admin</button>
            <button onClick={() => signOut(auth)} className="rounded-xl px-3 py-2 text-xs font-bold text-gray-400 hover:bg-red-50 hover:text-red-600">Đăng xuất</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-7">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c96c81]">Mã khách gửi</p>
            <h1 className="mt-1 text-lg font-extrabold sm:text-xl" style={{ fontFamily: 'var(--font-body), Montserrat, sans-serif' }}>Dán mã để hiện lại lựa chọn</h1>
            <p className="mt-1 text-xs font-medium leading-relaxed text-gray-400">Mã bắt đầu bằng <b>TLV1-</b>. Không cần ảnh chụp màn hình và không lưu thêm dữ liệu vào Firebase.</p>
          </div>
          <div className="p-4 sm:p-5">
            <textarea
              value={code}
              onChange={event => setCode(event.target.value)}
              onPaste={event => {
                const pasted = event.clipboardData.getData('text');
                if (pasted.trim().startsWith('TLV1-')) {
                  setTimeout(() => handleDecode(pasted), 0);
                }
              }}
              rows={4}
              placeholder="TLV1-XXXXXXX-..."
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs font-bold leading-relaxed outline-none transition focus:border-[#d997a7] focus:bg-white focus:ring-2 focus:ring-[#f9dbe2]"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button disabled={partsLoading} onClick={() => handleDecode()} className="min-h-11 flex-1 rounded-xl bg-gray-900 px-5 text-sm font-extrabold text-white disabled:opacity-50">
                {partsLoading ? 'Đang tải kho linh kiện...' : 'Hiển thị lựa chọn'}
              </button>
              <button onClick={() => { setCode(''); setDecoded(null); setError(''); }} className="min-h-11 rounded-xl border border-gray-200 px-5 text-sm font-bold text-gray-500">Xóa</button>
            </div>
            {error && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600">{error}</div>}
          </div>
        </section>

        {decoded && (
          <div className="mt-4 space-y-4">
            {decoded.missingIds.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                Có {decoded.missingIds.length} mã linh kiện không còn trong kho hiện tại: <span className="font-mono font-bold">{decoded.missingIds.join(', ')}</span>. Các phần còn lại vẫn đã được giải mã.
              </div>
            )}

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Kết quả</p>
                  <h2 className="mt-1 text-base font-extrabold" style={{ fontFamily: 'var(--font-body), Montserrat, sans-serif' }}>{decoded.characters.length} nhân vật · {decoded.charms.reduce((sum, item) => sum + item.quantity, 0)} charm</h2>
                </div>
                <div className="flex items-center gap-2">
                  {totalExtras > 0 && <span className="rounded-full bg-[#fff1f4] px-3 py-1.5 text-xs font-extrabold text-[#b8566d]">Phụ phí hiển thị: {formatCurrency(totalExtras)}</span>}
                  <button onClick={copySummary} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">{copied ? '✓ Đã copy' : 'Copy tóm tắt'}</button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {decoded.characters.map((character, index) => (
                  <article key={character.id} className="rounded-2xl border border-gray-100 bg-[#fbfaf9] p-3.5">
                    <div className="flex gap-4">
                      <div className="flex h-36 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.04]">
                        <div className="scale-110"><CharacterPreview character={character} size="lg" /></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-xs font-black uppercase tracking-[0.12em] text-[#c96c81]">Nhân vật {index + 1}</p>
                        <PartRow label="Tóc" part={character.hair} color={character.selectedHairColor} />
                        <PartRow label="Mặt" part={character.face} />
                        {character.set ? (
                          <PartRow label="Bộ đồ" part={character.set} color={character.selectedSetColor} showPrice />
                        ) : (
                          <>
                            <PartRow label="Áo" part={character.shirt} color={character.selectedShirtColor} />
                            <PartRow label="Quần" part={character.pants} color={character.selectedPantsColor} />
                          </>
                        )}
                        <div className="flex items-start justify-between gap-4 border-t border-gray-100 py-2.5">
                          <span className="shrink-0 text-xs font-bold text-gray-400">In quần áo</span>
                          <div className="text-right">
                            <p className={`text-xs font-extrabold ${(character.customPrintOption || 'none') === 'none' ? 'text-gray-400' : 'text-[#b8566d]'}`}>
                              {(character.customPrintOption || 'none') === 'standard' ? 'In thường' : (character.customPrintOption || 'none') === 'premium' ? 'In cao cấp' : 'Không in'}
                            </p>
                            {(character.customPrintPrice || 0) > 0 && <p className="mt-0.5 text-[10px] font-extrabold text-[#b8566d]">+{formatCurrency(character.customPrintPrice || 0)}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-extrabold" style={{ fontFamily: 'var(--font-body), Montserrat, sans-serif' }}>Charm & phụ kiện</h2>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-extrabold text-gray-500">{decoded.charms.length} mẫu</span>
              </div>
              {decoded.charms.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {decoded.charms.map(item => (
                    <div key={item.part.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                        <SmartImage src={item.selectedColor?.imageUrl || getPartImageUrl(item.part)} alt={item.part.name} className="h-full w-full" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-extrabold text-gray-800">{item.part.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] font-bold text-gray-400">{item.part.id}</p>
                        {item.selectedColor && <p className="mt-0.5 text-[10px] font-bold text-[#b8566d]">Màu: {item.selectedColor.name}</p>}
                        <p className="mt-0.5 text-[10px] font-extrabold text-[#b8566d]">+{formatCurrency(getDisplayPrice(item.part, item.selectedColor, item.quantity))} / món</p>
                      </div>
                      <span className="rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-extrabold text-white">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 py-8 text-center text-xs font-semibold text-gray-300">Khách không chọn charm / phụ kiện</div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminSelectionCodePage;

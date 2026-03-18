
import React from 'react';
import { formatCurrency } from '../utils/pricing';

interface UnifiedProgressBarProps {
    subtotal: number;
    freeShippingThreshold: number;
    rewardTiers: { threshold: number; reward: string; icon: string; enabled?: boolean; }[];
    className?: string;
}

export const UnifiedProgressBar: React.FC<UnifiedProgressBarProps> = ({ subtotal, freeShippingThreshold, rewardTiers, className = '' }) => {
    // Temporarily ignore rewardTiers
    const activeRewardTiers: any[] = [];
    const milestones = [
        { threshold: freeShippingThreshold, label: 'Freeship', icon: '🚚', type: 'shipping' },
        ...activeRewardTiers.map(tier => ({ threshold: tier.threshold, label: tier.reward, icon: tier.icon, type: 'reward' }))
    ].sort((a, b) => a.threshold - b.threshold);

    const hasRewards = activeRewardTiers.length > 0;
    const maxThreshold = Math.max(...milestones.map(m => m.threshold), subtotal);
    const progress = Math.min((subtotal / maxThreshold) * 100, 100);

    const nextMilestone = milestones.find(m => subtotal < m.threshold);
    const earnedMilestones = milestones.filter(m => subtotal >= m.threshold);

    return (
        <div className={`space-y-3 ${className}`}>
            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">
                        {hasRewards ? 'Tiến độ ưu đãi' : 'Tiến độ Freeship'}
                    </span>
                    {nextMilestone ? (
                        <p className="text-xs font-bold text-gray-700">
                            Mua thêm <span className="text-luvin-pink">{formatCurrency(nextMilestone.threshold - subtotal)}</span> để {nextMilestone.type === 'shipping' ? 'được' : 'nhận'} {nextMilestone.icon} {nextMilestone.label}
                        </p>
                    ) : (
                        <p className="text-xs font-bold text-green-600">
                            {hasRewards ? '🎉 Bạn đã nhận được tất cả ưu đãi!' : '✨ Đã được Freeship'}
                        </p>
                    )}
                </div>
                <span className="text-xs font-black text-luvin-pink">{Math.round(progress)}%</span>
            </div>

            <div className="relative h-3 bg-gray-100 rounded-full overflow-visible">
                {/* Progress Bar */}
                <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-luvin-pink to-pink-400 rounded-full transition-all duration-700 ease-out z-10"
                    style={{ width: `${progress}%` }}
                >
                    <div className="absolute right-0 top-0 h-full w-4 bg-white/20 animate-pulse"></div>
                </div>

                {/* Milestones Markers */}
                {milestones.map((m, idx) => {
                    const pos = (m.threshold / maxThreshold) * 100;
                    const isEarned = subtotal >= m.threshold;
                    
                    // If no rewards, only show shipping marker if it's not 100% (or always show it)
                    // Actually, if only shipping, we can just show the bar.
                    if (!hasRewards && m.type === 'shipping' && pos >= 100) return null;

                    return (
                        <div 
                            key={idx}
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 group"
                            style={{ left: `${pos}%` }}
                        >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isEarned ? 'bg-white border-luvin-pink scale-110 shadow-sm' : 'bg-gray-200 border-white'}`}>
                                <span className={`text-[8px] transition-opacity duration-300 ${isEarned ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                            </div>
                            
                            {/* Tooltip-like label */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                                <div className="bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow-lg flex items-center gap-1">
                                    <span>{m.icon}</span>
                                    <span>{m.label}</span>
                                    <span className="font-bold">({formatCurrency(m.threshold)})</span>
                                </div>
                                <div className="w-2 h-2 bg-gray-800 rotate-45 mx-auto -mt-1"></div>
                            </div>

                            {/* Icon below */}
                            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] transition-all duration-300 ${isEarned ? 'grayscale-0 scale-110' : 'grayscale opacity-50'}`}>
                                {m.icon}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Earned Summary (Compact) - Only show if there are rewards */}
            {hasRewards && earnedMilestones.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                    {earnedMilestones.map((m, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-100">
                            <span>{m.icon}</span>
                            <span>{m.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

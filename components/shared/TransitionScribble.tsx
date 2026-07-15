import React, { useEffect } from 'react';
import { gsap } from 'gsap';

// Configuration parameters for the animation
const ANIMATION_CONFIG = {
    strokeWidthStart: "8%",
    strokeWidthMax: "31%",
    scale: 0.7,
    durationIn: 2.2,    // Time to scribble-draw to cover the screen
    durationOut: 2.7    // Time to undraw/clear scribble
};

// List of brand theme background colors to randomize
const transitionColors = [
    '#2bb374', // Green
    '#90caf9', // Light Blue
    '#0d47a1', // Dark Blue
    '#a5d6a7', // Light Green
    '#ff9800', // Orange
    '#800000', // Maroon
    '#f48fb1'  // Pink
];

// Light backgrounds where we want a dark contrast logo
const lightColors = ['#90caf9', '#a5d6a7', '#f48fb1'];

export const TransitionScribble: React.FC = () => {
    useEffect(() => {
        // Find the logo-truus element on the Navbar as click triggers
        const logoTruusClickable = document.querySelector('.logo-truus');
        const transitionScribblePath = document.querySelector('.transition-scribble path') as SVGPathElement | null;
        const transitionScribbleSvg = document.querySelector('.transition-scribble') as SVGSVGElement | null;

        if (!logoTruusClickable || !transitionScribblePath || !transitionScribbleSvg) return;

        const runScribbleAnimation = (e: Event | null) => {
            if (e) e.preventDefault();
            
            // Prevent duplicate triggers if already running
            if (
                gsap.isTweening(transitionScribblePath) || 
                gsap.isTweening(transitionScribbleSvg) || 
                document.body.classList.contains('is-transitioning')
            ) return;

            const config = ANIMATION_CONFIG;
            const durIn = config.durationIn;
            const durOut = config.durationOut;

            // Set initial scale
            gsap.set(transitionScribbleSvg, { scale: config.scale });

            // Measure actual length of the hand-drawn path
            const pathLength = transitionScribblePath.getTotalLength();
            const l = pathLength + 5;

            // Pick a random background color and matching contrast logo color
            const randomColor = transitionColors[Math.floor(Math.random() * transitionColors.length)];
            transitionScribbleSvg.style.color = randomColor;
            const logoColor = lightColors.includes(randomColor) ? '#000000' : '#ffffff';

            // Locate or dynamically build the center floating Transition Logo container
            let transitionLogo = document.querySelector('.transition-logo') as HTMLDivElement | null;
            if (!transitionLogo) {
                transitionLogo = document.createElement('div');
                transitionLogo.className = 'transition-logo';
                transitionLogo.style.cssText = `
                    position: fixed; 
                    top: 50%; 
                    left: 50%; 
                    transform: translate(-50%, -50%); 
                    z-index: 10000; 
                    pointer-events: none; 
                    opacity: 0; 
                    display: flex; 
                    flex-direction: column;
                    justify-content: center; 
                    align-items: center; 
                    width: 100%;
                    max-width: 100%;
                    transition: color 0.1s;
                `;
                // Clone the Navbar logo
                const logoSource = document.querySelector('.logo-truus');
                if (logoSource) {
                    const svgClone = logoSource.cloneNode(true) as HTMLElement;
                    // Clean up classes/styles to display nicely in the overlay center
                    svgClone.classList.remove('cursor-pointer');
                    svgClone.style.display = 'flex';
                    svgClone.style.justifyContent = 'center';
                    svgClone.style.alignItems = 'center';
                    svgClone.style.width = '100%';
                    svgClone.style.maxWidth = window.innerWidth >= 768 ? '420px' : '220px';
                    svgClone.style.height = 'auto';

                    // Find any wrapper div inside the cloned element that has heights like h-9, h-10, etc.
                    const innerDivs = svgClone.querySelectorAll('div');
                    innerDivs.forEach((div) => {
                        div.style.height = 'auto';
                        div.style.width = 'auto';
                        div.style.display = 'flex';
                        div.style.justifyContent = 'center';
                        div.style.alignItems = 'center';
                    });

                    // Handle img if present
                    const img = svgClone.querySelector('img');
                    if (img) {
                        img.style.height = 'auto';
                        img.style.maxHeight = window.innerWidth >= 768 ? '140px' : '70px';
                        img.style.width = window.innerWidth >= 768 ? '280px' : '140px';
                        img.style.maxWidth = '80vw';
                        img.style.objectFit = 'contain';
                    }

                    // Handle text span if present
                    const span = svgClone.querySelector('span');
                    if (span) {
                        span.className = ''; // Remove utility styles
                        span.style.fontSize = '1.35rem'; // Half of previous 2.5rem for optimal mobile size
                        if (window.innerWidth >= 768) {
                            span.style.fontSize = '3.5rem'; // Balanced desktop text size
                        }
                        span.style.fontWeight = '900';
                        span.style.textTransform = 'uppercase';
                        span.style.letterSpacing = '0.12em';
                        span.style.fontFamily = 'var(--font-heading), sans-serif';
                        span.style.textAlign = 'center';
                        span.style.display = 'block';
                        span.style.width = '100%';
                    }

                    transitionLogo.appendChild(svgClone);
                }
                document.body.appendChild(transitionLogo);
            }

            transitionLogo.style.color = logoColor;

            // Set initial draw states (invisible, fully undrawn)
            gsap.set(transitionScribblePath, { 
                strokeDasharray: `${l}px`, 
                strokeDashoffset: `${l}px`, 
                strokeWidth: config.strokeWidthStart, 
                opacity: 1 
            });
            gsap.set(transitionScribbleSvg, { opacity: 1, x: 0, y: 0, rotation: 0 });
            gsap.set(transitionLogo, { opacity: 0, scale: 1 });

            // Apply body freeze transition class (locks page-scrolling & interaction)
            document.body.classList.add('is-transitioning');

            // Build Timeline for synchronized drawing
            const drawTl = gsap.timeline({
                onComplete: () => {
                    document.body.classList.remove('is-transitioning');
                    gsap.set(transitionScribblePath, { strokeWidth: '0%' });
                    gsap.set(transitionLogo, { opacity: 0 });
                }
            });

            // PHASE 1: Draw lines and swell thickness to fill screen
            drawTl.to(transitionScribblePath, { strokeDashoffset: 0, duration: durIn, ease: 'power1.inOut' }, 0);
            drawTl.to(transitionScribblePath, { strokeWidth: config.strokeWidthMax, duration: durIn, ease: 'power2.inOut' }, 0);

            // Trigger scroll to top exactly when screen is fully covered (opacity/color peak)
            drawTl.call(() => {
                window.scrollTo({ top: 0, behavior: 'instant' as any });
            }, [], durIn);

            // PHASE 2: Pop-in the logo with organic hand-drawn stop-motion wiggle
            const targetLogoToWiggle = transitionLogo.querySelector('svg') || 
                                       transitionLogo.querySelector('img') || 
                                       transitionLogo.querySelector('span') || 
                                       transitionLogo;

            drawTl.set(transitionLogo, { autoAlpha: 0 }, 0);
            drawTl.to(transitionLogo, {
                autoAlpha: 1, 
                duration: durIn * 0.5, 
                ease: 'power2.out',
                onStart: () => {
                    // Frame-by-frame mechanical jitter using steps(1) Rotation
                    if (targetLogoToWiggle) {
                        gsap.to(targetLogoToWiggle, { 
                            rotation: 5, 
                            duration: 0.15, 
                            repeat: -1, 
                            yoyo: true, 
                            ease: 'steps(1)', 
                            overwrite: 'auto' 
                        });
                    }
                }
            }, durIn * 0.5);

            // PHASE 3: Continue path movement outwards to bottom-right to clear screen
            drawTl.to(transitionScribblePath, { strokeDashoffset: -l, duration: durOut, ease: 'power2.inOut' }, durIn);
            drawTl.to(transitionScribblePath, { strokeWidth: config.strokeWidthStart, duration: durOut, ease: 'power2.inOut' }, durIn);

            // Smoothly hide logo and terminate the wiggle tween
            drawTl.set(transitionLogo, {
                autoAlpha: 0,
                onComplete: () => {
                    if (targetLogoToWiggle) {
                        gsap.killTweensOf(targetLogoToWiggle);
                        gsap.set(targetLogoToWiggle, { rotation: 0 });
                    }
                }
            }, durIn + (durOut * 0.48));
        };

        // Bind clicks on any matched navbar logo elements
        logoTruusClickable.addEventListener('click', runScribbleAnimation);

        // Run automatically once on mount (as full page load intro transition)
        const timer = setTimeout(() => runScribbleAnimation(null), 100);

        return () => {
            logoTruusClickable.removeEventListener('click', runScribbleAnimation);
            clearTimeout(timer);
        };
    }, []);

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            viewBox="0 0 3222 3114"
            fill="none"
            preserveAspectRatio="none"
            className="transition-scribble"
            style={{ display: 'block' }}
        >
            {/* Hand-drawn scribble path from original Truus SVG vector data */}
            <path
                d="M299.654 453.865C505.574 319.225 711.494 184.585 836.054 109.945C960.614 35.3048 997.574 24.7448 944.014 110.385C890.454 196.025 745.254 378.185 571.454 634.385C397.654 890.585 199.654 1215.3 110.854 1382.58C22.0544 1549.86 48.4544 1549.86 77.8944 1540.62C107.334 1531.38 139.014 1512.9 367.854 1319.9C596.694 1126.9 1021.73 759.945 1255.21 555.065C1488.69 350.185 1517.73 318.505 1527.41 306.145C1537.09 293.785 1526.53 301.705 1346.85 618.625C1167.17 935.545 818.694 1561.22 635.214 1896.74C451.734 2232.26 443.814 2258.66 447.654 2268.3C451.494 2277.94 467.334 2270.02 511.134 2236.9C554.934 2203.78 626.214 2145.7 966.534 1817.46C1306.85 1489.22 1914.05 892.585 2263.81 557.505C2613.57 222.425 2687.49 166.985 2741.41 129.185C2795.33 91.3848 2827.01 72.9048 2843.33 67.3448C2859.65 61.7848 2859.65 69.7048 2849.09 96.2248C2838.53 122.745 2817.41 167.625 2584.77 544.505C2352.13 921.385 1370.37 2165.43 1139.25 2537.83C908.134 2910.23 902.854 2926.07 902.774 2939.51C902.694 2952.95 907.974 2963.51 1255.21 2613.87C1602.45 2264.23 2829.73 1017.54 2903.53 1071.46C2977.33 1125.38 2176.12 2817.04 2128 3037C2079.88 3256.96 2911.24 2018.56 3172 1793"
                stroke="currentColor"
                strokeLinecap="round"
                style={{ strokeWidth: '0%', strokeDashoffset: '0.001', strokeDasharray: '0px, 999999px' }}
            />
        </svg>
    );
};

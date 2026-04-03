/**
 * DevPulse — Magic UI Component Library
 * Hand-coded from Magic UI / Aceternity / custom — zero extra deps.
 *
 * Components:
 * 1. BorderBeam      — rotating gradient light sweep around card border
 * 2. Meteors         — diagonal shooting stars through hero
 * 3. Ripple          — expanding rings from a center point (kill switch)
 * 4. GridPattern     — animated SVG grid background
 * 5. Particles       — floating dot field
 * 6. SpotlightCard   — cursor-tracked spotlight + 3D tilt hover
 * 7. AnimatedNumber  — smooth count-up animation
 * 8. ShimmerButton   — moving light sweep across button
 * 9. TextReveal      — word-by-word blur-fade-up reveal
 * 10. GlowBadge      — pulsing badge with soft glow ring
 * 11. Marquee        — infinite horizontal scroll
 * 12. NumberTicker   — slot-machine style number counter
 */

import React, {
  useEffect, useRef, useState, useMemo, useCallback, CSSProperties, ReactNode
} from 'react';

/* ═══════════════════════════════════════════════════════════════════
   1. BORDER BEAM — rotating gradient light trace around the border
═══════════════════════════════════════════════════════════════════ */
interface BorderBeamProps {
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
  style?: CSSProperties;
}

export function BorderBeam({
  size = 200,
  duration = 8,
  borderWidth = 1.5,
  colorFrom = 'hsl(40,90%,72%)',
  colorTo = 'hsl(195,54%,60%)',
  delay = 0,
  style,
}: BorderBeamProps) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        borderRadius: 'inherit', overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: size, height: size,
          background: `conic-gradient(transparent 330deg, ${colorFrom}, ${colorTo})`,
          borderRadius: '50%',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: `border-beam-spin ${duration}s linear infinite`,
          animationDelay: `${delay}s`,
        }}
      />
      {/* Mask overlay — hides the inside, shows only the border ring */}
      <div style={{
        position: 'absolute',
        inset: borderWidth,
        background: 'inherit',
        borderRadius: 'inherit',
        zIndex: 1,
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   2. METEORS — diagonal shooting-star streaks
═══════════════════════════════════════════════════════════════════ */
interface MeteorsProps { count?: number; minDelay?: number; maxDelay?: number; color?: string; }

export function Meteors({ count = 14, minDelay = 0, maxDelay = 4, color = 'hsl(40,90%,80%)' }: MeteorsProps) {
  const meteors = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: minDelay + Math.random() * (maxDelay - minDelay),
    duration: 0.8 + Math.random() * 0.8,
    width: 80 + Math.random() * 120,
    opacity: 0.4 + Math.random() * 0.5,
  })), [count, minDelay, maxDelay]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {meteors.map(m => (
        <span key={m.id} style={{
          position: 'absolute',
          top: '-4px',
          left: m.left,
          width: m.width,
          height: 1.5,
          background: `linear-gradient(90deg, ${color}, transparent)`,
          opacity: m.opacity,
          transform: 'rotate(-35deg)',
          transformOrigin: 'left center',
          animation: `meteor-fall ${m.duration}s linear ${m.delay}s infinite`,
          boxShadow: `0 0 6px 1px ${color}44`,
        }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   3. RIPPLE — kill switch expanding rings
═══════════════════════════════════════════════════════════════════ */
interface RippleProps {
  color?: string;
  count?: number;
  duration?: number;
  maxRadius?: number;
  style?: CSSProperties;
}

export function Ripple({
  color = 'hsl(4,72%,56%)',
  count = 4,
  duration = 2.4,
  maxRadius = 120,
  style,
}: RippleProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', ...style,
    }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: maxRadius * 2, height: maxRadius * 2,
          borderRadius: '50%',
          border: `1.5px solid ${color}`,
          opacity: 0,
          animation: `ripple-expand ${duration}s ease-out ${(i / count) * duration}s infinite`,
        }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   4. GRID PATTERN — animated SVG grid with fade
═══════════════════════════════════════════════════════════════════ */
interface GridPatternProps {
  width?: number;
  height?: number;
  strokeColor?: string;
  style?: CSSProperties;
}

export function GridPattern({ width = 40, height = 40, strokeColor = 'hsl(40 20% 95% / 0.04)', style }: GridPatternProps) {
  const id = useMemo(() => `gp-${Math.random().toString(36).slice(2)}`, []);
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...style }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse">
          <path d={`M ${width} 0 L 0 0 0 ${height}`} fill="none" stroke={strokeColor} strokeWidth="1" />
        </pattern>
        <radialGradient id={`${id}-fade`} cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} mask={`url(#${id}-mask)`} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   5. PARTICLE FIELD — floating dots
═══════════════════════════════════════════════════════════════════ */
interface ParticlesProps { count?: number; color?: string; style?: CSSProperties; }

export function Particles({ count = 30, color = 'hsl(34,84%,58%)', style }: ParticlesProps) {
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2,
    duration: 6 + Math.random() * 10,
    delay: Math.random() * 8,
    opacity: 0.1 + Math.random() * 0.3,
  })), [count]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', ...style }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: color,
          opacity: p.opacity,
          boxShadow: `0 0 ${p.size * 3}px ${color}`,
          animation: `particle-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   6. SPOTLIGHT CARD — cursor-tracked 3D tilt + spotlight
═══════════════════════════════════════════════════════════════════ */
interface SpotlightCardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  glowColor?: string;
  tiltAmount?: number;
  noBg?: boolean;
  onClick?: () => void;
}

export function SpotlightCard({
  children, style, className = '', glowColor = 'hsl(34 84% 58% / 0.12)',
  tiltAmount = 8, noBg = false, onClick,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0, inside: false });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMouse({ x, y, inside: true });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMouse(m => ({ ...m, inside: false }));
  }, []);

  const tiltX = mouse.inside && ref.current
    ? ((mouse.y / ref.current.offsetHeight) - 0.5) * -tiltAmount
    : 0;
  const tiltY = mouse.inside && ref.current
    ? ((mouse.x / ref.current.offsetWidth) - 0.5) * tiltAmount
    : 0;

  return (
    <div
      ref={ref}
      className={className}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        overflow: 'hidden',
        transform: `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(0)`,
        transition: mouse.inside ? 'transform 50ms linear' : 'transform 400ms cubic-bezier(0.16,1,0.3,1)',
        willChange: 'transform',
        ...style,
      }}
    >
      {/* Spotlight */}
      {mouse.inside && (
        <div style={{
          position: 'absolute',
          width: 300, height: 300,
          background: `radial-gradient(circle, ${glowColor}, transparent 70%)`,
          left: mouse.x - 150, top: mouse.y - 150,
          pointerEvents: 'none',
          transform: 'translateZ(0)',
          zIndex: 0,
          transition: 'opacity 150ms',
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   7. NUMBER TICKER — slot-machine style count-up
═══════════════════════════════════════════════════════════════════ */
interface NumberTickerProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
  color?: string;
  size?: number | string;
}

export function NumberTicker({ value, prefix = '', suffix = '', duration = 1200, decimals = 0, color = 'inherit', size = 28 }: NumberTickerProps) {
  const [current, setCurrent] = useState(0);
  const frameRef = useRef<number>();
  const startRef = useRef<number>();

  useEffect(() => {
    startRef.current = undefined;
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCurrent(+(eased * value).toFixed(decimals));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value, duration, decimals]);

  const fmt = decimals > 0
    ? current.toFixed(decimals)
    : current.toLocaleString();

  return (
    <span style={{
      fontFamily: "'DM Sans', sans-serif", fontWeight: 800,
      fontSize: size, color, lineHeight: 1,
      display: 'inline-block',
    }}>
      {prefix}{fmt}{suffix}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   8. SHIMMER BUTTON — moving light beam across button
═══════════════════════════════════════════════════════════════════ */
interface ShimmerButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  shimmerColor?: string;
  background?: string;
  color?: string;
  style?: CSSProperties;
  className?: string;
}

export function ShimmerButton({
  children, onClick, href,
  shimmerColor = 'rgba(255,255,255,0.15)',
  background = 'linear-gradient(135deg, hsl(34,84%,58%), hsl(34,84%,48%))',
  color = 'hsl(225,16%,5%)',
  style,
  className = '',
}: ShimmerButtonProps) {
  const Tag = href ? 'a' : 'button';

  return (
    <Tag
      href={href}
      onClick={onClick}
      className={className}
      style={{
        position: 'relative', overflow: 'hidden',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '11px 26px',
        background, color,
        borderRadius: 11, border: 'none', cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 700,
        textDecoration: 'none',
        boxShadow: '0 1px 2px hsl(34 84% 30% / 0.3), 0 4px 16px hsl(34 84% 50% / 0.25), inset 0 1px 0 rgba(255,255,255,0.25)',
        transition: 'all 160ms cubic-bezier(0.16,1,0.3,1)',
        willChange: 'transform, box-shadow',
        ...style,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = '0 2px 4px hsl(34 84% 30% / 0.3), 0 8px 28px hsl(34 84% 50% / 0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = '';
        el.style.boxShadow = '0 1px 2px hsl(34 84% 30% / 0.3), 0 4px 16px hsl(34 84% 50% / 0.25), inset 0 1px 0 rgba(255,255,255,0.25)';
      }}
    >
      {/* Shimmer beam */}
      <span style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(105deg, transparent 30%, ${shimmerColor} 50%, transparent 70%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer-sweep 2.4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
        {children}
      </span>
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   9. TEXT REVEAL — word-by-word blur + fade up
═══════════════════════════════════════════════════════════════════ */
interface TextRevealProps { text: string; delay?: number; color?: string; size?: number | string; fontFamily?: string; fontWeight?: number | string; }

export function TextReveal({ text, delay = 0, color = 'inherit', size = 'inherit', fontFamily = 'inherit', fontWeight = 'inherit' }: TextRevealProps) {
  const words = text.split(' ');
  return (
    <span style={{ display: 'inline', color, fontSize: size, fontFamily, fontWeight }}>
      {words.map((word, i) => (
        <span key={i} style={{
          display: 'inline-block',
          marginRight: '0.3em',
          opacity: 0,
          filter: 'blur(6px)',
          animation: `word-reveal 500ms cubic-bezier(0.16,1,0.3,1) ${delay + i * 80}ms forwards`,
        }}>
          {word}
        </span>
      ))}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   10. GLOW BADGE — pulsing badge with outer glow ring
═══════════════════════════════════════════════════════════════════ */
interface GlowBadgeProps { children: ReactNode; color?: string; bg?: string; border?: string; style?: CSSProperties; }

export function GlowBadge({ children, color = 'hsl(34,84%,72%)', bg = 'hsl(34 84% 58% / 0.12)', border = 'hsl(34 84% 58% / 0.3)', style }: GlowBadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 13px', borderRadius: 999,
      background: bg, border: `1px solid ${border}`,
      color, fontSize: 10.5, fontWeight: 800,
      fontFamily: "'DM Mono', monospace", letterSpacing: '0.09em', textTransform: 'uppercase',
      position: 'relative',
      ...style,
    }}>
      {/* Pulse dot */}
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color,
        boxShadow: `0 0 0 0 ${color}`,
        animation: 'pulse-badge 2s ease-out infinite',
        flexShrink: 0,
      }} />
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   11. MARQUEE — infinite horizontal ticker
═══════════════════════════════════════════════════════════════════ */
interface MarqueeProps { items: ReactNode[]; speed?: number; direction?: 'left' | 'right'; style?: CSSProperties; }

export function Marquee({ items, speed = 40, direction = 'left', style }: MarqueeProps) {
  const doubled = [...items, ...items];
  return (
    <div style={{ overflow: 'hidden', position: 'relative', ...style }}>
      {/* Fade masks */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, background: 'linear-gradient(to right, var(--col-bg), transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: 'linear-gradient(to left, var(--col-bg), transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{
        display: 'flex', gap: 24, whiteSpace: 'nowrap',
        animation: `marquee-${direction} ${speed}s linear infinite`,
        width: 'max-content',
      }}>
        {doubled.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>{item}</div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KEYFRAME INJECTION — all animations in one <style> tag
═══════════════════════════════════════════════════════════════════ */
export function MagicKeyframes() {
  return (
    <style>{`
      /* 1. BorderBeam spin */
      @keyframes border-beam-spin {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
      }

      /* 2. Meteors */
      @keyframes meteor-fall {
        0%   { transform: rotate(-35deg) translateX(-100px); opacity: 0; }
        5%   { opacity: 1; }
        85%  { opacity: 1; }
        100% { transform: rotate(-35deg) translateX(calc(100vw + 200px)); opacity: 0; }
      }

      /* 3. Ripple expand */
      @keyframes ripple-expand {
        0%   { transform: scale(0); opacity: 0.8; }
        100% { transform: scale(1); opacity: 0; }
      }

      /* 5. Particle float */
      @keyframes particle-float {
        0%, 100% { transform: translateY(0) translateX(0); opacity: 0.15; }
        33%       { transform: translateY(-12px) translateX(6px); opacity: 0.35; }
        66%       { transform: translateY(8px) translateX(-4px); opacity: 0.2; }
      }

      /* 8. Shimmer button sweep */
      @keyframes shimmer-sweep {
        0%   { background-position: -200% 0; }
        60%  { background-position: 200% 0; }
        100% { background-position: 200% 0; }
      }

      /* 9. Word reveal */
      @keyframes word-reveal {
        to { opacity: 1; filter: blur(0); transform: translateY(0); }
        from { opacity: 0; filter: blur(8px); transform: translateY(6px); }
      }

      /* 10. Pulse badge */
      @keyframes pulse-badge {
        0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
        50%       { box-shadow: 0 0 0 5px transparent; opacity: 0.7; }
      }

      /* 11. Marquee */
      @keyframes marquee-left  { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      @keyframes marquee-right { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }

      /* Shared: spin */
      @keyframes spin { to { transform: rotate(360deg); } }
      
      /* Shared: fade-up */
      @keyframes fade-up {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .fade-up { animation: fade-up 450ms cubic-bezier(0.16,1,0.3,1) both; }

      /* Shared: count-in */
      @keyframes count-in {
        from { opacity: 0; transform: translateY(8px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      .count-in { animation: count-in 550ms cubic-bezier(0.16,1,0.3,1) both; }

      /* Status pulse ring */
      @keyframes pulse-ring {
        0%   { opacity: 0.7; transform: scale(1); }
        70%  { opacity: 0; transform: scale(2.4); }
        100% { opacity: 0; transform: scale(2.4); }
      }
      .pulse-ring::after {
        content: '';
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        border: 1.5px solid currentColor;
        opacity: 0;
        animation: pulse-ring 2.4s ease-out infinite;
      }
    `}</style>
  );
}

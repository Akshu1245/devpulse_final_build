import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

function HeartbeatLine({ reduced }: { reduced: boolean }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength());
  }, []);

  return (
    <svg viewBox="0 0 1200 120" className="w-full h-[56px] md:h-[72px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pulse-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          <stop offset="30%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          <stop offset="50%" stopColor="hsl(162 70% 44%)" stopOpacity="1" />
          <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <line x1="0" y1="60" x2="1200" y2="60" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.1" strokeWidth="1" />
      <motion.path
        ref={pathRef}
        d="M0,60 L300,60 L340,60 L360,45 L380,60 L420,60 L440,60 L455,85 L470,10 L485,75 L500,55 L520,60 L560,60 L590,48 L620,60 L700,60 L740,60 L760,45 L780,60 L820,60 L840,60 L855,85 L870,10 L885,75 L900,55 L920,60 L960,60 L990,48 L1020,60 L1200,60"
        fill="none"
        stroke="url(#pulse-grad)"
        strokeWidth="2.5"
        filter="url(#glow)"
        initial={reduced ? false : { strokeDasharray: length, strokeDashoffset: length }}
        animate={reduced ? undefined : { strokeDashoffset: 0 }}
        transition={reduced ? undefined : { duration: 2.3, delay: 0.4, ease: "easeInOut" }}
      />
    </svg>
  );
}

const statusCards = [
  { name: "Stripe API", status: "healthy", latency: "42ms", uptime: "99.98%" },
  { name: "GitHub API", status: "healthy", latency: "89ms", uptime: "99.95%" },
  { name: "OpenAI API", status: "degraded", latency: "340ms", uptime: "99.12%" },
  { name: "AWS S3", status: "healthy", latency: "28ms", uptime: "99.99%" },
];

function StatusCard({ card, index, reduced }: { card: typeof statusCards[0]; index: number; reduced: boolean }) {
  const isHealthy = card.status === "healthy";
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20, scale: 0.95 }}
      animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={reduced ? undefined : { delay: 0.2 + index * 0.08, duration: 0.4 }}
      className="glass-card rounded-xl px-4 py-3 min-w-[150px] border border-border/30"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-status-healthy animate-pulse-soft" : "bg-status-degraded animate-pulse"}`} />
        <span className="text-xs font-mono font-medium text-foreground/90 truncate">{card.name}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground font-mono">{card.latency}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{card.uptime}</span>
      </div>
    </motion.div>
  );
}

function AnimatedTitle({ reduced }: { reduced: boolean }) {
  const devLetters = "Dev".split("");
  const pulseLetters = "Pulse".split("");

  return (
    <div className="flex items-center justify-center gap-1 select-none">
      <span className="flex">
        {devLetters.map((char, i) => (
          <motion.span
            key={`dev-${i}`}
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.08 + i * 0.07, duration: 0.35 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight font-serif text-foreground inline-block"
          >
            {char}
          </motion.span>
        ))}
      </span>
      <span className="flex">
        {pulseLetters.map((char, i) => (
          <motion.span
            key={`pulse-${i}`}
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.28 + i * 0.07, duration: 0.35 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight font-serif text-primary text-glow-primary inline-block"
          >
            {char}
          </motion.span>
        ))}
      </span>
    </div>
  );
}

function OrbitDot({ delay, radius, duration, color, reduced }: { delay: number; radius: number; duration: number; color: string; reduced: boolean }) {
  if (reduced) return null;
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{ background: color, boxShadow: `0 0 12px ${color}` }}
      animate={{ x: [radius, 0, -radius, 0, radius], y: [0, radius * 0.5, 0, -radius * 0.5, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
    />
  );
}

export default function HeroAnimation3D() {
  const reduced = !!useReducedMotion();
  const [showCards, setShowCards] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCards(true), reduced ? 80 : 900);
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <div className="w-full relative py-2">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          <OrbitDot delay={0} radius={180} duration={12} color="hsl(192 70% 55%)" reduced={reduced} />
          <OrbitDot delay={3} radius={140} duration={10} color="hsl(162 70% 44%)" reduced={reduced} />
          <OrbitDot delay={6} radius={220} duration={15} color="hsl(38 60% 55%)" reduced={reduced} />
        </div>
      </div>

      <div className="mb-4">
        <AnimatedTitle reduced={reduced} />
      </div>

      <motion.div
        initial={reduced ? false : { opacity: 0 }}
        animate={reduced ? undefined : { opacity: 1 }}
        transition={reduced ? undefined : { duration: 0.4 }}
        className="max-w-4xl mx-auto mb-5 px-4"
      >
        <HeartbeatLine reduced={reduced} />
      </motion.div>

      <AnimatePresence>
        {showCards && (
          <div className="flex flex-wrap justify-center gap-3 px-4">
            {statusCards.map((card, i) => (
              <StatusCard key={card.name} card={card} index={i} reduced={reduced} />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

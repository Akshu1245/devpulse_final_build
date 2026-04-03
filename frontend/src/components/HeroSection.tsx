import { lazy, Suspense, memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Zap, GitBranch, Code2, Search, Shield } from "lucide-react";

const HeroAnimation3D = lazy(() => import("./HeroAnimation3D"));

const features = [
  { icon: Activity, label: "Health Monitor" },
  { icon: GitBranch, label: "Compatibility" },
  { icon: Code2, label: "Code Gen" },
  { icon: Search, label: "Doc Search" },
  { icon: Shield, label: "Rate Limits" },
  { icon: Zap, label: "Real time" },
];

const FeaturePill = memo(function FeaturePill({ icon: Icon, label, index, reduced }: { icon: any; label: string; index: number; reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      transition={reduced ? undefined : { delay: 0.06 + index * 0.03, duration: 0.2 }}
      className="card-3d"
    >
      <div className="card-3d-inner glass-card-hover gradient-border px-4 py-2.5 rounded-xl flex items-center gap-2.5 cursor-default">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground/90">{label}</span>
      </div>
    </motion.div>
  );
});

export default function HeroSection() {
  const reduced = !!useReducedMotion();

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 mb-8">
      <div className="absolute inset-0 ambient-bg" />
      <div className="absolute inset-0 dot-grid opacity-60" />
      <div className="absolute inset-0 noise-overlay" />

      <div className="relative z-10 text-center px-6 pt-12 pb-10 max-w-5xl mx-auto">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? undefined : { duration: 0.25 }}
          className="inline-flex items-center gap-2.5 glass-card px-5 py-2.5 rounded-full mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-status-healthy animate-pulse-soft" />
          <span className="text-sm text-muted-foreground font-mono tracking-wide">
            MONITORING <span className="text-status-healthy font-medium">LIVE</span> API HEALTH
          </span>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.98 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={reduced ? undefined : { duration: 0.3, delay: 0.03 }}
          className="mb-7"
        >
          <Suspense fallback={<div className="h-[220px] md:h-[260px]" />}>
            <HeroAnimation3D />
          </Suspense>
        </motion.div>

        <motion.p
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? undefined : { duration: 0.28, delay: 0.1 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed font-light"
        >
          Real time API intelligence for security scanning, spend analytics, and agent reliability.
        </motion.p>

        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={reduced ? undefined : { opacity: 1 }}
          transition={reduced ? undefined : { duration: 0.25, delay: 0.12 }}
          className="flex flex-wrap justify-center gap-3"
        >
          {features.map((f, i) => (
            <FeaturePill key={f.label} icon={f.icon} label={f.label} index={i} reduced={reduced} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

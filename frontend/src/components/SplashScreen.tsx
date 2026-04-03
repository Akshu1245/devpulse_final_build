import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const bootMessages = [
  { text: "> Initializing DevPulse core...", type: "muted" },
  { text: "> Loading probe modules...", type: "muted" },
  { text: "> Scanning API endpoints...", type: "muted" },
  { text: "> Stripe .......... ONLINE", type: "ok" },
  { text: "> GitHub .......... ONLINE", type: "ok" },
  { text: "> OpenAI .......... DEGRADED", type: "warn" },
  { text: "> AWS S3 .......... ONLINE", type: "ok" },
  { text: "> Launching dashboard...", type: "muted" },
];

type Props = {
  done: boolean;
  onDone: () => void;
};

export default function SplashScreen({ done, onDone }: Props) {
  const reduced = !!useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState(0);

  useEffect(() => {
    if (done) return;

    let timer: number;
    if (reduced) {
      timer = window.setTimeout(onDone, 900);
      return () => window.clearTimeout(timer);
    }

    // Auto-start quickly so users are not blocked.
    timer = window.setTimeout(() => setPressed(true), 350);
    return () => window.clearTimeout(timer);
  }, [done, onDone, reduced]);

  useEffect(() => {
    if (!pressed || done) return;

    let raf = 0;
    const start = performance.now();
    const duration = reduced ? 450 : 1500;

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setProgress(Math.floor(t * 100));
      const visible = Math.floor((t * bootMessages.length) + 0.0001);
      setLines(Math.max(1, Math.min(bootMessages.length, visible)));
      if (t < 1) raf = requestAnimationFrame(step);
      else onDone();
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pressed, done, onDone, reduced]);

  const visibleLines = useMemo(() => bootMessages.slice(0, lines || 1), [lines]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.2 : 0.45 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "radial-gradient(ellipse at center, hsl(225 14% 7%), hsl(225 14% 5%))",
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "min(680px, 100%)",
              display: "grid",
              justifyItems: "center",
              gap: 18,
            }}
          >
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, fontStyle: "italic", fontWeight: 800, lineHeight: 1 }}>
              <span style={{ color: "hsl(40 20% 95%)" }}>Dev </span>
              <span style={{ color: "hsl(34 80% 56%)", textShadow: "0 0 18px hsl(34 80% 56% / 0.35)" }}>Pulse</span>
            </div>

            <div style={{ position: "relative", width: 220, height: 220, display: "grid", placeItems: "center" }}>
              {[90, 140, 190].map((r, i) => (
                <div
                  key={r}
                  style={{
                    position: "absolute",
                    width: r,
                    height: r,
                    borderRadius: "50%",
                    border: `1px solid hsl(34 80% 56% / ${0.06 - i * 0.012})`,
                  }}
                />
              ))}

              <div
                style={{
                  width: 128,
                  height: 128,
                  borderRadius: "50%",
                  border: "4px solid hsl(34 80% 56%)",
                  boxShadow: "0 0 30px hsl(34 80% 56% / 0.4)",
                  display: "grid",
                  placeItems: "center",
                  background: "hsl(225 14% 8%)",
                }}
              >
                <div style={{ color: "hsl(34 80% 56%)", fontSize: 46, lineHeight: 1 }}>⏻</div>
              </div>
            </div>

            <div
              style={{
                width: "min(560px, 100%)",
                borderRadius: 16,
                border: "1px solid hsl(225 10% 18%)",
                background: "hsl(225 14% 8% / 0.88)",
                boxShadow: "0 12px 40px hsl(225 14% 3% / 0.55)",
                backdropFilter: "blur(10px)",
                padding: "16px 18px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: 5,
                  width: "100%",
                  borderRadius: 999,
                  background: "hsl(225 10% 15%)",
                  marginBottom: 12,
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.08, ease: "linear" }}
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, hsl(34 80% 56%), hsl(195 50% 45%))",
                  }}
                />
              </div>

              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, lineHeight: 1.55 }}>
                {visibleLines.map((line, i) => {
                  const color =
                    line.type === "ok"
                      ? "hsl(160 45% 56%)"
                      : line.type === "warn"
                        ? "hsl(34 80% 56%)"
                        : "hsl(225 10% 62%)";
                  return (
                    <div key={`${line.text}-${i}`} style={{ color, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {line.text}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

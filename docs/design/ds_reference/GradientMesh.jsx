import React from "react";

const meshPresets = {
  hero: [
    { c: "var(--mesh-cream)", x: "8%", y: "30%", w: "46%", h: "120%", o: 1 },
    { c: "var(--mesh-orange)", x: "30%", y: "10%", w: "34%", h: "90%", o: 0.9 },
    { c: "var(--mesh-magenta)", x: "52%", y: "-10%", w: "30%", h: "90%", o: 0.8 },
    { c: "var(--mesh-lavender)", x: "62%", y: "40%", w: "36%", h: "110%", o: 0.9 },
    { c: "var(--mesh-indigo)", x: "80%", y: "0%", w: "34%", h: "100%", o: 0.9 },
    { c: "var(--mesh-ruby)", x: "46%", y: "60%", w: "22%", h: "70%", o: 0.55 },
  ],
  cool: [
    { c: "var(--mesh-lavender)", x: "10%", y: "20%", w: "50%", h: "120%", o: 0.9 },
    { c: "var(--mesh-indigo)", x: "55%", y: "0%", w: "40%", h: "110%", o: 0.85 },
    { c: "var(--mesh-magenta)", x: "85%", y: "50%", w: "28%", h: "80%", o: 0.6 },
  ],
  warm: [
    { c: "var(--mesh-cream)", x: "0%", y: "20%", w: "60%", h: "120%", o: 1 },
    { c: "var(--mesh-orange)", x: "45%", y: "10%", w: "40%", h: "100%", o: 0.85 },
    { c: "var(--mesh-ruby)", x: "80%", y: "40%", w: "28%", h: "80%", o: 0.5 },
  ],
};

export function GradientMesh({ preset = "hero", skew = true, height = "100%", fadeBottom = true, style }) {
  const blobs = meshPresets[preset] || meshPresets.hero;
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, height, overflow: "hidden", pointerEvents: "none", background: "var(--canvas)", ...style }}>
      <div style={{ position: "absolute", inset: "-20% -10%", transform: skew ? "skewY(-8deg)" : "none", transformOrigin: "0 0", filter: "blur(60px) saturate(1.15)" }}>
        {blobs.map((b, i) => (
          <div key={i} style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, background: b.c, opacity: b.o, borderRadius: "50%", transform: "translate(-20%,-20%)" }} />
        ))}
      </div>
      {fadeBottom && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "35%", background: "linear-gradient(to bottom, rgba(255,255,255,0), var(--canvas))" }} />}
    </div>
  );
}

// Port GradientMesh preset "hero" dari docs/design/ds_reference/GradientMesh.jsx.
const blobs = [
  { c: 'var(--mesh-cream)', x: '8%', y: '30%', w: '46%', h: '120%', o: 1 },
  { c: 'var(--mesh-orange)', x: '30%', y: '10%', w: '34%', h: '90%', o: 0.9 },
  { c: 'var(--mesh-magenta)', x: '52%', y: '-10%', w: '30%', h: '90%', o: 0.8 },
  { c: 'var(--mesh-lavender)', x: '62%', y: '40%', w: '36%', h: '110%', o: 0.9 },
  { c: 'var(--mesh-indigo)', x: '80%', y: '0%', w: '34%', h: '100%', o: 0.9 },
  { c: 'var(--mesh-ruby)', x: '46%', y: '60%', w: '22%', h: '70%', o: 0.55 },
]

export function GradientMesh() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-background">
      <div className="absolute -inset-x-[10%] -inset-y-[20%] origin-top-left -skew-y-[8deg] blur-[60px] saturate-[1.15]">
        {blobs.map((b, i) => (
          <div
            key={i}
            className="absolute -translate-x-1/5 -translate-y-1/5 rounded-full"
            style={{ left: b.x, top: b.y, width: b.w, height: b.h, background: b.c, opacity: b.o }}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-b from-white/0 to-background" />
    </div>
  )
}

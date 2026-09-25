import React from "react";

const btnBase = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  fontFamily: "var(--font-sans)", fontWeight: 400, lineHeight: 1, letterSpacing: 0,
  fontFeatureSettings: '"ss01"', borderRadius: "var(--radius-pill)", border: "1px solid transparent",
  cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none",
  transition: "background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast), border-color var(--dur-fast)",
};

const btnVariants = {
  primary: { rest: { background: "var(--primary)", color: "var(--on-primary)" }, hover: { background: "var(--primary-deep)" }, press: { background: "var(--primary-press)" } },
  secondary: { rest: { background: "var(--canvas)", color: "var(--primary)", borderColor: "var(--primary)" }, hover: { background: "#f2f0ff" }, press: { background: "#e6e2ff" } },
  "on-dark": { rest: { background: "var(--brand-dark-900)", color: "var(--on-primary)" }, hover: { background: "#2a2d6e" }, press: { background: "#12143a" } },
  inverse: { rest: { background: "var(--canvas)", color: "var(--brand-dark-900)" }, hover: { background: "#eef0ff" }, press: { background: "#dcdfff" } },
  ghost: { rest: { background: "transparent", color: "var(--primary)" }, hover: { color: "var(--primary-deep)" }, press: { color: "var(--primary-press)" } },
};

const btnSizes = {
  md: { fontSize: "var(--button-md-size)", padding: "8px 16px", minHeight: 36 },
  sm: { fontSize: "var(--button-sm-size)", padding: "8px 16px", minHeight: 32 },
  lg: { fontSize: "var(--button-md-size)", padding: "12px 20px", minHeight: 44 },
};

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function Button({ variant = "primary", size = "md", arrow = false, disabled = false, pressed, href, onClick, children, style, type = "button" }) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const v = btnVariants[variant] || btnVariants.primary;
  const isPressed = pressed ?? down;
  const s = {
    ...btnBase, ...btnSizes[size], ...v.rest,
    ...(hover && !disabled ? v.hover : null),
    ...(isPressed && !disabled ? v.press : null),
    ...(variant === "ghost" ? { padding: 0, minHeight: 0 } : null),
    ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : null),
    ...style,
  };
  const handlers = {
    onMouseEnter: () => setHover(true), onMouseLeave: () => { setHover(false); setDown(false); },
    onMouseDown: () => setDown(true), onMouseUp: () => setDown(false),
    onClick: disabled ? undefined : onClick,
  };
  const content = <>{children}{arrow && <Chevron />}</>;
  if (href) return <a href={href} style={s} {...handlers}>{content}</a>;
  return <button type={type} disabled={disabled} style={s} {...handlers}>{content}</button>;
}

import React from "react";

const tagTones = {
  soft: { background: "var(--primary-bg-subdued-hover)", color: "var(--primary-deep)" },
  neutral: { background: "var(--hairline)", color: "var(--ink-secondary)" },
  success: { background: "var(--status-success-bg)", color: "var(--status-success-text)" },
  warning: { background: "var(--status-warning-bg)", color: "var(--status-warning-text)" },
  danger: { background: "var(--status-danger-bg)", color: "#b3093c" },
};

export function Tag({ tone = "soft", caps = true, children, style }) {
  const t = tagTones[tone] || tagTones.soft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, borderRadius: "var(--radius-pill)", padding: "4px 8px",
      fontFamily: "var(--font-sans)", fontWeight: 400, whiteSpace: "nowrap",
      ...(caps ? { fontSize: 10, lineHeight: 1.15, letterSpacing: "0.1px", textTransform: "uppercase" } : { fontSize: 12, lineHeight: 1.15 }),
      ...t, ...style,
    }}>{children}</span>
  );
}

import React from "react";

export function TextInput({ label, placeholder, value, defaultValue, onChange, helper, error, type = "text", disabled = false, focused, prefix, style }) {
  const [focus, setFocus] = React.useState(false);
  const isFocus = focused ?? focus;
  const border = error ? "var(--ruby)" : isFocus ? "var(--primary)" : "var(--hairline-input)";
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-sans)", ...style }}>
      {label && <span style={{ fontSize: 14, fontWeight: 400, color: "var(--ink-secondary)" }}>{label}</span>}
      <span style={{
        display: "flex", alignItems: "center", gap: 8, background: disabled ? "var(--canvas-soft)" : "var(--canvas)",
        border: `1px solid ${border}`, borderRadius: "var(--radius-sm)", padding: "8px 12px", minHeight: 40, boxSizing: "border-box",
        boxShadow: isFocus && !error ? "var(--focus-ring)" : "none", transition: "border-color var(--dur-fast), box-shadow var(--dur-fast)",
      }}>
        {prefix && <span style={{ color: "var(--ink-mute)", fontSize: 15 }}>{prefix}</span>}
        <input
          type={type} placeholder={placeholder} value={value} defaultValue={defaultValue} disabled={disabled}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", font: "inherit", fontSize: 15, fontWeight: 300, color: "var(--ink)", fontFeatureSettings: '"ss01"', padding: 0 }}
        />
      </span>
      {(error || helper) && <span style={{ fontSize: 13, letterSpacing: "-0.39px", color: error ? "var(--ruby)" : "var(--ink-mute)" }}>{error || helper}</span>}
    </label>
  );
}

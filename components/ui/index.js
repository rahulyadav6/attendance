/* ── Card ── */
export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 10,
      border: "1px solid var(--gray-200)", ...style,
    }}>
      {children}
    </div>
  );
}

/* ── StatCard ── */
export function StatCard({ label, value, sub, subColor = "var(--gray-400)", accentColor }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 10,
      border: "1px solid var(--gray-200)", padding: "16px 18px",
    }}>
      <div style={{ fontSize: 10, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace",
                    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: accentColor || "var(--gray-900)",
                    lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: subColor, marginTop: 6,
                      display: "flex", alignItems: "center", gap: 5 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ── Badge ── */
const badgeStyles = {
  present: { background: "var(--teal-50)",  color: "var(--teal-800)"  },
  absent:  { background: "#FCEBEB",         color: "#791F1F"           },
  late:    { background: "#FAEEDA",         color: "#633806"           },
  qr:      { background: "var(--teal-50)",  color: "var(--teal-600)"  },
  face:    { background: "#EAF3DE",         color: "#27500A"           },
  manual:  { background: "var(--gray-100)", color: "var(--gray-700)"  },
};

export function Badge({ type, label }) {
  const s = badgeStyles[type] || badgeStyles.manual;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 9px", borderRadius: 5,
      fontSize: 10, fontWeight: 500,
      fontFamily: "'DM Mono', monospace",
      ...s,
    }}>
      {label || type}
    </span>
  );
}

/* ── Button ── */
export function Button({ children, onClick, variant = "primary", disabled = false, style = {}, type = "button" }) {
  const variants = {
    primary: {
      background: disabled ? "var(--teal-600)" : "var(--teal-400)",
      color: "#fff", border: "none",
    },
    ghost: {
      background: "var(--gray-100)", color: "var(--gray-700)",
      border: "1px solid var(--gray-200)",
    },
    danger: {
      background: "#FCEBEB", color: "#791F1F",
      border: "1px solid #F7C1C1",
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 16px", borderRadius: 8,
        fontSize: 13, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        transition: "opacity 0.15s",
        opacity: disabled ? 0.6 : 1,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ── Spinner ── */
export function Spinner({ size = 24, color = "var(--teal-400)" }) {
  return (
    <>
      <div style={{
        width: size, height: size,
        border: `3px solid var(--gray-200)`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

/* ── Empty state ── */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--gray-700)", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "var(--gray-400)", marginBottom: 20 }}>
        {description}
      </div>
      {action}
    </div>
  );
}

/* ── Modal ── */
export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(26,40,32,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480,
          border: "1px solid var(--gray-200)", overflow: "hidden",
        }}
      >
        <div style={{
          padding: "18px 22px", borderBottom: "1px solid var(--gray-100)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--gray-900)" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer",
                     fontSize: 18, color: "var(--gray-400)", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "22px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Input ── */
export function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: "block", fontSize: 12, fontWeight: 500,
                        color: "var(--gray-700)", marginBottom: 6 }}>
          {label}
        </label>
      )}
      <input
        style={{
          width: "100%", padding: "9px 12px",
          border: "1px solid var(--gray-200)", borderRadius: 8,
          fontSize: 13, color: "var(--gray-900)",
          fontFamily: "'DM Sans', system-ui, sans-serif", outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => e.target.style.borderColor = "var(--teal-400)"}
        onBlur={(e)  => e.target.style.borderColor = "var(--gray-200)"}
        {...props}
      />
    </div>
  );
}

/* ── Select ── */
export function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: "block", fontSize: 12, fontWeight: 500,
                        color: "var(--gray-700)", marginBottom: 6 }}>
          {label}
        </label>
      )}
      <select
        style={{
          width: "100%", padding: "9px 12px",
          border: "1px solid var(--gray-200)", borderRadius: 8,
          fontSize: 13, color: "var(--gray-900)",
          fontFamily: "'DM Sans', system-ui, sans-serif", outline: "none",
          background: "#fff", cursor: "pointer",
        }}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

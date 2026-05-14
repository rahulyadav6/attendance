export default function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "#fff", borderBottom: "1px solid var(--gray-200)",
      padding: "0 28px", height: 58,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "var(--gray-900)", margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 11, color: "var(--gray-400)", margin: 0,
                      fontFamily: "'DM Mono', monospace" }}>
            {subtitle}
          </p>
        )}
      </div>
      {children && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{children}</div>}
    </div>
  );
}

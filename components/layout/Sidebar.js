"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  {
    section: "overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
    ],
  },
  {
    section: "manage",
    items: [
      { href: "/sections",  label: "Sections",  icon: SectionsIcon  },
      { href: "/students",  label: "Students",  icon: StudentsIcon  },
    ],
  },
  {
    section: "attendance",
    items: [
      { href: "/attendance/qr",     label: "QR Attendance",   icon: QRIcon     },
      { href: "/attendance/face",   label: "Face Recognition", icon: FaceIcon   },
      { href: "/attendance/manual", label: "Manual Mark",      icon: ManualIcon },
    ],
  },
  {
    section: "reports",
    items: [
      { href: "/analytics", label: "Analytics", icon: AnalyticsIcon },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { teacher, logout } = useAuth();

  const initials = teacher?.name
    ? teacher.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "T";

  return (
    <aside style={{
      position: "fixed", top: 0, left: 0, bottom: 0,
      width: 220, overflowY: "auto", background: "var(--dark-900)",
      display: "flex", flexDirection: "column", zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: "var(--teal-400)",
            borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>AttendIQ</div>
            <div style={{ fontSize: 10, color: "var(--teal-200)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em" }}>
              teacher portal
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "14px 10px", flex: 1 }}>
        {navItems.map(({ section, items }) => (
          <div key={section}>
            <div style={{
              fontSize: 10, color: "rgba(255,255,255,0.3)",
              fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
              padding: "10px 10px 5px", textTransform: "uppercase",
            }}>
              {section}
            </div>
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link key={href} href={href} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "9px 10px", borderRadius: 7, marginBottom: 2,
                    background: active ? "var(--teal-400)" : "transparent",
                    color: active ? "#fff" : "rgba(255,255,255,0.5)",
                    fontSize: 13, fontWeight: active ? 500 : 400,
                    transition: "all 0.15s", cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = active ? "#fff" : "rgba(255,255,255,0.85)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = active ? "#fff" : "rgba(255,255,255,0.5)"; }}
                  >
                    <Icon />
                    <span>{label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Teacher footer */}
      <div style={{ padding: "14px 14px 18px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 33, height: 33, borderRadius: 8,
            background: "var(--teal-600)", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 600, color: "var(--teal-50)", flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {teacher?.name || "Teacher"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)",
                          fontFamily: "'DM Mono', monospace",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {teacher?.email || ""}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            width: "100%", padding: "7px 10px", borderRadius: 7,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer",
            fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: "left",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(226,75,74,0.15)"; e.currentTarget.style.color = "#f08080"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

/* ── Icons ── */
function DashboardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="2" width="5" height="5" rx="1.5"/>
      <rect x="9" y="2" width="5" height="5" rx="1.5"/>
      <rect x="2" y="9" width="5" height="5" rx="1.5"/>
      <rect x="9" y="9" width="5" height="5" rx="1.5"/>
    </svg>
  );
}
function SectionsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4h12M2 8h8M2 12h10"/>
    </svg>
  );
}
function StudentsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5" r="3"/>
      <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
    </svg>
  );
}
function QRIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="2" width="5" height="5" rx="0.5"/>
      <rect x="9" y="2" width="5" height="5" rx="0.5"/>
      <rect x="2" y="9" width="5" height="5" rx="0.5"/>
      <path d="M9 9h1M12 9v1M9 12h4M12 11v2"/>
    </svg>
  );
}
function ManualIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 2v1m8-1v1M2 6h12M4 10h1M7 10h1M10 10h2M4 13h2M8 13h1m3-1v3" />
      <rect x="2" y="3" width="12" height="11" rx="1" />
    </svg>
  );
}
function FaceIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6"/>
      <path d="M6 9.5c.5.7 2.5.7 3 0"/>
      <circle cx="6.5" cy="7" r="0.5" fill="currentColor"/>
      <circle cx="9.5" cy="7" r="0.5" fill="currentColor"/>
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 14V8M6 14V5M10 14V9M14 14V3"/>
    </svg>
  );
}

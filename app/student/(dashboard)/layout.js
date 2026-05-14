"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

export default function StudentDashboardLayout({ children }) {
  const { student, loading, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !student) router.push("/student/login");
  }, [student, loading, router]);

  if (loading || !student) return null;

  const navLinks = [
    { href: "/student/dashboard", label: "Dashboard", icon: HomeIcon },
    { href: "/student/profile",   label: "Profile",   icon: UserIcon },
  ];

  return (
    <div style={{ display: "block", fontFamily: "'DM Sans', system-ui, sans-serif", background: "var(--gray-50)" }}>
      {/* Sidebar */}
      <aside style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 220, overflowY: "auto", background: "#fff", borderRight: "1px solid var(--gray-200)", display: "flex", flexDirection: "column", zIndex: 100 }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--gray-100)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "var(--teal-400)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-900)" }}>AttendIQ</div>
              <div style={{ fontSize: 10, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>student</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                  background: active ? "var(--teal-50)" : "transparent",
                  color: active ? "var(--teal-700)" : "var(--gray-500)",
                  fontWeight: active ? 600 : 400, fontSize: 13,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "var(--gray-50)"; e.currentTarget.style.color = "var(--gray-700)"; }}}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--gray-500)"; }}}
                >
                  <Icon />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid var(--gray-100)" }}>
          <div style={{ padding: "10px 12px", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-900)" }}>{student.name}</div>
            <div style={{ fontSize: 11, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>{student.studentId}</div>
          </div>
          <button
            onClick={logout}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--gray-200)", background: "transparent", color: "var(--gray-500)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#FCEBEB"; e.currentTarget.style.color = "#791F1F"; e.currentTarget.style.borderColor = "#F7C1C1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--gray-500)"; e.currentTarget.style.borderColor = "var(--gray-200)"; }}
          >
            <LogoutIcon /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: 220, minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}

function HomeIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5L8 1l6 5.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5z"/></svg>;
}
function UserIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13 14v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="8" cy="5" r="3"/></svg>;
}
function LogoutIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 14H2V2h4M10 11l3-3-3-3M13 8H6"/></svg>;
}

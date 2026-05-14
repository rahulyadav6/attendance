"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }) {
  const { teacher, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !teacher) router.push("/login");
  }, [teacher, loading, router]);

  if (loading || !teacher) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "var(--gray-50)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 36, height: 36, border: "3px solid var(--teal-100)",
            borderTopColor: "var(--teal-400)", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", margin: "0 auto 12px",
          }}/>
          <p style={{ fontSize: 13, color: "var(--gray-400)" }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "block" }}>
      <Sidebar />
      <main style={{ marginLeft: 220, minHeight: "100vh", background: "var(--gray-50)" }}>
        {children}
      </main>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";

export default function StudentLoginPage() {
  const { studentLogin } = useAuth();
  const [form, setForm]       = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await studentLogin(form.identifier, form.password);
      toast.success("Welcome!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gray-50)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: "var(--teal-400)", borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--gray-900)", marginBottom: 4 }}>Student Portal</h1>
          <p style={{ fontSize: 13, color: "var(--gray-400)" }}>AttendIQ — sign in to your student account</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--gray-200)", padding: "32px 28px" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Student ID or Email</label>
              <input
                type="text"
                placeholder="e.g. BSCS-001 or you@school.edu"
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                required
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "var(--teal-400)"}
                onBlur={(e)  => e.target.style.borderColor = "var(--gray-200)"}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "var(--teal-400)"}
                onBlur={(e)  => e.target.style.borderColor = "var(--gray-200)"}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "11px 0", background: loading ? "var(--teal-600)" : "var(--teal-400)", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", transition: "background 0.15s" }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--gray-400)" }}>
            Teacher?{" "}
            <Link href="/login" style={{ color: "var(--teal-600)", fontWeight: 500, textDecoration: "none" }}>Teacher login</Link>
          </p>
        </div>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>
          AttendIQ v1.0 · student portal
        </p>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, color: "var(--gray-700)", marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid var(--gray-200)", borderRadius: 8, fontSize: 13, color: "var(--gray-900)", background: "#fff", transition: "border-color 0.15s", outline: "none", fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: "border-box" };

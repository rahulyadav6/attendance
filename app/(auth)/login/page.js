"use client";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login, studentLogin } = useAuth();
  const [role, setRole]       = useState("teacher"); // "teacher" | "student"
  const [form, setForm]       = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (role === "teacher") {
        await login(form.identifier, form.password);
      } else {
        await studentLogin(form.identifier, form.password);
      }
      toast.success("Welcome back!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{
          width: 52, height: 52, background: "var(--teal-400)",
          borderRadius: 14, display: "inline-flex", alignItems: "center",
          justifyContent: "center", marginBottom: 16,
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
               stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--gray-900)", marginBottom: 4 }}>
          AttendIQ
        </h1>
        <p style={{ fontSize: 13, color: "var(--gray-400)" }}>
          The smart way to track campus attendance
        </p>
      </div>

      {/* Role Picker */}
      <div style={{ display: "flex", background: "var(--gray-100)", padding: 4, borderRadius: 10, marginBottom: 20 }}>
        <button 
          onClick={() => { setRole("teacher"); setForm({ identifier: "", password: "" }); }}
          style={{ 
            flex: 1, padding: "8px 0", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: role === "teacher" ? "#fff" : "transparent",
            color: role === "teacher" ? "var(--teal-600)" : "var(--gray-500)",
            boxShadow: role === "teacher" ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
            cursor: "pointer", transition: "all 0.15s"
          }}
        >
          Teacher Portal
        </button>
        <button 
          onClick={() => { setRole("student"); setForm({ identifier: "", password: "" }); }}
          style={{ 
            flex: 1, padding: "8px 0", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: role === "student" ? "#fff" : "transparent",
            color: role === "student" ? "var(--teal-600)" : "var(--gray-500)",
            boxShadow: role === "student" ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
            cursor: "pointer", transition: "all 0.15s"
          }}
        >
          Student Portal
        </button>
      </div>

      {/* Card */}
      <div style={{
        background: "#fff", borderRadius: 14,
        border: "1px solid var(--gray-200)", padding: "32px 28px",
      }}>
        <form onSubmit={handleSubmit}>
          {/* Identifier (Email/Student ID) */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>{role === "teacher" ? "Email Address" : "Student ID"}</label>
            <input
              type={role === "teacher" ? "email" : "text"}
              placeholder={role === "teacher" ? "you@school.edu" : "e.g. BSCS-001"}
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              required
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = "var(--teal-400)"}
              onBlur={(e)  => e.target.style.borderColor = "var(--gray-200)"}
            />
          </div>

          {/* Password */}
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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "11px 0",
              background: loading ? "var(--teal-600)" : "var(--teal-400)",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Signing in..." : `Sign in as ${role === "teacher" ? "Teacher" : "Student"}`}
          </button>
        </form>

        {role === "teacher" && (
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--gray-400)" }}>
            No teacher account yet?{" "}
            <Link href="/register" style={{ color: "var(--teal-600)", fontWeight: 500, textDecoration: "none" }}>
              Create one
            </Link>
          </p>
        )}
      </div>

      <p style={{ textAlign: "center", marginTop: 20, fontSize: 11,
                  color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>
        AttendIQ v1.0 · Integrated Portal
      </p>
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 500,
  color: "var(--gray-700)", marginBottom: 6,
};

const inputStyle = {
  width: "100%", padding: "10px 12px",
  border: "1px solid var(--gray-200)", borderRadius: 8,
  fontSize: 13, color: "var(--gray-900)", background: "#fff",
  transition: "border-color 0.15s", outline: "none",
  fontFamily: "'DM Sans', system-ui, sans-serif",
};

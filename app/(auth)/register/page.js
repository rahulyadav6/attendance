"use client";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm]       = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success("Account created! Welcome to AttendIQ.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
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
          Create your account
        </h1>
        <p style={{ fontSize: 13, color: "var(--gray-400)" }}>
          One-time setup — only one teacher account allowed
        </p>
      </div>

      <div style={{
        background: "#fff", borderRadius: 14,
        border: "1px solid var(--gray-200)", padding: "32px 28px",
      }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Full name</label>
            <input
              type="text" placeholder="Mr. Raza"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = "var(--teal-400)"}
              onBlur={(e)  => e.target.style.borderColor = "var(--gray-200)"}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Email address</label>
            <input
              type="email" placeholder="you@school.edu"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = "var(--teal-400)"}
              onBlur={(e)  => e.target.style.borderColor = "var(--gray-200)"}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password" placeholder="Min. 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = "var(--teal-400)"}
              onBlur={(e)  => e.target.style.borderColor = "var(--gray-200)"}
            />
          </div>
          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", padding: "11px 0",
              background: loading ? "var(--teal-600)" : "var(--teal-400)",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 14, fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--gray-400)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--teal-600)", fontWeight: 500, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </div>
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

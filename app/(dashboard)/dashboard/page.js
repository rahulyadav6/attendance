"use client";
import { useState, useEffect } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Card, StatCard, Badge, Button, Spinner } from "@/components/ui/index";
import { useAuth } from "@/lib/AuthContext";
import api from "@/lib/api";
import Link from "next/link";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function DashboardPage() {
  const { teacher } = useAuth();
  const [sections,  setSections]  = useState([]);
  const [active,    setActive]    = useState("");
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [overview,  setOverview]  = useState(null); // cross-section totals

  const today = format(new Date(), "EEE, MMM d yyyy");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Load sections
  useEffect(() => {
    api.get("/sections").then(({ data: d }) => {
      setSections(d.sections);
      if (d.sections.length > 0) setActive(d.sections[0]._id);
    });
    // Load overall overview stats
    api.get("/dashboard/overview").then(({ data: d }) => setOverview(d)).catch(() => {});
  }, []);

  // Load section-specific report when active changes
  useEffect(() => {
    if (!active) return;
    setLoading(true);
    api.get(`/reports?sectionId=${active}&range=7`)
      .then(({ data: d }) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [active]);

  const sectionName = sections.find((s) => s._id === active)?.name || "";

  return (
    <>
      <PageHeader title="Dashboard" subtitle={today}>
        {sections.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {sections.map((s) => (
              <button key={s._id} onClick={() => setActive(s._id)}
                style={{
                  padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                  cursor: "pointer", border: "none",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  background: active === s._id ? "var(--teal-400)" : "var(--gray-100)",
                  color:      active === s._id ? "#fff" : "var(--gray-700)",
                  transition: "all 0.15s",
                }}>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      <div style={{ padding: "24px 28px" }}>
        {/* Welcome banner (no sections yet) */}
        {sections.length === 0 && (
          <div style={{ background: "var(--teal-50)", border: "1px solid var(--teal-100)", borderRadius: 12, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--teal-800)", marginBottom: 4 }}>Welcome, {teacher?.name}! Let's get started.</div>
              <div style={{ fontSize: 13, color: "var(--teal-600)" }}>Create your first section to begin tracking attendance.</div>
            </div>
            <Link href="/sections"><Button>Create section</Button></Link>
          </div>
        )}

        {/* Global overview — Total students across all sections */}
        {overview && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
            <StatCard label="Total students"  value={overview.totalStudents} sub={`${overview.totalSections} sections managed`} />
            {/* The user requested to remove 'present today' from global and keep it section-wise only */}
            <div style={{ gridColumn: "span 3" }} /> 
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}><Spinner /></div>
        ) : data ? (
          <>
            {/* Section-specific stat cards — This is where attendance context belongs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
              <StatCard label={`${sectionName} students`}  value={data.summary.totalStudents} />
              <StatCard label="Present today"   value={data.summary.todayPresent}  accentColor="var(--teal-600)" sub={<span style={{ color: "var(--teal-400)" }}>{data.summary.todayPct}% attendance</span>} />
              <StatCard label="Absent today"    value={data.summary.totalStudents - data.summary.todayPresent} accentColor={data.summary.totalStudents - data.summary.todayPresent > 0 ? "#C0392B" : "var(--gray-900)"} />
              <StatCard label="7-day average"   value={`${data.summary.avgPct}%`}  accentColor={data.summary.avgPct >= 75 ? "var(--teal-600)" : "#C0392B"} sub={<span style={{ color: "var(--gray-400)" }}>Target: 75%</span>} />
            </div>

            {/* Charts + quick actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 22 }}>
              {/* 7-day bar chart */}
              <Card style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "var(--gray-900)" }}>
                  This week — {sectionName}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.dailyTrend} barSize={28} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--gray-400)", fontFamily: "'DM Mono',monospace" }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: "var(--gray-400)" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--gray-200)", fontFamily: "'DM Sans',system-ui,sans-serif" }} formatter={(v) => [`${v}%`, "Attendance"]} />
                    <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                      {data.dailyTrend.map((entry, i) => (
                        <Cell key={i} fill={entry.date === todayStr ? "var(--teal-400)" : "var(--teal-100)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Quick actions */}
              <Card style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: "var(--gray-900)" }}>Quick actions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { href: "/attendance/qr",     label: "Start QR session",  icon: "▦", color: "var(--teal-400)" },
                    { href: "/attendance/face",   label: "Face scanner",      icon: "◉", color: "#639922" },
                    { href: "/attendance/manual", label: "Manual roll call",  icon: "📋", color: "var(--teal-600)" },
                    { href: "/students",         label: "Manage students",   icon: "👤", color: "var(--gray-400)" },
                    { href: "/analytics",        label: "View reports",      icon: "📊", color: "var(--gray-400)" },
                  ].map(({ href, label, icon, color }) => (
                    <Link key={href} href={href} style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--gray-200)", cursor: "pointer", transition: "all 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--teal-200)"; e.currentTarget.style.background = "var(--teal-50)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--gray-200)"; e.currentTarget.style.background = "#fff"; }}>
                        <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{icon}</span>
                        <span style={{ fontSize: 13, color: "var(--gray-700)", fontWeight: 500 }}>{label}</span>
                        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--gray-400)" }}>→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            </div>

            {/* Today's snapshot table */}
            <Card>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--gray-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)" }}>Today's attendance — {sectionName}</div>
                <Link href="/analytics" style={{ textDecoration: "none" }}>
                  <span style={{ fontSize: 12, color: "var(--teal-600)", fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>Full report →</span>
                </Link>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--gray-100)" }}>
                      {["Student", "ID", "Status", "Method"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--gray-400)", letterSpacing: "0.05em", fontWeight: 500, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.studentStats.map((s, i) => {
                      const todayData = data.dailyTrend.find(d => d.date === todayStr);
                      const isPresent = s.present > 0 || s.late > 0;
                      return (
                        <tr key={s._id}
                          style={{ borderBottom: i < data.studentStats.length - 1 ? "1px solid var(--gray-100)" : "none" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--gray-50)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 500, color: "var(--gray-900)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {s.photo ? (
                                <img src={s.photo} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover" }}/>
                              ) : (
                                <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--teal-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "var(--teal-700)" }}>
                                  {s.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                                </div>
                              )}
                              {s.name}
                            </div>
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--gray-400)" }}>{s.studentId}</td>
                          <td style={{ padding: "10px 16px" }}>
                            <Badge type={isPresent ? "present" : "absent"} label={isPresent ? "Present" : "Absent"} />
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            {s.byMethod?.qr > 0 ? <Badge type="qr" label="QR" /> :
                             s.byMethod?.face > 0 ? <Badge type="face" label="Face" /> :
                             s.byMethod?.manual > 0 ? <Badge type="manual" label="Manual" /> :
                             <span style={{ color: "var(--gray-400)", fontSize: 12 }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : sections.length > 0 ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}><Spinner /></div>
        ) : null}
      </div>
    </>
  );
}

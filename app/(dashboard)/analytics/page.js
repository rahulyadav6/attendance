"use client";
import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Card, StatCard, Button, Badge, Spinner, EmptyState } from "@/components/ui/index";
import api from "@/lib/api";
import toast from "react-hot-toast";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export default function AnalyticsPage() {
  const [sections,  setSections]  = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [range,     setRange]     = useState(30);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get("/sections").then(({ data }) => {
      setSections(data.sections);
      if (data.sections.length > 0) setSectionId(data.sections[0]._id);
    });
  }, []);

  const load = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      const { data: res } = await api.get(`/reports?sectionId=${sectionId}&range=${range}`);
      setData(res);
    } catch { toast.error("Failed to load analytics"); }
    finally   { setLoading(false); }
  }, [sectionId, range]);

  useEffect(() => { load(); }, [load]);

  async function exportPDF() {
    if (!data) return;
    setExporting(true);
    try {
      const { default: jsPDF }     = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc  = new jsPDF();
      const sec  = sections.find((s) => s._id === sectionId)?.name || "Section";
      const now  = new Date().toLocaleDateString();

      // Header
      doc.setFillColor(29, 158, 117);
      doc.rect(0, 0, 210, 24, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text("AttendIQ — Attendance Report", 14, 16);

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Section: ${sec}   |   Period: Last ${range} days   |   Generated: ${now}`, 14, 32);

      // Summary row
      const s = data.summary;
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(26, 40, 32);
      doc.text(`Total students: ${s.totalStudents}`, 14, 44);
      doc.text(`Average attendance: ${s.avgPct}%`, 80, 44);
      doc.text(`Low attendance (<75%): ${s.lowAttendanceCount}`, 150, 44);

      // Table
      autoTable(doc, {
        startY: 52,
        head: [["Student", "ID", "Present", "Late", "Absent", "Attendance %", "Status"]],
        body: data.studentStats.map((s) => [
          s.name, s.studentId,
          s.present, s.late, s.absent,
          `${s.pct}%`,
          s.pct >= 75 ? "Good" : "Low",
        ]),
        headStyles: { fillColor: [29, 158, 117], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [241, 249, 244] },
        columnStyles: {
          6: {
            cellWidth: 20,
            textColor: (cell) => cell.raw === "Low" ? [226, 75, 74] : [15, 110, 86],
          },
        },
      });

      doc.save(`attendance_${sec}_${now.replace(/\//g, "-")}.pdf`);
      toast.success("PDF exported");
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally { setExporting(false); }
  }

  async function exportExcel() {
    if (!data) return;
    try {
      const XLSX = await import("xlsx");
      const sec  = sections.find((s) => s._id === sectionId)?.name || "Section";

      const rows = data.studentStats.map((s) => ({
        "Name":             s.name,
        "Student ID":       s.studentId,
        "Present":          s.present,
        "Late":             s.late,
        "Absent":           s.absent,
        "Total Days":       s.totalDays,
        "Attendance %":     s.pct,
        "QR Scans":         s.byMethod.qr,
        "Face Recognition": s.byMethod.face,
        "Manual":           s.byMethod.manual,
        "Status":           s.pct >= 75 ? "Good" : "Low Attendance",
      }));

      const ws  = XLSX.utils.json_to_sheet(rows);
      const wb  = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sec);
      XLSX.writeFile(wb, `attendance_${sec}.xlsx`);
      toast.success("Excel exported");
    } catch (err) {
      console.error(err);
      toast.error("Excel export failed");
    }
  }

  const sectionName = sections.find((s) => s._id === sectionId)?.name || "";

  return (
    <>
      <PageHeader title="Analytics" subtitle={sectionName ? `${sectionName} · Last ${range} days` : "Select a section"}>
        <select
          value={sectionId} onChange={(e) => setSectionId(e.target.value)}
          style={ctrlStyle}
        >
          <option value="">Choose section...</option>
          {sections.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <select value={range} onChange={(e) => setRange(Number(e.target.value))} style={ctrlStyle}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        {data && (
          <>
            <Button variant="ghost" onClick={exportExcel}>Excel</Button>
            <Button variant="ghost" onClick={exportPDF} disabled={exporting}>
              {exporting ? "Exporting..." : "PDF"}
            </Button>
          </>
        )}
      </PageHeader>

      <div style={{ padding: "24px 28px" }}>
        {!sectionId ? (
          <EmptyState icon="📊" title="Select a section" description="Choose a section above to view analytics." />
        ) : loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}><Spinner /></div>
        ) : !data ? null : (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
              <StatCard label="Total students"    value={data.summary.totalStudents} />
              <StatCard label="Present today"     value={data.summary.todayPresent}
                        accentColor="var(--teal-600)"
                        sub={<span style={{ color: "var(--teal-400)" }}>{data.summary.todayPct}% of class</span>} />
              <StatCard label={`Avg (${range}d)`} value={`${data.summary.avgPct}%`}
                        accentColor={data.summary.avgPct >= 75 ? "var(--teal-600)" : "#C0392B"} />
              <StatCard label="Low attendance"    value={data.summary.lowAttendanceCount}
                        accentColor={data.summary.lowAttendanceCount > 0 ? "#C0392B" : "var(--gray-900)"}
                        sub={<span style={{ color: "var(--gray-400)" }}>below 75%</span>} />
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 22 }}>
              {/* Trend chart */}
              <Card style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "var(--gray-900)" }}>
                  Attendance trend
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.dailyTrend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}
                           tickLine={false} axisLine={false}
                           interval={Math.floor(data.dailyTrend.length / 6)} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--gray-400)" }}
                           tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--gray-200)",
                                      fontFamily: "'DM Sans', system-ui, sans-serif" }}
                      formatter={(v) => [`${v}%`, "Attendance"]}
                      labelFormatter={(l) => `Date: ${l}`}
                    />
                    <Line type="monotone" dataKey="pct" stroke="var(--teal-400)"
                          strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "var(--teal-400)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Method breakdown */}
              <Card style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "var(--gray-900)" }}>
                  By method
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { label: "QR code",          value: data.methods.qr,     color: "var(--teal-400)" },
                    { label: "Face recognition",  value: data.methods.face,   color: "#639922" },
                    { label: "Manual",            value: data.methods.manual, color: "var(--gray-400)" },
                  ].map(({ label, value, color }) => {
                    const total = data.methods.qr + data.methods.face + data.methods.manual || 1;
                    const pct   = Math.round((value / total) * 100);
                    return (
                      <div key={label}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                                      fontSize: 12, marginBottom: 5 }}>
                          <span style={{ color: "var(--gray-700)" }}>{label}</span>
                          <span style={{ color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>
                            {value} ({pct}%)
                          </span>
                        </div>
                        <div style={{ height: 6, background: "var(--gray-100)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color,
                                        borderRadius: 3, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Per-student table */}
            <Card>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--gray-100)",
                            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)" }}>
                  Student breakdown
                </div>
                {data.summary.lowAttendanceCount > 0 && (
                  <div style={{ fontSize: 11, color: "#A32D2D", background: "#FCEBEB",
                                padding: "3px 10px", borderRadius: 5,
                                fontFamily: "'DM Mono', monospace" }}>
                    {data.summary.lowAttendanceCount} student{data.summary.lowAttendanceCount !== 1 ? "s" : ""} below 75%
                  </div>
                )}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--gray-100)" }}>
                      {["Student", "ID", "Present", "Late", "Absent", "Attendance", "QR", "Face", "Status"].map((h) => (
                        <th key={h} style={{
                          textAlign: "left", padding: "10px 14px",
                          fontSize: 10, fontFamily: "'DM Mono', monospace",
                          color: "var(--gray-400)", letterSpacing: "0.05em",
                          fontWeight: 500, textTransform: "uppercase", whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.studentStats.map((s, i) => (
                      <tr key={s._id}
                          style={{ borderBottom: i < data.studentStats.length - 1 ? "1px solid var(--gray-100)" : "none" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--gray-50)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "var(--gray-900)" }}>
                          {s.name}
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--gray-400)" }}>
                          {s.studentId}
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--teal-600)", fontWeight: 500 }}>
                          {s.present}
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 13, color: "#854F0B" }}>
                          {s.late}
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 13, color: "#A32D2D" }}>
                          {s.absent}
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 5, background: "var(--gray-100)",
                                          borderRadius: 3, overflow: "hidden", minWidth: 60 }}>
                              <div style={{
                                height: "100%", borderRadius: 3,
                                width: `${s.pct}%`,
                                background: s.pct >= 75 ? "var(--teal-400)" : "#E24B4A",
                                transition: "width 0.5s ease",
                              }}/>
                            </div>
                            <span style={{
                              fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 500, minWidth: 36,
                              color: s.pct >= 75 ? "var(--teal-600)" : "#A32D2D",
                            }}>
                              {s.pct}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 12, fontFamily: "'DM Mono', monospace", color: "var(--gray-400)" }}>
                          {s.byMethod.qr}
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: 12, fontFamily: "'DM Mono', monospace", color: "var(--gray-400)" }}>
                          {s.byMethod.face}
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          {s.pct >= 75
                            ? <Badge type="present" label="Good" />
                            : <Badge type="absent" label="Low" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

const ctrlStyle = {
  padding: "7px 12px", borderRadius: 8, border: "1px solid var(--gray-200)",
  fontSize: 13, background: "#fff", color: "var(--gray-700)",
  fontFamily: "'DM Sans', system-ui, sans-serif", cursor: "pointer",
};

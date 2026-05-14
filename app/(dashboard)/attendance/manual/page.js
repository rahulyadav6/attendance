"use client";
import { useState, useEffect } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Card, Button, Spinner, Badge } from "@/components/ui/index";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { format } from "date-fns";

export default function ManualAttendancePage() {
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    api.get("/sections").then(({ data }) => {
      setSections(data.sections);
      if (data.sections.length > 0) setSectionId(data.sections[0]._id);
    });
  }, []);

  useEffect(() => {
    if (sectionId) loadAttendance();
  }, [sectionId, date]);

  async function loadAttendance() {
    setLoading(true);
    try {
      const { data } = await api.get(`/attendance?sectionId=${sectionId}&date=${date}`);
      setStudents(data.attendance);
    } catch (err) {
      toast.error("Failed to load attendance list");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(s) {
    setSavingId(s.student._id);
    const newStatus = s.status === "present" ? "absent" : "present";
    
    try {
      if (s.recordId) {
        // If it was already marked, and we are toggling to absent, we should probably delete?
        // Or update the status. Let's try updating status first.
        await api.put(`/attendance/${s.recordId}`, { status: newStatus, method: "manual" });
      } else {
        // Create new record
        await api.post("/attendance", { 
          studentId: s.student._id, 
          sectionId, 
          method: "manual", 
          status: "present" 
        });
      }
      toast.success(`${s.student.name} marked as ${newStatus}`);
      loadAttendance();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update attendance");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <PageHeader title="Manual Attendance" subtitle="Mark students present or absent manually" />

      <div style={{ padding: "24px 28px" }}>
        <Card style={{ padding: "20px 24px", marginBottom: 24, display: "flex", gap: 20, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Select Section</label>
            <select 
              value={sectionId} 
              onChange={(e) => setSectionId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Choose section...</option>
              {sections.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ width: 200 }}>
            <label style={labelStyle}>Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              max={format(new Date(), "yyyy-MM-dd")}
              style={selectStyle}
            />
          </div>
          <Button onClick={loadAttendance} variant="ghost" disabled={loading}>Refresh</Button>
        </Card>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div>
        ) : sectionId ? (
          <Card>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gray-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>
                Student Roll Call — {sections.find(s => s._id === sectionId)?.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--gray-400)" }}>
                {students.filter(s => s.status === "present").length} / {students.length} Present
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--gray-50)", borderBottom: "1px solid var(--gray-100)" }}>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Roll ID</th>
                    <th style={thStyle}>Last Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: 40, textAlign: "center", color: "var(--gray-400)", fontSize: 13 }}>
                        No students found in this section.
                      </td>
                    </tr>
                  ) : students.map((s) => (
                    <tr key={s.student._id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--teal-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--teal-700)" }}>
                            {s.student.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--gray-900)" }}>{s.student.name}</div>
                            <div style={{ fontSize: 11, color: "var(--gray-400)" }}>{s.student.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 13, fontFamily: "'DM Mono', monospace", color: "var(--gray-500)" }}>
                        {s.student.studentId}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <Badge type={s.status === "present" ? "present" : "absent"} label={s.status === "present" ? "Present" : "Absent"} />
                        {s.method && <span style={{ fontSize: 10, color: "var(--gray-400)", marginLeft: 8 }}>({s.method})</span>}
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "right" }}>
                        <button
                          onClick={() => toggleStatus(s)}
                          disabled={savingId === s.student._id}
                          style={{
                            padding: "6px 16px",
                            borderRadius: 7,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            background: s.status === "present" ? "#FCEBEB" : "var(--teal-50)",
                            color: s.status === "present" ? "#791F1F" : "var(--teal-700)",
                            border: `1px solid ${s.status === "present" ? "#F7C1C1" : "var(--teal-200)"}`,
                            transition: "all 0.1s"
                          }}
                        >
                          {savingId === s.student._id ? "..." : s.status === "present" ? "Mark Absent" : "Mark Present"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div style={{ padding: 60, textAlign: "center", color: "var(--gray-400)" }}>Select a section to start roll call</div>
        )}
      </div>
    </>
  );
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, color: "var(--gray-700)", marginBottom: 6 };
const selectStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--gray-200)", fontSize: 13, background: "#fff", color: "var(--gray-700)", fontFamily: "'DM Sans', system-ui, sans-serif", outline: "none" };
const thStyle = { textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.05em" };

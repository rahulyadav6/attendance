"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card, Button, Modal, Input, Select, EmptyState, Spinner, Badge } from "@/components/ui/index";
import CameraCapture from "@/components/attendance/CameraCapture";
import api from "@/lib/api";
import toast from "react-hot-toast";

function StudentsContent() {
  const searchParams = useSearchParams();
  const preSection   = searchParams.get("section") || "";

  const [students,    setStudents]    = useState([]);
  const [sections,    setSections]    = useState([]);
  const [filter,      setFilter]      = useState(preSection);
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [editingId,   setEditingId]   = useState(null);
  const [viewStudent, setViewStudent] = useState(null);
  const [pwModal,     setPwModal]     = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { type: "block"|"delete", student: s }
  const [newPw,       setNewPw]       = useState("");
  const [pwSaving,    setPwSaving]    = useState(false);
  const [form, setForm] = useState({ name: "", studentId: "", email: "", password: "", photo: "", descriptor: [] });

  const displayedStudents = students
    .filter(s => !filter || s.sectionIds?.some(sec => sec._id === filter || sec === filter))
    .filter(s => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) ||
             s.studentId.toLowerCase().includes(q) ||
             s.email.toLowerCase().includes(q);
    });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [studRes, secRes] = await Promise.all([
        api.get("/students"),
        api.get("/sections"),
      ]);
      setStudents(studRes.data.students);
      setSections(secRes.data.sections);
    } catch { toast.error("Failed to load data"); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleFaceCapture({ photo, descriptor }) {
    setForm((f) => ({ ...f, photo, descriptor }));
  }

  async function handleAdd() {
    if (!form.name.trim() || !form.studentId.trim() || !form.email.trim()) {
      toast.error("Name, ID, and Email are required"); return;
    }
    if (!editingId && !form.password.trim()) {
      toast.error("Password is required for new students"); return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        if (!payload.descriptor?.length) delete payload.descriptor;
        await api.put(`/students/${editingId}`, payload);
        toast.success("Student updated");
      } else {
        await api.post("/students", form);
        toast.success("Student added");
      }
      setModal(false); setEditingId(null);
      setForm({ name: "", studentId: "", email: "", password: "", photo: "", descriptor: [] });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save student");
    } finally { setSaving(false); }
  }

  function openEdit(student) {
    setForm({ name: student.name, studentId: student.studentId, email: student.email, password: "", photo: student.photo || "", descriptor: student.descriptor || [] });
    setEditingId(student._id);
    setModal(true);
  }

  async function handleDelete(s) {
    setSaving(true);
    try {
      await api.delete(`/students/${s._id}`);
      toast.success("Student removed");
      load();
    } catch (err) { toast.error(err.response?.data?.error || "Delete failed"); }
    finally { setSaving(false); setConfirmModal(null); }
  }

  async function handleToggleBlock(s) {
    const action = s.isBlocked ? "unblock" : "block";
    setSaving(true);
    try {
      await api.put(`/students/${s._id}`, { isBlocked: !s.isBlocked });
      toast.success(`Student ${action}ed`);
      load();
    } catch (err) { toast.error(err.response?.data?.error || "Failed to update"); }
    finally { setSaving(false); setConfirmModal(null); }
  }

  async function handleResetPassword() {
    if (!newPw.trim() || newPw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setPwSaving(true);
    try {
      await api.put(`/students/${pwModal._id}`, { password: newPw });
      toast.success(`Password changed for ${pwModal.name}`);
      setPwModal(null); setNewPw("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to change password");
    } finally { setPwSaving(false); }
  }

  const initials = (name) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const btnStyle = (bg, border, color) => ({
    padding: "5px 10px", borderRadius: 6, border: `1px solid ${border}`,
    background: bg, color, fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif",
  });

  return (
    <>
      <PageHeader title="Students" subtitle={`${displayedStudents.length} student${displayedStudents.length !== 1 ? "s" : ""}`}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--gray-200)", fontSize: 13, background: "#fff", color: "var(--gray-700)", fontFamily: "'DM Sans', system-ui, sans-serif", cursor: "pointer" }}
        >
          <option value="">All sections</option>
          {sections.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <Button onClick={() => { setEditingId(null); setForm({ name: "", studentId: "", email: "", password: "", photo: "", descriptor: [] }); setModal(true); }}>
          + Add student
        </Button>
      </PageHeader>

      <div style={{ padding: "24px 28px" }}>
        {/* Search bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: "relative", maxWidth: 360 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", pointerEvents: "none" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>
            </span>
            <input
              type="text"
              placeholder="Search by name, ID, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid var(--gray-200)", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "'DM Sans', system-ui, sans-serif", color: "var(--gray-900)", boxSizing: "border-box" }}
              onFocus={(e) => e.target.style.borderColor = "var(--teal-400)"}
              onBlur={(e)  => e.target.style.borderColor = "var(--gray-200)"}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}><Spinner /></div>
        ) : displayedStudents.length === 0 ? (
          <EmptyState
            icon="👤" title="No students found"
            description={search ? "No students match your search." : filter ? "No students in this section." : "Add your first student to get started."}
            action={!search && <Button onClick={() => setModal(true)}>+ Add student</Button>}
          />
        ) : (
          <Card>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--gray-100)" }}>
                  {["Student", "ID", "Email", "Sections", "Status", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--gray-400)", letterSpacing: "0.05em", fontWeight: 500, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedStudents.map((s, i) => (
                  <tr key={s._id} style={{ borderBottom: i < displayedStudents.length - 1 ? "1px solid var(--gray-100)" : "none", background: s.isBlocked ? "#FCEBEB" : "transparent" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = s.isBlocked ? "#FCEBEB" : "var(--gray-50)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = s.isBlocked ? "#FCEBEB" : "transparent"}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setViewStudent(s)}>
                        {s.photo ? (
                          <img src={s.photo} alt={s.name} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--teal-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--teal-800)" }}>
                            {initials(s.name)}
                          </div>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-900)", textDecoration: "underline dotted", textUnderlineOffset: 3 }}>{s.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: "var(--gray-400)" }}>{s.studentId}</span></td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: 12, color: "var(--gray-600)" }}>{s.email}</span></td>
                    <td style={{ padding: "12px 16px" }}>
                      {s.sectionIds?.length > 0
                        ? s.sectionIds.map(sec => (
                            <span key={sec._id || sec} style={{ display: "inline-block", background: "var(--teal-50)", color: "var(--teal-700)", borderRadius: 5, padding: "2px 7px", marginRight: 4, marginBottom: 2, fontSize: 11, fontWeight: 500 }}>{sec.name || sec}</span>
                          ))
                        : <span style={{ color: "var(--gray-400)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {s.isBlocked
                        ? <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "#FCEBEB", color: "#791F1F", fontWeight: 500 }}>Blocked</span>
                        : <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "var(--teal-50)", color: "var(--teal-700)", fontWeight: 500 }}>Active</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <button onClick={() => openEdit(s)} style={btnStyle("var(--teal-50)","var(--teal-200)","var(--teal-700)")}>Edit</button>
                        <button onClick={() => { setPwModal(s); setNewPw(""); }} style={btnStyle("#EFF6FF","#BFDBFE","#1D4ED8")}>Reset PW</button>
                        <button onClick={() => setConfirmModal({ type: "block", student: s })} style={btnStyle(s.isBlocked?"#E1F5EE":"#FFFBEB", s.isBlocked?"#9FE1CB":"#FDE68A", s.isBlocked?"#085041":"#92400E")}>
                          {s.isBlocked ? "Unblock" : "Block"}
                        </button>
                        <button onClick={() => setConfirmModal({ type: "delete", student: s })} style={btnStyle("#FCEBEB","#F7C1C1","#791F1F")}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      <Modal open={modal} onClose={() => { setModal(false); setEditingId(null); }} title={editingId ? "Edit student" : "Add student"}>
        <Input label="Full name" placeholder="Ahmed Awais" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Student ID (unique)" placeholder="BSCS-001" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} />
        <Input label="Email Address (unique)" placeholder="student@school.edu" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label={editingId ? "Reset Password (leave blank to keep current)" : "Password"} placeholder={editingId ? "Leave empty to keep current" : "••••••••"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <div style={{ marginBottom: 16 }}>
          <CameraCapture
            existingPhoto={form.photo}
            onCapture={handleFaceCapture}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Button variant="ghost" onClick={() => { setModal(false); setEditingId(null); }}>Cancel</Button>
          <Button onClick={handleAdd} disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Add student"}</Button>
        </div>
      </Modal>

      {/* View Student Details Modal */}
      <Modal open={!!viewStudent} onClose={() => setViewStudent(null)} title="Student Details">
        {viewStudent && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: "16px", background: "var(--gray-50)", borderRadius: 10 }}>
              {viewStudent.photo ? (
                <img src={viewStudent.photo} alt={viewStudent.name} style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 12, background: "var(--teal-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "var(--teal-800)" }}>
                  {initials(viewStudent.name)}
                </div>
              )}
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--gray-900)" }}>{viewStudent.name}</div>
                <div style={{ fontSize: 12, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{viewStudent.studentId}</div>
                {viewStudent.isBlocked && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "#FCEBEB", color: "#791F1F", fontWeight: 500, display: "inline-block", marginTop: 4 }}>Blocked</span>}
              </div>
            </div>
            {[
              ["Email", viewStudent.email],
              ["Student ID", viewStudent.studentId],
              ["Sections", viewStudent.sectionIds?.map(s => s.name).join(", ") || "None"],
              ["Face Data", viewStudent.descriptor?.length === 128 ? "✓ Trained" : "Not trained"],
              ["Account Status", viewStudent.isBlocked ? "Blocked" : "Active"],
              ["Joined", viewStudent.createdAt ? new Date(viewStudent.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--gray-100)" }}>
                <span style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 13, color: "var(--gray-900)", fontWeight: 500 }}>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <Button variant="ghost" onClick={() => setViewStudent(null)}>Close</Button>
              <Button onClick={() => { setViewStudent(null); openEdit(viewStudent); }}>Edit Student</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!pwModal} onClose={() => { setPwModal(null); setNewPw(""); }} title={`Reset password — ${pwModal?.name}`}>
        <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 16 }}>
          As a teacher, you can set a new password for this student without knowing their current password.
        </p>
        <Input label="New Password" placeholder="Min. 6 characters" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Button variant="ghost" onClick={() => { setPwModal(null); setNewPw(""); }}>Cancel</Button>
          <Button onClick={handleResetPassword} disabled={pwSaving}>{pwSaving ? "Saving..." : "Set password"}</Button>
        </div>
      </Modal>
      {/* Custom Confirmation Modal */}
      <Modal 
        open={!!confirmModal} 
        onClose={() => setConfirmModal(null)} 
        title={confirmModal?.type === "delete" ? "Delete Student" : confirmModal?.student?.isBlocked ? "Unblock Student" : "Block Student"}
      >
        <div style={{ padding: "4px 0 16px" }}>
          <p style={{ fontSize: 13, color: "var(--gray-600)", lineHeight: 1.6, margin: 0 }}>
            {confirmModal?.type === "delete" 
              ? `Are you sure you want to remove ${confirmModal?.student?.name}? This will permanently delete their account and all their attendance history.`
              : confirmModal?.student?.isBlocked
                ? `Ready to unblock ${confirmModal?.student?.name}? They will regain full access to their dashboard.`
                : `Are you sure you want to block ${confirmModal?.student?.name}? They will be logged out and restricted from marking attendance.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={() => setConfirmModal(null)} disabled={saving}>Cancel</Button>
          <Button 
            variant={confirmModal?.type === "delete" || !confirmModal?.student?.isBlocked ? "danger" : "primary"} 
            onClick={() => confirmModal?.type === "delete" ? handleDelete(confirmModal?.student) : handleToggleBlock(confirmModal?.student)}
            disabled={saving}
          >
            {saving ? "Processing..." : confirmModal?.type === "delete" ? "Yes, Delete" : confirmModal?.student?.isBlocked ? "Unblock" : "Yes, Block"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}><Spinner /></div>}>
      <StudentsContent />
    </Suspense>
  );
}

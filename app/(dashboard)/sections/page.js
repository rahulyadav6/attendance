"use client";
import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Card, Button, Modal, Input, EmptyState, Spinner } from "@/components/ui/index";
import api from "@/lib/api";
import toast from "react-hot-toast";
import Link from "next/link";

export default function SectionsPage() {
  const [sections, setSections] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState({ name: "", day: "Monday", time: "10:00" });
  const [saving,   setSaving]   = useState(false);

  const [studentsModal, setStudentsModal] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [searchStudent, setSearchStudent] = useState("");
  const [activeSection, setActiveSection] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [savingStudents, setSavingStudents] = useState(false);

  async function openManageStudents(s) {
    setActiveSection(s);
    setStudentsModal(true);
    try {
      const { data } = await api.get("/students");
      setAllStudents(data.students);
      const inSection = data.students
        .filter(stud => stud.sectionIds.some(sec => sec._id === s._id || sec === s._id))
        .map(stud => stud._id);
      setSelectedStudentIds(inSection);
    } catch {
      toast.error("Failed to load students");
    }
  }

  async function handleSaveStudents() {
    setSavingStudents(true);
    try {
      await api.put(`/sections/${activeSection._id}/students`, { studentIds: selectedStudentIds });
      toast.success("Students updated");
      setStudentsModal(false);
      load();
    } catch {
      toast.error("Failed to update students");
    } finally {
      setSavingStudents(false);
    }
  }

  function toggleStudent(id) {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter(sid => sid !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  }

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/sections");
      setSections(data.sections);
    } catch { toast.error("Failed to load sections"); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm({ name: "", day: "Monday", time: "10:00" }); setModal(true); }
  function openEdit(s)  { 
    setEditing(s);
    // basic parsing for legacy format
    let day = "Monday", time = "10:00";
    if (s.schedule) {
      const parts = s.schedule.split(" ");
      if (parts.length >= 2) { day = parts[0]; time = parts[1]; }
      else { day = s.schedule; }
    }
    setForm({ name: s.name, day, time }); 
    setModal(true); 
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Section name is required"); return; }
    setSaving(true);
    const payload = {
      name: form.name,
      schedule: `${form.day} ${form.time}`
    };
    try {
      if (editing) {
        await api.put(`/sections/${editing._id}`, payload);
        toast.success("Section updated");
      } else {
        await api.post("/sections", payload);
        toast.success("Section created");
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Save failed");
    } finally { setSaving(false); }
  }

  async function handleDelete(s) {
    if (!confirm(`Delete "${s.name}" and all its students? This cannot be undone.`)) return;
    try {
      await api.delete(`/sections/${s._id}`);
      toast.success("Section deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <>
      <PageHeader title="Sections" subtitle={today}>
        <Button onClick={openCreate}>+ New section</Button>
      </PageHeader>

      <div style={{ padding: "24px 28px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <Spinner />
          </div>
        ) : sections.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No sections yet"
            description="Create your first section to start adding students."
            action={<Button onClick={openCreate}>+ Create section</Button>}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {sections.map((s) => (
              <Card key={s._id} style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-900)", marginBottom: 3 }}>
                      {s.name}
                    </div>
                    {s.schedule && (
                      <div style={{ fontSize: 11, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>
                        {s.schedule}
                      </div>
                    )}
                  </div>
                  <div style={{
                    background: "var(--teal-50)", color: "var(--teal-800)",
                    borderRadius: 6, padding: "3px 10px",
                    fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 500,
                  }}>
                    {s.studentCount} {s.studentCount === 1 ? "student" : "students"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--gray-100)", paddingTop: 12 }}>
                  <Link href={`/students?section=${s._id}`} style={{ textDecoration: "none", flex: 1 }}>
                    <button style={{
                      width: "100%", padding: "7px 0", borderRadius: 7,
                      background: "var(--teal-50)", color: "var(--teal-600)",
                      border: "1px solid var(--teal-100)", fontSize: 12,
                      fontWeight: 500, cursor: "pointer",
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}>
                      View students
                    </button>
                  </Link>
                  <button onClick={() => openManageStudents(s)} style={iconBtnStyle} title="Manage Students">
                    <UsersIcon />
                  </button>
                  <button onClick={() => openEdit(s)} style={iconBtnStyle} title="Edit">
                    <EditIcon />
                  </button>
                  <button onClick={() => handleDelete(s)} style={{ ...iconBtnStyle, color: "#E24B4A" }} title="Delete">
                    <TrashIcon />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit section" : "New section"}>
        <Input
          label="Section name"
          placeholder="e.g. BSCS-3A"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--gray-700)", marginBottom: 6 }}>Day</label>
            <select
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--gray-200)", borderRadius: 8, fontSize: 13, background: "#fff" }}
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value })}
            >
              {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <Input
              type="time"
              label="Time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : editing ? "Save changes" : "Create section"}
          </Button>
        </div>
      </Modal>

      {/* Manage Students Modal */}
      <Modal open={studentsModal} onClose={() => setStudentsModal(false)} title={`Manage Students - ${activeSection?.name}`}>
        <div style={{ marginBottom: 12 }}>
          <Input 
            placeholder="Search by name or ID..." 
            value={searchStudent} 
            onChange={e => setSearchStudent(e.target.value)} 
          />
        </div>
        <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
          {allStudents.filter(s => s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.studentId.toLowerCase().includes(searchStudent.toLowerCase())).length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--gray-500)", textAlign: "center", padding: 20 }}>No students found.</div>
          ) : (
            allStudents
              .filter(s => s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.studentId.toLowerCase().includes(searchStudent.toLowerCase()))
              .map(stud => (
              <label key={stud._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(stud._id)}
                  onChange={() => toggleStudent(stud._id)}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontSize: 14, color: "var(--gray-900)" }}>{stud.name} ({stud.studentId})</span>
              </label>
            ))
          )}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={() => setStudentsModal(false)}>Cancel</Button>
          <Button onClick={handleSaveStudents} disabled={savingStudents}>
            {savingStudents ? "Saving..." : "Save students"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

const iconBtnStyle = {
  width: 34, height: 34, borderRadius: 7, border: "1px solid var(--gray-200)",
  background: "var(--gray-50)", cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", color: "var(--gray-400)",
  flexShrink: 0,
};

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4h12M6 4V2h4v2M5 4l1 10h4l1-10"/>
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 10.5c1.656 0 3 1.344 3 3H3.5c0-1.656 1.344-3 3-3"/>
      <circle cx="6.5" cy="5.5" r="3"/>
    </svg>
  );
}

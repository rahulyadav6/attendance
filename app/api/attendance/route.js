import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";
import { withAuth } from "@/middleware/auth";
import { format } from "date-fns";

// GET /api/attendance?sectionId=xxx&date=yyyy-MM-dd
export const GET = withAuth(async (request) => {
  await connectDB();
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  const date      = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");

  if (!sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });

  const [records, students] = await Promise.all([
    Attendance.find({ sectionId, date, teacherId: request.teacher.id })
      .populate("studentId", "name studentId photo"),
    Student.find({ sectionIds: sectionId, teacherId: request.teacher.id }).sort({ name: 1 }),
  ]);

  const markedIds = new Set(records.map((r) => r.studentId?._id?.toString()));

  // Build full list: present/late + absent
  const full = students.map((s) => {
    const rec = records.find((r) => r.studentId?._id?.toString() === s._id.toString());
    return rec
      ? { student: s, status: rec.status, method: rec.method, markedAt: rec.markedAt, recordId: rec._id }
      : { student: s, status: "absent", method: null, markedAt: null, recordId: null };
  });

  return NextResponse.json({ attendance: full, date, total: students.length, present: records.length });
});

// POST /api/attendance — mark via face or manual
export const POST = withAuth(async (request) => {
  await connectDB();
  const teacherId = request.teacher.id;
  const { studentId, sectionId, method, status = "present" } = await request.json();

  if (!studentId || !sectionId || !method) {
    return NextResponse.json({ error: "studentId, sectionId, and method are required" }, { status: 400 });
  }

  const date = format(new Date(), "yyyy-MM-dd");

  try {
    const record = await Attendance.create({ studentId, sectionId, teacherId, date, status, method });
    await record.populate("studentId", "name studentId");

    // Notify the student's browser so their stats refresh in real-time
    try {
      const { getIO } = await import("@/lib/socket");
      const io = getIO();
      if (io && record.studentId?.studentId) {
        io.to(`student:${record.studentId.studentId}`).emit("attendance_updated");
      }
    } catch (e) {}

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json({ error: "Attendance already marked for today", code: "DUPLICATE" }, { status: 409 });
    }
    throw err;
  }
});

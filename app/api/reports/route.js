import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";
import { withAuth } from "@/middleware/auth";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";

// GET /api/reports?sectionId=xxx&range=7|30|90
export const GET = withAuth(async (request) => {
  await connectDB();
  const teacherId = request.teacher?.id;
  if (!teacherId) return NextResponse.json({ error: "Unauthorized - Teacher only" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  const range     = parseInt(searchParams.get("range") || "30");

  if (!sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });

  const endDate   = new Date();
  const startDate = subDays(endDate, range - 1);
  const startStr  = format(startDate, "yyyy-MM-dd");
  const endStr    = format(endDate,   "yyyy-MM-dd");

  const [students, records] = await Promise.all([
    Student.find({ sectionIds: sectionId, teacherId }).sort({ name: 1 }),
    Attendance.find({
      sectionId, teacherId,
      date: { $gte: startStr, $lte: endStr },
    }).populate("studentId", "name studentId"),
  ]);

  const totalStudents = students.length;

  // ── Daily trend (for chart) ──
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const dailyTrend = days.map((d) => {
    const dateStr = format(d, "yyyy-MM-dd");
    const dayRecs = records.filter((r) => r.date === dateStr && r.status !== "absent");
    const pct     = totalStudents > 0 ? Math.round((dayRecs.length / totalStudents) * 100) : 0;
    return {
      date:    dateStr,
      label:   format(d, range <= 7 ? "EEE" : "MMM d"),
      present: dayRecs.length,
      total:   totalStudents,
      pct,
    };
  });

  // ── Per-student summary ──
  const studentStats = students.map((s) => {
    const mine    = records.filter((r) => r.studentId?._id?.toString() === s._id.toString());
    const present = mine.filter((r) => r.status === "present").length;
    const late    = mine.filter((r) => r.status === "late").length;
    const byMethod = {
      qr:     mine.filter((r) => r.method === "qr").length,
      face:   mine.filter((r) => r.method === "face").length,
      manual: mine.filter((r) => r.method === "manual").length,
    };
    const totalClassesHeld = Array.from(new Set(records.map(r => r.date))).length;
    const pct             = totalClassesHeld > 0 ? Math.round(((present + late) / totalClassesHeld) * 100) : 100;
    return {
      _id: s._id, name: s.name, studentId: s.studentId,
      present, late, absent: Math.max(0, totalClassesHeld - present - late),
      totalDays: totalClassesHeld, pct, byMethod, photo: s.photo,
    };
  });

  // ── Method breakdown ──
  const methods = {
    qr:     records.filter((r) => r.method === "qr").length,
    face:   records.filter((r) => r.method === "face").length,
    manual: records.filter((r) => r.method === "manual").length,
  };

  // ── Overall summary ──
  const todayStr    = format(new Date(), "yyyy-MM-dd");
  const todayRecs   = records.filter((r) => r.date === todayStr && r.status !== "absent");
  const avgPct      = studentStats.length > 0
    ? Math.round(studentStats.reduce((a, s) => a + s.pct, 0) / studentStats.length) : 0;
  const lowAttendance = studentStats.filter((s) => s.pct < 75);

  return NextResponse.json({
    summary: {
      totalStudents,
      todayPresent: todayRecs.length,
      todayPct: totalStudents > 0 ? Math.round((todayRecs.length / totalStudents) * 100) : 0,
      avgPct,
      lowAttendanceCount: lowAttendance.length,
    },
    dailyTrend,
    studentStats,
    methods,
    range,
    startStr,
    endStr,
  });
});

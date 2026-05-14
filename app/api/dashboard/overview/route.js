import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";
import Section from "@/models/Section";
import { withAuth } from "@/middleware/auth";
import { format, subDays } from "date-fns";

// GET /api/dashboard/overview — cross-section totals for teacher dashboard
export const GET = withAuth(async (request) => {
  await connectDB();
  const teacherId = request.teacher?.id;
  if (!teacherId) return NextResponse.json({ error: "Unauthorized - Teacher only" }, { status: 403 });
  const today = format(new Date(), "yyyy-MM-dd");
  const sevenDaysAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");

  const [totalStudents, totalSections, todayRecords, weekRecords, allStudents] = await Promise.all([
    Student.countDocuments({ teacherId }),
    Section.countDocuments({ teacherId }),
    Attendance.countDocuments({ teacherId, date: today, status: { $ne: "absent" } }),
    Attendance.find({ teacherId, date: { $gte: sevenDaysAgo, $lte: today }, status: { $ne: "absent" } }),
    Student.find({ teacherId }),
  ]);

  const todayPct = totalStudents > 0 ? Math.round((todayRecords / totalStudents) * 100) : 0;

  // Calculate 7-day average per student
  let avgPct = 0;
  if (allStudents.length > 0) {
    const perStudent = allStudents.map(s => {
      const mine = weekRecords.filter(r => r.studentId.toString() === s._id.toString());
      return Math.round((mine.length / 7) * 100);
    });
    avgPct = Math.round(perStudent.reduce((a, b) => a + b, 0) / allStudents.length);
  }

  return NextResponse.json({
    totalStudents,
    totalSections,
    todayPresent: todayRecords,
    todayPct,
    avgPct,
  });
});

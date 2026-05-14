import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Student from "@/models/Student";
import Section from "@/models/Section";
import Attendance from "@/models/Attendance";
import jwt from "jsonwebtoken";

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "student") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const student = await Student.findById(decoded.id).populate("sectionIds", "name schedule");
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    // Calculate section-wise attendance
    const sectionsWithStats = await Promise.all(student.sectionIds.map(async (sec) => {
      // Total classes held for this section (unique dates in Attendance)
      const totalClassesDates = await Attendance.distinct("date", { sectionId: sec._id });
      const totalClasses = totalClassesDates.length;

      // Classes attended by THIS student
      const attended = await Attendance.countDocuments({ 
        sectionId: sec._id, 
        studentId: student._id, 
        status: { $in: ["present", "late"] } 
      });

      const pct = totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : 100; // Default 100 if no classes yet

      return {
        _id: sec._id,
        name: sec.name,
        schedule: sec.schedule,
        totalClasses,
        attended,
        percentage: pct
      };
    }));

    return NextResponse.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        studentId: student.studentId,
        isBlocked: student.isBlocked,
        sections: sectionsWithStats,
      }
    });
  } catch (err) {
    console.error("Student profile error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Student from "@/models/Student";
import Attendance from "@/models/Attendance";
import { withAuth } from "@/middleware/auth";

export const GET = withAuth(async (request, { params }) => {
  await connectDB();
  const student = await Student.findOne({ _id: params.id, teacherId: request.teacher.id })
    .populate("sectionIds", "name");
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  return NextResponse.json({ student });
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    await connectDB();
    const body = await request.json();

    const teacherId = request.teacher?.id;
    if (!teacherId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const student = await Student.findOne({ _id: params.id, teacherId });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    if (body.name !== undefined) student.name = body.name.trim();
    if (body.studentId !== undefined) student.studentId = body.studentId.trim().toUpperCase();
    if (body.email !== undefined) student.email = body.email.trim().toLowerCase();
    if (body.password) student.password = body.password; // pre-save hook handles hashing
    if (body.isBlocked !== undefined) student.isBlocked = body.isBlocked;
    if (body.sectionIds !== undefined) student.sectionIds = body.sectionIds;
    if (body.photo !== undefined) student.photo = body.photo;

    await student.save();
    await student.populate("sectionIds", "name");

    return NextResponse.json({ student });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return NextResponse.json({ error: messages.join(', ') }, { status: 400 });
    }
    if (err.code === 11000) {
      if (err.keyPattern?.email) return NextResponse.json({ error: "This email address is already registered." }, { status: 409 });
      if (err.keyPattern?.studentId) return NextResponse.json({ error: "This Student ID is already used in your classroom." }, { status: 409 });
      return NextResponse.json({ error: "Duplicate record error." }, { status: 409 });
    }
    return NextResponse.json({ error: "Server error while updating student" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    await connectDB();
    const teacherId = request.teacher?.id;
    if (!teacherId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const student = await Student.findOne({ _id: params.id, teacherId });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    await Attendance.deleteMany({ studentId: params.id });
    await student.deleteOne();

    return NextResponse.json({ message: "Student and attendance records deleted" });
  } catch (error) {
    console.error("Delete student error:", error);
    return NextResponse.json({ error: "Failed to delete student: " + error.message }, { status: 500 });
  }
});

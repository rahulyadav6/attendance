import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Student from "@/models/Student";
import { withAuth } from "@/middleware/auth";

// GET /api/students?sectionId=xxx
export const GET = withAuth(async (request) => {
  await connectDB();
  const teacherId = request.teacher?.id;
  if (!teacherId) return NextResponse.json({ error: "Unauthorized - Teacher only" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");

  const query = { teacherId };
  if (sectionId) query.sectionIds = sectionId;

  const students = await Student.find(query)
    .populate("sectionIds", "name")
    .sort({ name: 1 });

  return NextResponse.json({ students });
});

// POST /api/students — add a new student
export const POST = withAuth(async (request) => {
  await connectDB();
  const teacherId = request.teacher?.id;
  if (!teacherId) return NextResponse.json({ error: "Unauthorized - Teacher only" }, { status: 403 });
  const { name, studentId, email, password, sectionId, photo } = await request.json();

  if (!name?.trim() || !studentId?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json(
      { error: "Name, student ID, email, and password are required" },
      { status: 400 }
    );
  }

  try {
    let student = await Student.findOne({ email: email.trim().toLowerCase(), teacherId });

    if (student) {
      if (sectionId && !student.sectionIds.includes(sectionId)) {
        student.sectionIds.push(sectionId);
        await student.save();
      }
    } else {
      student = await Student.create({
        name: name.trim(),
        studentId: studentId.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        sectionIds: sectionId ? [sectionId] : [],
        teacherId,
        photo: photo || "",
        descriptor: [],
      });
    }

    await student.populate("sectionIds", "name");

    // Notify the student's browser in real-time if they are connected
    try {
      const { getIO } = await import("@/lib/socket");
      const io = getIO();
      if (io && sectionId) {
        // Emit to a room keyed by studentId string (e.g. "student:100")
        io.to(`student:${student.studentId}`).emit("section_added", {
          sectionId,
          sectionName: student.sectionIds.find(s => s._id.toString() === sectionId)?.name,
        });
      }
    } catch (e) {}

    return NextResponse.json({ student }, { status: 201 });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return NextResponse.json({ error: messages.join(', ') }, { status: 400 });
    }
    if (err.code === 11000) {
      if (err.keyPattern?.email) return NextResponse.json({ error: "This email address is already registered to another user." }, { status: 409 });
      if (err.keyPattern?.studentId) return NextResponse.json({ error: "This Student ID is already used in your classroom." }, { status: 409 });
      return NextResponse.json({ error: "Duplicate record error." }, { status: 409 });
    }
    console.error("Failed to add student:", err);
    return NextResponse.json({ error: "Server error while saving student" }, { status: 500 });
  }
});

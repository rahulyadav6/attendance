import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Student from "@/models/Student";
import { withAuth } from "@/middleware/auth";

// POST /api/students/:id/train — save face descriptor from face-api.js
export const POST = withAuth(async (request, { params }) => {
  await connectDB();
  const { descriptor } = await request.json();

  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return NextResponse.json(
      { error: "descriptor must be an array of 128 numbers from face-api.js" },
      { status: 400 }
    );
  }

  const student = await Student.findOneAndUpdate(
    { _id: params.id, teacherId: request.teacher.id },
    { descriptor },
    { new: true }
  );

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  return NextResponse.json({ message: "Face descriptor saved", trained: true });
});

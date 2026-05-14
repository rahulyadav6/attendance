import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Section from "@/models/Section";
import Student from "@/models/Student";
import { withAuth } from "@/middleware/auth";

// GET /api/sections — list all sections for this teacher
export const GET = withAuth(async (request) => {
  await connectDB();
  const teacherId = request.teacher?.id;
  if (!teacherId) return NextResponse.json({ error: "Unauthorized - Teacher only" }, { status: 403 });

  const sections = await Section.find({ teacherId }).sort({ createdAt: -1 });

  // Attach student count to each section
  const sectionsWithCount = await Promise.all(
    sections.map(async (s) => {
      const count = await Student.countDocuments({ sectionIds: s._id });
      return { ...s.toObject(), studentCount: count };
    })
  );

  return NextResponse.json({ sections: sectionsWithCount });
});

// POST /api/sections — create a new section
export const POST = withAuth(async (request) => {
  await connectDB();
  const teacherId = request.teacher?.id;
  if (!teacherId) return NextResponse.json({ error: "Unauthorized - Teacher only" }, { status: 403 });
  const { name, schedule } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Section name is required" }, { status: 400 });
  }

  const section = await Section.create({ name: name.trim(), schedule: schedule?.trim() || "", teacherId });
  return NextResponse.json({ section }, { status: 201 });
});

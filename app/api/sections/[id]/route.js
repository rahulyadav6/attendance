import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Section from "@/models/Section";
import Student from "@/models/Student";
import Attendance from "@/models/Attendance";
import { withAuth } from "@/middleware/auth";

export const GET = withAuth(async (request, { params }) => {
  await connectDB();
  const section = await Section.findOne({ _id: params.id, teacherId: request.teacher.id });
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  return NextResponse.json({ section });
});

export const PUT = withAuth(async (request, { params }) => {
  await connectDB();
  const { name, schedule } = await request.json();
  const section = await Section.findOneAndUpdate(
    { _id: params.id, teacherId: request.teacher.id },
    { name: name?.trim(), schedule: schedule?.trim() || "" },
    { new: true, runValidators: true }
  );
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  return NextResponse.json({ section });
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    await connectDB();
    const teacherId = request.teacher.id;
    const section = await Section.findOne({ _id: params.id, teacherId });
    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

    // Remove this section from all students' sectionIds array
    await Student.updateMany(
      { sectionIds: params.id },
      { $pull: { sectionIds: params.id } }
    );

    // Delete attendance records for this section
    await Attendance.deleteMany({ sectionId: params.id });
    
    await section.deleteOne();

    // Broadcast to all students in this section: section is gone + any active QR session is ended
    try {
      const { getIO } = await import("@/lib/socket");
      const io = getIO();
      if (io) {
        io.to(`section:${params.id}`).emit("session_ended", { sectionId: params.id });
        io.to(`section:${params.id}`).emit("section_removed", { sectionId: params.id });
        io.to(params.id).emit("session_ended", { sectionId: params.id });
        io.to(params.id).emit("section_removed", { sectionId: params.id });
      }
    } catch (e) {}

    return NextResponse.json({ message: "Section deleted successfully" });
  } catch (error) {
    console.error("Delete section error:", error);
    return NextResponse.json({ error: "Failed to delete section: " + error.message }, { status: 500 });
  }
});

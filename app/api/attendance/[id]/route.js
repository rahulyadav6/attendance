import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Attendance from "@/models/Attendance";
import { withAuth } from "@/middleware/auth";

export const PUT = withAuth(async (request, { params }) => {
  await connectDB();
  const { status } = await request.json(); // e.g., "absent"

  const record = await Attendance.findOneAndUpdate(
    { _id: params.id, teacherId: request.teacher.id },
    { status, method: "manual" },
    { new: true }
  );

  if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  return NextResponse.json({ record });
});

export const DELETE = withAuth(async (request, { params }) => {
  await connectDB();
  const record = await Attendance.findOneAndDelete({ _id: params.id, teacherId: request.teacher.id });
  if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  return NextResponse.json({ message: "Record deleted" });
});

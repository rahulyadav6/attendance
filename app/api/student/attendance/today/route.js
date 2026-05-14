import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";
import Section from "@/models/Section";
import jwt from "jsonwebtoken";
import { format } from "date-fns";

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "student") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const today = format(new Date(), "yyyy-MM-dd");

    const records = await Attendance.find({
      studentId: decoded.id,
      date: today,
    }).populate("sectionId", "name");

    const attendance = records.map((r) => ({
      status: r.status,
      method: r.method,
      markedAt: r.markedAt,
      sectionName: r.sectionId?.name || "Unknown section",
      date: r.date,
    }));

    return NextResponse.json({ attendance });
  } catch (err) {
    console.error("Today attendance error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

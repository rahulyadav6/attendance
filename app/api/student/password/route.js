import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Student from "@/models/Student";
import { withAuth } from "@/middleware/auth";

export const POST = withAuth(async (request) => {
  try {
    if (request.userRole !== "student") {
      return NextResponse.json({ error: "Unauthorized endpoint" }, { status: 403 });
    }

    await connectDB();
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Both passwords are required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    const student = await Student.findById(request.student.id).select("+password");
    if (!student) {
      return NextResponse.json({ error: "Student not found", reauth: true }, { status: 401 });
    }

    const isMatch = await student.comparePassword(currentPassword);
    if (!isMatch) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    student.password = newPassword;
    await student.save(); // triggers pre-save hash

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return NextResponse.json({ error: messages.join(', ') }, { status: 400 });
    }
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
});

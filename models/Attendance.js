import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    date:      { type: String, required: true },     // "YYYY-MM-DD" for easy daily grouping
    status:    { type: String, enum: ["present", "absent", "late"], default: "present" },
    method:    { type: String, enum: ["qr", "face", "manual"], required: true },
    markedAt:  { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One record per student per day per section
AttendanceSchema.index(
  { studentId: 1, sectionId: 1, date: 1 },
  { unique: true }
);

export default mongoose.models.Attendance ||
  mongoose.model("Attendance", AttendanceSchema);

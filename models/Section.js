import mongoose from "mongoose";

const SectionSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    schedule:  { type: String, trim: true, default: "" },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Section ||
  mongoose.model("Section", SectionSchema);

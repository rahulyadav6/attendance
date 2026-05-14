import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    studentId:   { type: String, required: true, trim: true },
    email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:    { type: String, required: true, minlength: 6, select: false },
    sectionIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: "Section" }],
    teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    photo:       { type: String, default: "" },
    descriptor:  { type: [Number], default: [] },
    isBlocked:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

StudentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const bcrypt = await import("bcryptjs");
  this.password = await bcrypt.default.hash(this.password, 12);
  next();
});

StudentSchema.methods.comparePassword = async function (candidate) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.compare(candidate, this.password);
};

StudentSchema.index({ studentId: 1, teacherId: 1 }, { unique: true });

export default mongoose.models.Student ||
  mongoose.model("Student", StudentSchema);

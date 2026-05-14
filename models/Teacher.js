import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const TeacherSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
  },
  { timestamps: true }
);

TeacherSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

TeacherSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

TeacherSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.models.Teacher ||
  mongoose.model("Teacher", TeacherSchema);

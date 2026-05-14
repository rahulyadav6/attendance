import mongoose from "mongoose";

const QRSessionSchema = new mongoose.Schema(
  {
    token:     { type: String, required: true, unique: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    date:      { type: String, required: true },     // "YYYY-MM-DD"
    expiresAt: { type: Date, required: true },
    used:      { type: Boolean, default: false },    // prevents re-use after expiry window
    scannedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // tracks who scanned
  },
  { timestamps: true }
);

// Auto-delete expired sessions after 24 hours
QRSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.models.QRSession ||
  mongoose.model("QRSession", QRSessionSchema);

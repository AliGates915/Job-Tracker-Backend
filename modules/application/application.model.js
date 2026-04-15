import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    companyName: String,
    position: String,
    jobLink: String,
    appliedDate: Date,
    status: {
      type: String,
      enum: ["Applied", "Screening", "Interview", "Offer", "Rejected"],
      default: "Applied",
    },
    contactPerson: String,
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model("Application", applicationSchema);
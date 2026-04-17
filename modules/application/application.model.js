import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    position: {
      type: String,
      required: true,
    },
    jobLink: String,
    appliedDate: {
      type: Date,
      required: true,
    },
    contactPerson: String,
    status: {
      type: String,
      enum: ["Applied", "Screening", "Interview", "Offer", "Rejected"],
      default: "Applied",
    },
    notes: String,
    resumeDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
    },
    coverLetterDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
    },
    reminderDate: {
      type: Date,
      validate: {
        validator: function(v) {
          if (["Screening", "Interview", "Offer"].includes(this.status)) {
            return v != null && v instanceof Date;
          }
          return true;
        },
        message: "Reminder date is required for Screening, Interview, and Offer statuses"
      }
    },
  },
  { timestamps: true }
);

// Index for efficient queries
applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ userId: 1, appliedDate: -1 });

export default mongoose.model("Application", applicationSchema);
import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    reminderDate: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ["interview", "follow-up", "deadline"],
      required: true,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: Date,
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
reminderSchema.index({ reminderDate: 1, emailSent: 1 });
reminderSchema.index({ userId: 1, reminderDate: -1 });
reminderSchema.index({ applicationId: 1 });

export default mongoose.model("Reminder", reminderSchema);
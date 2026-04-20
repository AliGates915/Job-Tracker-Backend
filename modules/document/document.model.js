// backend/modules/document/document.model.js
import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["resume", "cover_letter"],
      required: true,
    },
    fileSize: Number,
    resourceType: String,
    mimeType: String,
  },
  { timestamps: true }
);

// Index for efficient queries
documentSchema.index({ userId: 1, fileType: 1 });
documentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Document", documentSchema);
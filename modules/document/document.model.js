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
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    publicId: String,
    fileType: {
      type: String,
      enum: ["resume", "cover_letter"],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
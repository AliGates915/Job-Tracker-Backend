import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    fileName: String,
    fileUrl: String,
    fileType: {
      type: String,
      enum: ["resume", "cover_letter"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
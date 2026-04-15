import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    title: String,
    description: String,
    reminderDate: Date,
    type: {
      type: String,
      enum: ["interview", "follow-up", "deadline"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Reminder", reminderSchema);
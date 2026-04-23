import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: String,
    email: { type: String, unique: true },
    password: String,
    notificationsEnabled: {
      type: Boolean,
      default: true, // User can enable/disable notifications
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
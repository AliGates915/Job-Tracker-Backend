import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["application", "interview", "reminder", "follow-up", "deadline", "system"],
    default: "reminder",
  },
  read: {
    type: Boolean,
    default: false,
  },
  enabled: {
    type: Boolean,
    default: true, // User can enable/disable notifications
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Application",
  },
  reminderDate: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  readAt: {
    type: Date,
  },
});

// Index for faster queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
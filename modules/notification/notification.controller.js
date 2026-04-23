import Notification from "./notification.model.js";
import User from "../auth/auth.model.js";

// Create a notification
export const createNotification = async (userId, title, message, type, relatedId = null, reminderDate = null) => {
  try {
    // Check if user has notifications enabled
    const user = await User.findById(userId);
    if (!user || user.notificationsEnabled === false) {
      console.log(`📢 Notifications disabled for user: ${userId}`);
      return null;
    }

    const notification = new Notification({
      userId,
      title,
      message,
      type,
      relatedId,
      reminderDate,
      read: false,
      enabled: true,
    });

    await notification.save();
    console.log(`📢 Notification created: ${title} for user ${userId}`);
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

// Get user's notifications
export const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.query;
    const { limit = 50, unreadOnly = false } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const query = { userId };
    if (unreadOnly === "true") {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });

    res.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const notification = await Notification.findOne({ _id: id, userId });
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.body;

    await Notification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const notification = await Notification.findOneAndDelete({ _id: id, userId });
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Toggle notifications on/off for user
export const toggleNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { enabled } = req.body;
    console.log(`Toggling notifications for user ${userId}: ${enabled}`);
    

    const user = await User.findByIdAndUpdate(
      userId,
      { notificationsEnabled: enabled },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: `Notifications ${enabled ? "enabled" : "disabled"}`,
      data: { notificationsEnabled: user.notificationsEnabled },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get notification settings
export const getNotificationSettings = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("notificationsEnabled");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        notificationsEnabled: user.notificationsEnabled !== false, // Default to true
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
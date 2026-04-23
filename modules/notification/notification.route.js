import express from "express";
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  toggleNotifications,
  getNotificationSettings,
} from "./notification.controller.js";

const router = express.Router();

router.get("/", getUserNotifications);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);
router.delete("/:id", deleteNotification);
router.patch("/settings/:userId/toggle", toggleNotifications);
router.get("/settings/:userId", getNotificationSettings);

export default router;
import express from "express";
import {
  getUserReminders,
  getUpcomingReminders,
  deleteReminder,
  updateReminderStatus,
  testEmail,
  manualTriggerReminder,
} from "./reminder.controller.js";

const router = express.Router();

router.get("/", getUserReminders);
router.get("/upcoming", getUpcomingReminders);
router.delete("/:id", deleteReminder);
router.patch("/:id/status", updateReminderStatus);
router.post("/:reminderId/trigger", manualTriggerReminder);

// backend/modules/reminder/reminder.routes.js
router.get("/test-email", testEmail);

export default router;
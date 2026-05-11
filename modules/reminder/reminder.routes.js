import express from "express";
import {
  startReminderScheduler,
  checkOverdueRemindersOnStartup,
  getUserReminders,
  getUpcomingReminders,
  forceCheckReminders , 
  deleteReminder,
  updateReminderStatus,
  testEmail,
  manualTriggerReminder,
  toggleEmailNotifications,  
  getEmailNotificationStatus 
} from "./reminder.controller.js";

const router = express.Router();

router.get("/", getUserReminders);
router.get("/upcoming", getUpcomingReminders);
router.delete("/:id", deleteReminder);
router.patch("/:id/status", updateReminderStatus);
router.post("/:reminderId/trigger", manualTriggerReminder);


// START REMINDER SYSTEM - THIS IS CRITICAL
(async () => {
  console.log('🚀 Initializing reminder system...');
  
  // Check for overdue reminders immediately on startup
  await checkOverdueRemindersOnStartup();
  
  // Start the scheduler for future reminders
  startReminderScheduler();
  
  console.log('✅ Reminder system initialized');
})();



router.post('/reminders/force-check', forceCheckReminders);


// backend/modules/reminder/reminder.routes.js
router.get("/test-email", testEmail);

// // Email notification toggle endpoints
router.put('/users/:userId/email-notifications', toggleEmailNotifications);
router.get('/users/:userId/email-notifications', getEmailNotificationStatus);

export default router;

import Reminder from "./reminder.model.js";
import Application from "../application/application.model.js";
import User from "../auth/auth.model.js";
import { sendReminderEmail, sendDailyDigest } from "../../config/email.config.js";
import cron from 'node-cron';

// Helper function to get reminder type from status
const getReminderType = (status) => {
  switch (status) {
    case "Interview":
      return "interview";
    case "Screening":
      return "follow-up";
    case "Offer":
      return "deadline";
    default:
      return "follow-up";
  }
};

// Create reminder from application
export const createReminderFromApplication = async (application, userId) => {
  try {
    // Don't create reminder for Applied or Rejected status
    if (["Applied", "Rejected"].includes(application.status)) {
      return null;
    }

    // Check if reminder already exists for this application
    const existingReminder = await Reminder.findOne({
      applicationId: application._id,
    });

    if (existingReminder) {
      // Update existing reminder
      existingReminder.reminderDate = application.reminderDate;
      existingReminder.title = `${application.status} - ${application.companyName}`;
      existingReminder.description = `${application.status} for ${application.position} position at ${application.companyName}. ${application.notes || ''}`;
      existingReminder.type = getReminderType(application.status);
      await existingReminder.save();
      return existingReminder;
    }

    // Create new reminder
    const reminder = await Reminder.create({
      userId,
      applicationId: application._id,
      title: `${application.status} - ${application.companyName}`,
      description: `${application.status} for ${application.position} position at ${application.companyName}. ${application.notes || ''}`,
      reminderDate: application.reminderDate,
      type: getReminderType(application.status),
    });

    return reminder;
  } catch (error) {
    console.error("Error creating reminder:", error);
    throw error;
  }
};

// Delete reminder by application ID
export const deleteReminderByApplicationId = async (applicationId) => {
  try {
    await Reminder.deleteMany({ applicationId });
    return true;
  } catch (error) {
    console.error("Error deleting reminder:", error);
    throw error;
  }
};

// Get user's reminders
export const getUserReminders = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const reminders = await Reminder.find({ userId })
      .populate('applicationId', 'companyName position status')
      .sort({ reminderDate: 1 });

    res.json({
      success: true,
      data: reminders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get upcoming reminders
export const getUpcomingReminders = async (req, res) => {
  try {
    const { userId, days = 7 } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + parseInt(days));

    const reminders = await Reminder.find({
      userId,
      reminderDate: { $gte: now, $lte: future },
      emailSent: false,
    })
      .populate('applicationId', 'companyName position status')
      .sort({ reminderDate: 1 });

    res.json({
      success: true,
      data: reminders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete reminder
export const deleteReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    await reminder.deleteOne();
    res.json({
      success: true,
      message: "Reminder deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update reminder status
export const updateReminderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    reminder.status = status;
    if (status === "sent") {
      reminder.emailSent = true;
      reminder.emailSentAt = new Date();
    }

    await reminder.save();
    res.json({
      success: true,
      data: reminder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cron job to send reminder emails (runs every hour)
export const startReminderScheduler = () => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('🕐 Checking for reminders to send...', new Date().toISOString());
    
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      
      // Find reminders that need to be sent
      const reminders = await Reminder.find({
        reminderDate: { $gte: now, $lte: oneHourFromNow },
        emailSent: false,
        status: "pending",
        retryCount: { $lt: 3 }, // Max 3 retries
      }).populate('userId', 'email name');
      
      console.log(`📧 Found ${reminders.length} reminders to process`);
      
      for (const reminder of reminders) {
        if (reminder.userId && reminder.userId.email) {
          const result = await sendReminderEmail(reminder.userId.email, reminder);
          
          if (result.success) {
            reminder.emailSent = true;
            reminder.emailSentAt = new Date();
            reminder.status = "sent";
            console.log(`✅ Email sent for reminder: ${reminder.title}`);
          } else {
            reminder.retryCount += 1;
            reminder.status = reminder.retryCount >= 3 ? "failed" : "pending";
            console.log(`❌ Failed to send email for reminder: ${reminder.title}, retry: ${reminder.retryCount}`);
          }
          
          await reminder.save();
        }
      }
    } catch (error) {
      console.error('Error in reminder scheduler:', error);
    }
  });
  
  // Send daily digest at 8 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('📅 Sending daily digest...', new Date().toISOString());
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Get all users with reminders for today
      const reminders = await Reminder.find({
        reminderDate: { $gte: today, $lt: tomorrow },
        emailSent: false,
      }).populate('userId', 'email name');
      
      // Group reminders by user
      const userReminders = {};
      for (const reminder of reminders) {
        if (reminder.userId && reminder.userId.email) {
          if (!userReminders[reminder.userId._id]) {
            userReminders[reminder.userId._id] = {
              email: reminder.userId.email,
              name: reminder.userId.name,
              reminders: [],
            };
          }
          userReminders[reminder.userId._id].reminders.push(reminder);
        }
      }
      
      // Send digest to each user
      for (const userId in userReminders) {
        const { email, name, reminders } = userReminders[userId];
        if (reminders.length > 0) {
          await sendDailyDigest(email, reminders, name);
          console.log(`📬 Sent daily digest to ${email} with ${reminders.length} reminders`);
        }
      }
      
      console.log(`✅ Daily digest sent to ${Object.keys(userReminders).length} users`);
    } catch (error) {
      console.error('Error sending daily digest:', error);
    }
  });
  
  // Clean up old reminders (run weekly)
  cron.schedule('0 0 * * 0', async () => {
    console.log('🧹 Cleaning up old reminders...');
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const result = await Reminder.deleteMany({
        reminderDate: { $lt: thirtyDaysAgo },
        emailSent: true,
      });
      
      console.log(`🗑️ Cleaned up ${result.deletedCount} old reminders`);
    } catch (error) {
      console.error('Error cleaning up reminders:', error);
    }
  });
};

// Manually trigger reminder for testing
export const manualTriggerReminder = async (req, res) => {
  try {
    const { reminderId } = req.params;
    const reminder = await Reminder.findById(reminderId).populate('userId', 'email name');
    
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }
    
    const result = await sendReminderEmail(reminder.userId.email, reminder);
    
    if (result.success) {
      reminder.emailSent = true;
      reminder.emailSentAt = new Date();
      reminder.status = "sent";
      await reminder.save();
    }
    
    res.json({
      success: result.success,
      message: result.success ? "Email sent successfully" : "Failed to send email",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
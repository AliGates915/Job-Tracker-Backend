// backend/modules/reminder/reminder.controller.js
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
      return "application";
  }
};

// backend/modules/reminder/reminder.controller.js
// Add this test endpoint
export const testEmail = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    
    const testReminder = {
      title: "Test Reminder",
      description: "This is a test email from Job Tracker App",
      reminderDate: new Date(),
      type: "follow-up"
    };
    
    const result = await sendReminderEmail(email, testReminder);
    
    res.json({
      success: result.success,
      message: result.success ? "Test email sent successfully" : "Failed to send test email",
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createReminderFromApplication = async (application, userId) => {
  try {
    console.log('📝 Creating reminder for application:', {
      id: application._id,
      status: application.status,
      reminderDate: application.reminderDate,
      userId: userId
    });
    
    // Don't create reminder for Applied or Rejected status
    if (["Applied", "Rejected"].includes(application.status)) {
      console.log('❌ No reminder needed for status:', application.status);
      return null;
    }

    // Check if reminder date exists
    if (!application.reminderDate) {
      console.log('❌ No reminder date provided');
      return null;
    }

    // Check if reminder already exists for this application
    const existingReminder = await Reminder.findOne({
      applicationId: application._id,
    });

    if (existingReminder) {
      console.log('📝 Updating existing reminder:', existingReminder._id);
      existingReminder.reminderDate = application.reminderDate;
      existingReminder.title = `${application.status} - ${application.companyName}`;
      existingReminder.description = `${application.status} for ${application.position} position at ${application.companyName}. ${application.notes || ''}`;
      existingReminder.type = getReminderType(application.status);
      await existingReminder.save();
      console.log('✅ Reminder updated successfully');
      return existingReminder;
    }

    // Create new reminder
    const reminderData = {
      userId,
      applicationId: application._id,
      title: `${application.status} - ${application.companyName}`,
      description: `${application.status} for ${application.position} position at ${application.companyName}. ${application.notes || ''}`,
      reminderDate: application.reminderDate,
      type: getReminderType(application.status),
      status: "pending",
      emailSent: false,
      retryCount: 0,
    };
    
    console.log('📝 Creating reminder with data:', reminderData);
    const reminder = await Reminder.create(reminderData);
    console.log('✅ Reminder created successfully:', reminder._id);
    return reminder;
  } catch (error) {
    console.error("❌ Error creating reminder:", error);
    throw error;
  }
};
// Get user's reminders
export const getUserReminders = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "userId is required" 
      });
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
      return res.status(400).json({ 
        success: false,
        message: "userId is required" 
      });
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
      return res.status(404).json({ 
        success: false,
        message: "Reminder not found" 
      });
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
      return res.status(404).json({ 
        success: false,
        message: "Reminder not found" 
      });
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

// Manually trigger reminder for testing
export const manualTriggerReminder = async (req, res) => {
  try {
    const { reminderId } = req.params;
    const reminder = await Reminder.findById(reminderId).populate('userId', 'email name');
    
    if (!reminder) {
      return res.status(404).json({ 
        success: false,
        message: "Reminder not found" 
      });
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

// Delete reminder by application ID (utility function)
export const deleteReminderByApplicationId = async (applicationId) => {
  try {
    await Reminder.deleteMany({ applicationId });
    console.log(`Reminders deleted for application ${applicationId}`);
    return true;
  } catch (error) {
    console.error("Error deleting reminder:", error);
    throw error;
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
        retryCount: { $lt: 3 },
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
            console.log(`❌ Failed to send email for reminder: ${reminder.title}`);
          }
          
          await reminder.save();
        }
      }
    } catch (error) {
      console.error('Error in reminder scheduler:', error);
    }
  });
  
  console.log('✅ Reminder scheduler started');
};
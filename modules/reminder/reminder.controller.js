// backend/modules/reminder/reminder.controller.js
import Reminder from "./reminder.model.js";
import Application from "../application/application.model.js";
import User from "../auth/auth.model.js";
import { sendReminderEmail, sendDailyDigest } from "../../config/email.config.js";
import cron from 'node-cron';
import {createNotification} from '../notification/notification.controller.js'

// Helper function to get reminder type from status
const getReminderType = (status) => {
  switch (status) {
    case "Interview":
      return "interview";
    case "Applied":
      return "application";
    case "Screening":
      return "follow-up";
    case "Offer":
      return "deadline";
    default:
      return "application";
  }
};

// Helper function to check if user has email notifications enabled
const isEmailEnabledForUser = async (userId) => {
  try {
    const user = await User.findById(userId);
    // Check if user exists and has email notifications enabled
    // Assuming the User model has an 'emailNotificationsEnabled' field
    // If not, you'll need to add it to your User schema
    return user && user.emailNotificationsEnabled === true;
  } catch (error) {
    console.error(`❌ Error checking user email status: ${error.message}`);
    return false;
  }
};

// UPDATED: Function to send email immediately (only if user has notifications enabled)
const sendEmailImmediately = async (reminder, userEmail, userId) => {
  try {
    // FIRST: Check if user has email notifications enabled
    const isEnabled = await isEmailEnabledForUser(userId);
    
    if (!isEnabled) {
      console.log(`⚠️ Email notifications disabled for user ${userId}. Skipping email send.`);
      // Still create notification but mark email as not needed
      const notificationTitle = `Reminder: ${reminder.title}`;
      const notificationMessage = reminder.description || "You have an upcoming reminder";
      
      await createNotification(
        userId,
        notificationTitle,
        notificationMessage,
        reminder.type,
        reminder.applicationId,
        reminder.reminderDate
      );
      
      // Mark as "skipped" or keep as pending for later? Let's mark as sent since email is disabled
      reminder.emailSent = true; // Mark as sent to avoid future attempts
      reminder.emailSentAt = new Date();
      reminder.status = "sent";
      await reminder.save();
      
      return { success: true, skipped: true, message: "Email notifications disabled for user" };
    }
    
    // User has email enabled, proceed with sending
    console.log(`📧 Attempting to send email to: ${userEmail}`);
    const result = await sendReminderEmail(userEmail, reminder);
    
    // ALSO CREATE NOTIFICATION (separate from email)
    const notificationTitle = `Reminder: ${reminder.title}`;
    const notificationMessage = reminder.description || "You have an upcoming reminder";
    
    await createNotification(
      userId,
      notificationTitle,
      notificationMessage,
      reminder.type,
      reminder.applicationId,
      reminder.reminderDate
    );
    
    if (result.success) {
      reminder.emailSent = true;
      reminder.emailSentAt = new Date();
      reminder.status = "sent";
      await reminder.save();
      console.log(`✅ Email sent successfully for reminder: ${reminder.title}`);
    } else {
      console.error(`❌ Failed to send email: ${result.error}`);
      reminder.status = "pending";
      reminder.retryCount += 1;
      await reminder.save();
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error sending email: ${error.message}`);
    reminder.retryCount += 1;
    await reminder.save();
    return { success: false, error: error.message };
  }
};

// UPDATED: Create reminder and send email immediately (respects user's enabled setting)
export const createReminderFromApplication = async (application, userId) => {
  try {
    console.log('📝 Creating reminder for application:', {
      id: application._id,
      status: application.status,
      reminderDate: application.reminderDate,
      userId: userId
    });
    
    // Only block "Rejected" status
    if (["Rejected"].includes(application.status)) {
      console.log('❌ No reminder needed for status: Rejected');
      return null;
    }

    // Check if reminder date exists
    if (!application.reminderDate) {
      console.log('❌ No reminder date provided');
      return null;
    }

    // Get user email from user table
    const user = await User.findById(userId);
    if (!user || !user.email) {
      console.error('❌ User not found or email missing:', userId);
      throw new Error('User email not found');
    }
    
    console.log(`👤 Found user: ${user.fullName} with email: ${user.email}`);
    console.log(`📧 Email notifications enabled: ${user.emailNotificationsEnabled}`);

    // Check if reminder already exists for this application
    let reminder = await Reminder.findOne({
      applicationId: application._id,
    });

    if (reminder) {
      console.log('📝 Updating existing reminder:', reminder._id);
      reminder.reminderDate = application.reminderDate;
      reminder.title = `${application.status} - ${application.companyName}`;
      reminder.description = `${application.status} for ${application.position} position at ${application.companyName}. ${application.notes || ''}`;
      reminder.type = getReminderType(application.status);
      reminder.status = "pending";
      reminder.emailSent = false;
      await reminder.save();
      console.log('✅ Reminder updated successfully');
      
      // Send email for updated reminder (checks enabled status internally)
      await sendEmailImmediately(reminder, user.email, userId);
      return reminder;
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
    reminder = await Reminder.create(reminderData);
    console.log('✅ Reminder created successfully:', reminder._id);
    
    // Send email immediately for the new reminder (checks enabled status internally)
    await sendEmailImmediately(reminder, user.email, userId);
    
    return reminder;
  } catch (error) {
    console.error("❌ Error creating reminder:", error);
    throw error;
  }
};

// UPDATED: Cron job to send reminder emails (respects user's enabled setting)
export const startReminderScheduler = () => {
  // Run every 15 minutes for more frequent checking
  cron.schedule('*/15 * * * *', async () => {
    console.log('🕐 Checking for pending reminders...', new Date().toISOString());
    
    try {
      const now = new Date();
      const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
      
      // Find reminders that need to be sent (upcoming in next 15 minutes)
      const reminders = await Reminder.find({
        reminderDate: { $gte: now, $lte: fifteenMinutesFromNow },
        emailSent: false,
        status: "pending",
        retryCount: { $lt: 3 },
      });
      
      console.log(`📧 Found ${reminders.length} reminders to process`);
      
      for (const reminder of reminders) {
        // Get user email from user table
        const user = await User.findById(reminder.userId);
        
        if (user && user.email) {
          // Check if user has email notifications enabled
          if (user.emailNotificationsEnabled === true) {
            console.log(`📧 Sending reminder to: ${user.email} for: ${reminder.title}`);
            const result = await sendReminderEmail(user.email, reminder);
            
            if (result.success) {
              reminder.emailSent = true;
              reminder.emailSentAt = new Date();
              reminder.status = "sent";
              console.log(`✅ Email sent for reminder: ${reminder.title}`);
            } else {
              reminder.retryCount += 1;
              reminder.status = reminder.retryCount >= 3 ? "failed" : "pending";
              console.log(`❌ Failed to send email for reminder: ${reminder.title}. Error: ${result.error}`);
            }
          } else {
            console.log(`⚠️ Email notifications disabled for user ${user._id}. Skipping scheduled email for reminder: ${reminder.title}`);
            // Mark as sent to avoid future attempts
            reminder.emailSent = true;
            reminder.emailSentAt = new Date();
            reminder.status = "sent";
          }
          
          // Always create notification regardless of email setting
          const notificationTitle = `Reminder: ${reminder.title}`;
          const notificationMessage = reminder.description || "You have an upcoming reminder";
          
          await createNotification(
            reminder.userId,
            notificationTitle,
            notificationMessage,
            reminder.type,
            reminder.applicationId,
            reminder.reminderDate
          );
          
          await reminder.save();
        } else {
          console.error(`❌ User not found or missing email for reminder: ${reminder._id}`);
          reminder.status = "failed";
          await reminder.save();
        }
      }
    } catch (error) {
      console.error('Error in reminder scheduler:', error);
    }
  });
  
  console.log('✅ Reminder scheduler started (runs every 15 minutes)');
};

// NEW: Endpoint to toggle user email notifications
export const toggleEmailNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { enabled } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Update email notifications setting
    user.emailNotificationsEnabled = enabled;
    await user.save();
    
    res.json({
      success: true,
      message: `Email notifications ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: { emailNotificationsEnabled: user.emailNotificationsEnabled }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// NEW: Get user's email notification status
export const getEmailNotificationStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }
    
    const user = await User.findById(userId).select('emailNotificationsEnabled');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    res.json({
      success: true,
      data: {
        emailNotificationsEnabled: user.emailNotificationsEnabled ?? true // Default to true if not set
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// The rest of your existing functions remain the same...
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
      .sort({ reminderDate: 1, createdAt: 1 });

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

export const manualTriggerReminder = async (req, res) => {
  try {
    const { reminderId } = req.params;
    const reminder = await Reminder.findById(reminderId);
    
    if (!reminder) {
      return res.status(404).json({ 
        success: false,
        message: "Reminder not found" 
      });
    }
    
    // Get user email from user table
    const user = await User.findById(reminder.userId);
    if (!user || !user.email) {
      return res.status(404).json({
        success: false,
        message: "User email not found"
      });
    }
    
    // Check if user has email enabled
    if (user.emailNotificationsEnabled === false) {
      return res.status(400).json({
        success: false,
        message: "Email notifications are disabled for this user"
      });
    }
    
    const result = await sendReminderEmail(user.email, reminder);
    
    if (result.success) {
      reminder.emailSent = true;
      reminder.emailSentAt = new Date();
      reminder.status = "sent";
      await reminder.save();
    } else {
      reminder.retryCount += 1;
      reminder.status = reminder.retryCount >= 3 ? "failed" : "pending";
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
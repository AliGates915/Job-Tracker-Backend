// backend/modules/reminder/reminder.controller.js
import Reminder from "./reminder.model.js";
import Application from "../application/application.model.js";
import User from "../auth/auth.model.js";
import { sendReminderEmail } from "../../config/email.config.js";
import cron from 'node-cron';
import { createNotification } from '../notification/notification.controller.js'

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

// Send email immediately (with validation)
const sendEmailImmediately = async (reminder, userEmail, userId) => {
  try {
    console.log(`📧 Attempting to send email immediately to: ${userEmail}`);
    console.log(`📅 Reminder date: ${reminder.reminderDate}`);
    console.log(`🕐 Current time: ${new Date().toISOString()}`);
    
    const result = await sendReminderEmail(userEmail, reminder);
    
    // Create notification regardless of email success
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

// Check if reminder should be sent immediately
const shouldSendImmediately = (reminderDate) => {
  const now = new Date();
  const reminderTime = new Date(reminderDate);
  const timeDiff = reminderTime.getTime() - now.getTime();
  
  // Send immediately if reminder time is within the last 5 minutes OR next 5 seconds
  console.log(`⏰ Time difference: ${timeDiff}ms (${timeDiff/1000} seconds)`);
  return timeDiff <= 5000; // Within 5 seconds in the future OR any time in the past
};

// CREATE REMINDER FROM APPLICATION - FIXED
export const createReminderFromApplication = async (application, userId) => {
  try {
    console.log('📝 Creating reminder for application:', {
      id: application._id,
      status: application.status,
      reminderDate: application.reminderDate,
      userId: userId
    });
    
    // Skip for Rejected status
    if (application.status === "Rejected") {
      console.log('❌ No reminder needed for status: Rejected');
      return null;
    }

    // Check if reminder date exists
    if (!application.reminderDate) {
      console.log('❌ No reminder date provided');
      return null;
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user || !user.email) {
      console.error('❌ User not found or email missing:', userId);
      throw new Error('User email not found');
    }
    
    console.log(`👤 Found user: ${user.fullName} with email: ${user.email}`);

    // Check if reminder already exists
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
      
      // Check if should send immediately
      if (shouldSendImmediately(reminder.reminderDate)) {
        console.log('⏰ Reminder time is now or in the past, sending immediately...');
        await sendEmailImmediately(reminder, user.email, userId);
      }
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
    
    // ALWAYS check if should send immediately
    const now = new Date();
    const reminderTime = new Date(reminder.reminderDate);
    const timeDiff = reminderTime.getTime() - now.getTime();
    
    console.log(`⏰ Current time: ${now.toISOString()}`);
    console.log(`⏰ Reminder time: ${reminderTime.toISOString()}`);
    console.log(`⏰ Time difference: ${timeDiff}ms (${timeDiff/1000} seconds)`);
    
    if (timeDiff <= 60000) { // Within 1 minute (past or future)
      console.log('⏰ Reminder is due or almost due, sending immediately...');
      await sendEmailImmediately(reminder, user.email, userId);
    } else {
      console.log(`⏰ Reminder scheduled for future: ${reminder.reminderDate}`);
    }
    
    return reminder;
  } catch (error) {
    console.error("❌ Error creating reminder:", error);
    throw error;
  }
};


// FIXED: Cron job to send reminder emails (checks every minute for more precision)
export const startReminderScheduler = () => {
  // Run every 30 seconds for more precise checking
  cron.schedule('*/30 * * * * *', async () => {
    console.log('🕐 Checking for due reminders...', new Date().toISOString());
    
    try {
      const now = new Date();
      // Look for reminders that are due (within the last 5 minutes or next 30 seconds)
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const thirtySecondsFromNow = new Date(now.getTime() + 30 * 1000);
      
      // Find reminders that are due and not sent
      const reminders = await Reminder.find({
        reminderDate: { $gte: fiveMinutesAgo, $lte: thirtySecondsFromNow },
        emailSent: false,
        status: "pending",
        retryCount: { $lt: 3 },
      });
      
      console.log(`📧 Found ${reminders.length} reminders to process at ${now.toISOString()}`);
      
      if (reminders.length > 0) {
        console.log(`📋 Reminder IDs: ${reminders.map(r => r._id).join(', ')}`);
      }
      
      for (const reminder of reminders) {
        // Get user details
        const user = await User.findById(reminder.userId);
        
        if (user && user.email) {
          console.log(`📧 Processing reminder for: ${user.email} - ${reminder.title}`);
          console.log(`⏰ Reminder time: ${reminder.reminderDate}`);
          console.log(`⏰ Current time: ${now.toISOString()}`);
          
          // Check if email is already sent
          if (reminder.emailSent) {
            console.log(`⚠️ Reminder already sent, skipping...`);
            continue;
          }
          
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
          
          // Always create notification
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
  
  console.log('✅ Reminder scheduler started (runs every 30 seconds)');
};


// Also add immediate check when server starts
export const checkOverdueRemindersOnStartup = async () => {
  console.log('🔍 Checking for overdue reminders on startup...');
  console.log(`🕐 Current server time: ${new Date().toISOString()}`);
  
  try {
    const now = new Date();
    // Look for reminders that are overdue (any time in the past up to 24 hours)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const overdueReminders = await Reminder.find({
      reminderDate: { $gte: oneDayAgo, $lte: now },
      emailSent: false,
      status: "pending",
      retryCount: { $lt: 3 },
    });
    
    console.log(`📧 Found ${overdueReminders.length} overdue reminders from the last 24 hours`);
    
    if (overdueReminders.length > 0) {
      console.log(`📋 Overdue reminder IDs: ${overdueReminders.map(r => r._id).join(', ')}`);
    }
    
    for (const reminder of overdueReminders) {
      const user = await User.findById(reminder.userId);
      if (user && user.email) {
        console.log(`📧 Sending overdue reminder to: ${user.email}`);
        console.log(`⏰ Original reminder time: ${reminder.reminderDate}`);
        await sendEmailImmediately(reminder, user.email, reminder.userId);
      } else {
        console.error(`❌ Cannot send overdue reminder - User not found: ${reminder.userId}`);
      }
    }
    
    if (overdueReminders.length === 0) {
      console.log('✅ No overdue reminders found');
    }
  } catch (error) {
    console.error('Error checking overdue reminders:', error);
  }
};

// Add this to your routes for testing
export const forceCheckReminders = async (req, res) => {
  try {
    console.log('🔧 Manually triggering reminder check...');
    
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const thirtySecondsFromNow = new Date(now.getTime() + 30 * 1000);
    
    const reminders = await Reminder.find({
      reminderDate: { $gte: fiveMinutesAgo, $lte: thirtySecondsFromNow },
      emailSent: false,
      status: "pending",
    });
    
    let sentCount = 0;
    
    for (const reminder of reminders) {
      const user = await User.findById(reminder.userId);
      if (user && user.email) {
        const result = await sendReminderEmail(user.email, reminder);
        if (result.success) {
          reminder.emailSent = true;
          reminder.emailSentAt = new Date();
          reminder.status = "sent";
          await reminder.save();
          sentCount++;
        }
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${reminders.length} reminders, sent ${sentCount} emails`,
      data: { totalReminders: reminders.length, sent: sentCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Other existing functions remain the same...
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

export const deleteReminderByApplicationId = async (applicationId) => {
  try {
    const result = await Reminder.deleteMany({ applicationId: applicationId });
    console.log(`Deleted ${result.deletedCount} reminders for application ${applicationId}`);
    return result;
  } catch (error) {
    console.error('Error deleting reminders:', error);
    throw error;
  }
};

export const deleteReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const reminder = await Reminder.findByIdAndDelete(id);
    
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found"
      });
    }
    
    res.json({
      success: true,
      message: "Reminder deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// controllers/reminderController.js or userController.js
export const toggleEmailNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { enabled } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Enabled must be a boolean value'
      });
    }

    // Update user's email notification preference
    const user = await User.findByIdAndUpdate(
      userId,
      { emailNotificationsEnabled: enabled },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Optional: Update all existing reminders for this user
    // This is useful if you want existing reminders to respect the new setting
    await Reminder.updateMany(
      { userId: userId },
      { emailNotificationsEnabled: enabled }
    );

    res.status(200).json({
      success: true,
      message: `Email notifications ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        emailNotificationsEnabled: user.emailNotificationsEnabled
      }
    });
  } catch (error) {
    console.error('Error toggling email notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating email notification settings'
    });
  }
};

// Get user's email notification status
export const getEmailNotificationStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('emailNotificationsEnabled');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        emailNotificationsEnabled: user.emailNotificationsEnabled
      }
    });
  } catch (error) {
    console.error('Error fetching email notification status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching email notification settings'
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



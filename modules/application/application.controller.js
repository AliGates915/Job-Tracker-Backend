import Application from "./application.model.js";
import Document from "../document/document.model.js";
import Reminder from "../reminder/reminder.model.js";
import { createReminderFromApplication } from "../reminder/reminder.controller.js";

export const createApplication = async (req, res) => {
  try {
    // Get userId from the authenticated user (from token)
    const userId = req.user.userId; 
    console.log("User ID", req.user.userId);
    console.log("User ", userId);
    
    // The rest of the data comes from request body
    const applicationData = req.body;
    
    // Validate reminder date for applicable statuses
    const statusesThatNeedReminder = ["Screening", "Interview", "Offer", "Applied"];
    if (statusesThatNeedReminder.includes(applicationData.status)) {
      if (!applicationData.reminderDate) {
        return res.status(400).json({
          success: false,
          message: "Reminder date is required for Screening, Interview, Offer, and Applied statuses",
        });
      }
    }
    
    // Ensure reminderDate is a proper Date object
    if (applicationData.reminderDate) {
      applicationData.reminderDate = new Date(applicationData.reminderDate);
    }
    
    // Create application with userId from token
    const application = await Application.create({
      userId,
      ...applicationData,
    });
    
    // Create reminder in reminders collection if status requires it
    if (applicationData.reminderDate && statusesThatNeedReminder.includes(applicationData.status)) {
      const reminder = await Reminder.create({
        applicationId: application._id,
        userId: userId,
        reminderDate: applicationData.reminderDate,
        type: "follow-up", // or "interview" based on status
        title: `Reminder: ${applicationData.position} at ${applicationData.companyName}`,
        description: `Follow up on ${applicationData.position} application at ${applicationData.companyName}. Current status: ${applicationData.status}`,
        enabled: true,
        emailNotificationsEnabled: true,
        emailSent: false,
        status: "pending",
      });
      console.log('Reminder scheduled for:', reminder.reminderDate);
    }
    
    res.status(201).json({
      success: true,
      data: application,
    });
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


export const updateApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }
    
    // Update application
    const updatedApplication = await Application.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    // Update or create reminder based on new status
    const statusesThatNeedReminder = ["Screening", "Interview", "Offer"];
    if (statusesThatNeedReminder.includes(updatedApplication.status) && updatedApplication.reminderDate) {
      await createReminderFromApplication(updatedApplication, updatedApplication.userId);
    }
    
    res.status(200).json({
      success: true,
      data: updatedApplication,
    });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


export const getApplications = async (req, res) => {
  try {
    // Fix: Use req.user.userId instead of req.user.id
    const userId = req.user.userId || req.user._id || req.user.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const applications = await Application.find({ userId }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single application
export const getApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }
    
    res.json({
      success: true,
      data: application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Add this function to delete reminders by application ID
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

// Delete application
export const deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user._id || req.user.id;
    
    // Find application and verify ownership
    const application = await Application.findOne({ _id: id, userId });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found or you don't have permission to delete it",
      });
    }
    
    // Delete associated reminders
    await deleteReminderByApplicationId(id);
    
    // Delete the application
    await application.deleteOne();
    
    res.json({
      success: true,
      message: "Application deleted successfully",
    });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get applications by status
export const getApplicationsByStatus = async (req, res) => {
  try {
    const { userId, status } = req.query;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }
    
    const applications = await Application.find({ userId, status })
      .sort({ appliedDate: -1 });
    
    res.json({
      success: true,
      data: applications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

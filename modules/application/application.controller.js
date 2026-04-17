import Application from "./application.model.js";
import { createReminderFromApplication, deleteReminderByApplicationId } from "../reminder/reminder.controller.js";

// Create a new application
export const createApplication = async (req, res) => {
  try {
    const { userId, ...applicationData } = req.body;
    
    // Validate reminder date for applicable statuses
    if (["Screening", "Interview", "Offer"].includes(applicationData.status)) {
      if (!applicationData.reminderDate) {
        return res.status(400).json({
          success: false,
          message: "Reminder date is required for Screening, Interview, and Offer statuses",
        });
      }
    }
    
    const application = await Application.create({
      userId,
      ...applicationData,
    });
    
    // Create reminder if status requires it and reminder date is provided
    if (application.reminderDate && ["Screening", "Interview", "Offer"].includes(application.status)) {
      await createReminderFromApplication(application, userId);
    }
    
    // Populate document references if they exist
    const populatedApplication = await Application.findById(application._id)
      .populate('resumeDocumentId')
      .populate('coverLetterDocumentId');
    
    res.status(201).json({
      success: true,
      data: populatedApplication,
    });
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all applications for a user
export const getApplications = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }
    
    const applications = await Application.find({ userId })
      .populate('resumeDocumentId')
      .populate('coverLetterDocumentId')
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

// Get single application
export const getApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id)
      .populate('resumeDocumentId')
      .populate('coverLetterDocumentId');
    
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

// Update application
export const updateApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, status, reminderDate, ...updateData } = req.body;
    
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }
    
    // Update fields
    if (status) application.status = status;
    if (reminderDate !== undefined) application.reminderDate = reminderDate;
    Object.assign(application, updateData);
    
    // Validate reminder date for new status
    if (["Screening", "Interview", "Offer"].includes(application.status)) {
      if (!application.reminderDate) {
        return res.status(400).json({
          success: false,
          message: "Reminder date is required for Screening, Interview, and Offer statuses",
        });
      }
    }
    
    await application.save();
    
    // Handle reminder updates based on status
    if (["Applied", "Rejected"].includes(application.status)) {
      // Delete reminder for Applied or Rejected status
      await deleteReminderByApplicationId(application._id);
    } else if (application.reminderDate) {
      // Create or update reminder for other statuses
      await createReminderFromApplication(application, userId);
    }
    
    const populatedApplication = await Application.findById(application._id)
      .populate('resumeDocumentId')
      .populate('coverLetterDocumentId');
    
    res.json({
      success: true,
      data: populatedApplication,
    });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete application
export const deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
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
      .populate('resumeDocumentId')
      .populate('coverLetterDocumentId')
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
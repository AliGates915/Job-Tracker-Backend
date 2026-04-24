import Application from "./application.model.js";
import Document from "../document/document.model.js";
import Reminder from "../reminder/reminder.model.js";
import { createReminderFromApplication } from "../reminder/reminder.controller.js";

export const createApplication = async (req, res) => {
  try {
    const { userId, resumeDocumentId, coverLetterDocumentId, ...applicationData } = req.body;
    
    // Validate reminder date for applicable statuses
    const statusesThatNeedReminder = ["Screening", "Interview", "Offer", "Applied"];
    if (statusesThatNeedReminder.includes(applicationData.status)) {
      if (!applicationData.reminderDate) {
        return res.status(400).json({
          success: false,
          message: "Reminder date is required for Screening, Interview, and Offer statuses",
        });
      }
    }
    
    // Create application with document references
    const application = await Application.create({
      userId,
      ...applicationData,
      resumeDocumentId: resumeDocumentId || null,
      coverLetterDocumentId: coverLetterDocumentId || null,
    });
    
    // Update documents with application reference if they exist
    if (resumeDocumentId) {
      await Document.findByIdAndUpdate(resumeDocumentId, { 
        applicationId: application._id 
      });
    }
    
    if (coverLetterDocumentId) {
      await Document.findByIdAndUpdate(coverLetterDocumentId, { 
        applicationId: application._id 
      });
    }
    
    // Create reminder if status requires it and reminder date is provided
    if (application.reminderDate && statusesThatNeedReminder.includes(application.status)) {
      const reminder = await createReminderFromApplication(application, userId);
      console.log('Reminder created:', reminder);
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
    
    const applications = await Application.find({ userId });
    
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
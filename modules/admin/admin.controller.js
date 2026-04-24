// modules/admin/admin.controller.js
import Application from "../application/application.model.js";
import User from "../auth/auth.model.js";

// Get all applications with user details
export const getAllApplications = async (req, res) => {
  try {
    const applications = await Application.find()
      .populate('userId', 'fullName email role')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: applications,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete any application by ID (admin)
export const deleteAnyApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }
    
    await application.deleteOne();
    
    res.json({
      success: true,
      message: "Application deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get applications by specific user
export const getUserApplications = async (req, res) => {
  try {
    const { userId } = req.params;
    const applications = await Application.find({ userId })
      .sort({ appliedDate: -1 });
    
    res.json({
      success: true,
      data: applications,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete user and all their applications
export const deleteUserWithApplications = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Delete all applications of this user
    await Application.deleteMany({ userId });
    
    // Delete the user
    const user = await User.findByIdAndDelete(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    res.json({
      success: true,
      message: `User ${user.email} and all their applications deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
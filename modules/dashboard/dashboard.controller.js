// backend/modules/dashboard/dashboard.controller.js
import mongoose from "mongoose";
import Application from "../application/application.model.js";
import User from "../auth/auth.model.js";
import {
  getDashboardStats,
  getRecentApplications,
  getQuickStats,
  getMonthlyTrends
} from "./dashboard.model.js";

// Get all dashboard data in one request
export const getDashboardData = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Fetch all dashboard data in parallel
    const [stats, recentApplications, quickStats, monthlyTrends] = await Promise.all([
      getDashboardStats(userId),
      getRecentApplications(userId, 5),
      getQuickStats(userId),
      getMonthlyTrends(userId)
    ]);
    
    res.json({
      success: true,
      data: {
        stats: {
          total: stats.total || 0,
          applied: stats.applied || 0,
          screening: stats.screening || 0,
          interviews: stats.interview || 0,
          offers: stats.offer || 0,
          rejected: stats.rejected || 0
        },
        recentApplications: recentApplications.map(app => ({
          id: app._id,
          company: app.companyName,
          position: app.position,
          appliedDate: new Date(app.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }),
          status: app.status,
          fullDate: app.createdAt
        })),
        quickStats: {
          responseRate: quickStats.responseRate,
          avgResponseTime: quickStats.avgResponseTime,
          interviewRate: quickStats.interviewRate,
          offerRate: quickStats.offerRate
        },
        monthlyTrends: monthlyTrends
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get only statistics
export const getStats = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }
    
    const stats = await getDashboardStats(userId);
    
    res.json({
      success: true,
      data: {
        total: stats.total || 0,
        applied: stats.applied || 0,
        screening: stats.screening || 0,
        interviews: stats.interview || 0,
        offers: stats.offer || 0,
        rejected: stats.rejected || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get recent applications
export const getRecentApps = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5 } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }
    
    const recentApps = await getRecentApplications(userId, parseInt(limit));
    
    res.json({
      success: true,
      data: recentApps.map(app => ({
        id: app._id,
        company: app.companyName,
        position: app.position,
        appliedDate: new Date(app.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        status: app.status,
        fullDate: app.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get quick stats
export const getQuickStatsData = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }
    
    const quickStats = await getQuickStats(userId);
    
    res.json({
      success: true,
      data: quickStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get monthly trends
export const getTrends = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }
    
    const trends = await getMonthlyTrends(userId);
    
    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get status distribution for charts
export const getStatusDistribution = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }
    
    const stats = await getDashboardStats(userId);
    
    const distribution = [
      { status: "Applied", count: stats.applied || 0, color: "#3b82f6" },
      { status: "Screening", count: stats.screening || 0, color: "#8b5cf6" },
      { status: "Interview", count: stats.interview || 0, color: "#f59e0b" },
      { status: "Offer", count: stats.offer || 0, color: "#10b981" },
      { status: "Rejected", count: stats.rejected || 0, color: "#ef4444" }
    ];
    
    res.json({
      success: true,
      data: distribution.filter(d => d.count > 0)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
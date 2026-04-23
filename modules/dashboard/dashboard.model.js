// backend/modules/dashboard/dashboard.model.js
import mongoose from "mongoose";

// This model is just for reference - we'll use aggregation from other models
// No separate schema needed as we'll aggregate data from Application and User models

export const getDashboardStats = async (userId) => {
  const Application = mongoose.model("Application");
  
  const stats = await Application.aggregate([
    {
      $match: { userId: new mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        applied: { $sum: { $cond: [{ $eq: ["$status", "Applied"] }, 1, 0] } },
        screening: { $sum: { $cond: [{ $eq: ["$status", "Screening"] }, 1, 0] } },
        interview: { $sum: { $cond: [{ $eq: ["$status", "Interview"] }, 1, 0] } },
        offer: { $sum: { $cond: [{ $eq: ["$status", "Offer"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    applied: 0,
    screening: 0,
    interview: 0,
    offer: 0,
    rejected: 0
  };
};

export const getRecentApplications = async (userId, limit = 5) => {
  const Application = mongoose.model("Application");
  
  const recentApps = await Application.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('companyName position status createdAt');
  
  return recentApps;
};

export const getQuickStats = async (userId) => {
  const Application = mongoose.model("Application");
  
  const applications = await Application.find({ userId });
  
  const total = applications.length;
  const nonRejected = applications.filter(app => app.status !== 'Rejected').length;
  const interviews = applications.filter(app => app.status === 'Interview').length;
  const offers = applications.filter(app => app.status === 'Offer').length;
  
  // Calculate response rate (applications with any update besides Applied)
  const responded = applications.filter(app => 
    app.status !== 'Applied' && app.status !== 'Rejected'
  ).length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
  
  // Calculate average response time (in days)
  const appsWithUpdates = applications.filter(app => 
    app.updatedAt && app.createdAt && app.status !== 'Applied'
  );
  const avgResponseTime = appsWithUpdates.length > 0 
    ? (appsWithUpdates.reduce((sum, app) => {
        const daysDiff = (app.updatedAt - app.createdAt) / (1000 * 60 * 60 * 24);
        return sum + daysDiff;
      }, 0) / appsWithUpdates.length).toFixed(1)
    : 0;
  
  // Calculate interview rate
  const interviewRate = total > 0 ? Math.round((interviews / total) * 100) : 0;
  
  // Calculate offer rate (based on interviews)
  const offerRate = interviews > 0 ? Math.round((offers / interviews) * 100) : 0;
  
  return {
    responseRate,
    avgResponseTime: `${avgResponseTime} days`,
    interviewRate: `${interviewRate}%`,
    offerRate: `${offerRate}%`,
    totalApplications: total,
    interviewsCount: interviews,
    offersCount: offers
  };
};

export const getMonthlyTrends = async (userId) => {
  const Application = mongoose.model("Application");
  
  const trends = await Application.aggregate([
    {
      $match: { userId: new mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        count: { $sum: 1 },
        statuses: {
          $push: "$status"
        }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 }
    },
    {
      $limit: 6
    }
  ]);
  
  return trends.map(trend => ({
    month: new Date(trend._id.year, trend._id.month - 1, 1).toLocaleString('default', { month: 'short' }),
    year: trend._id.year,
    applications: trend.count,
    interviews: trend.statuses.filter(s => s === 'Interview').length,
    offers: trend.statuses.filter(s => s === 'Offer').length
  }));
};
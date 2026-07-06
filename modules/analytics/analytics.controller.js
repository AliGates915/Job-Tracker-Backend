import Application from "../application/application.model.js";

export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id || req.user.id;
    const totalApplications = await Application.countDocuments({ user: userId });

    const statusBreakdown = await Application.aggregate([
      {
           $match: { userId },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const monthlyApplications = await Application.aggregate([
      {
           $match: { userId },
      },
      {
        $group: {
          _id: { $month: "$appliedDate" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id": 1 },
      },
    ]);

    res.json({
      totalApplications,
      statusBreakdown,
      monthlyApplications,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};  

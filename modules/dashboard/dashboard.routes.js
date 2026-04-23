// backend/modules/dashboard/dashboard.routes.js
import express from "express";
import {
  getDashboardData,
  getStats,
  getRecentApps,
  getQuickStatsData,
  getTrends,
  getStatusDistribution
} from "./dashboard.controller.js";

const router = express.Router();

// Get all dashboard data (combined)
router.get("/:userId", getDashboardData);

// Get only statistics
router.get("/:userId/stats", getStats);

// Get recent applications
router.get("/:userId/recent", getRecentApps);

// Get quick stats
router.get("/:userId/quick-stats", getQuickStatsData);

// Get monthly trends
router.get("/:userId/trends", getTrends);

// Get status distribution for charts
router.get("/:userId/distribution", getStatusDistribution);

export default router;
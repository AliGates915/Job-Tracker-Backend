// modules/admin/admin.routes.js
import express from "express";
import {
  getAllApplications,
  deleteAnyApplication,
  getUserApplications,
  deleteUserWithApplications,
} from "./admin.controller.js";
import { authenticate, isAdmin } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, isAdmin);

// Application management
router.get("/applications", getAllApplications);
router.delete("/applications/:id", deleteAnyApplication);
router.get("/users/:userId/applications", getUserApplications);

// User management with applications
router.delete("/users/:userId", deleteUserWithApplications);

export default router;
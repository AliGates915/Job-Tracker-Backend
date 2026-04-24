import express from "express";
import { register, login, getProfile, updateProfile, getAllUsers, updateUserRole, deleteUser } from "./auth.controller.js";
import { authenticate, isAdmin, isAdminOrOwner } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes (require authentication)
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);

// Admin only routes
router.get("/users", authenticate, isAdmin, getAllUsers);
router.put("/users/:userId/role", authenticate, isAdmin, updateUserRole);
router.delete("/users/:userId", authenticate, isAdmin, deleteUser);


export default router;
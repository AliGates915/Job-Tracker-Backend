import express from "express";
import { getAnalytics } from "./analytics.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authenticate, getAnalytics);

export default router;

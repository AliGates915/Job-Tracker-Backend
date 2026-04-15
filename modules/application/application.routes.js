import express from "express";
import {
  createApplication,
  getApplications,
  updateApplication,
  deleteApplication,
} from "./application.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js"; // you need an auth middleware

const router = express.Router();
router.use(authenticate); // protect all routes

router.post("/", createApplication);
router.get("/", getApplications);
router.put("/:id", updateApplication);
router.delete("/:id", deleteApplication);

export default router;
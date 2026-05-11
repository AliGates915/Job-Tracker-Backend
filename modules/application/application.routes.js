import express from "express";
import {
  createApplication,
  getApplications,
  updateApplication,
  deleteApplication,
} from "./application.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js"; 


const router = express.Router();
router.use(authenticate); // protect all routes

router.post("/", authenticate, createApplication);
router.get("/", getApplications);
router.put("/:id", updateApplication);
router.delete("/:id", deleteApplication);

export default router;

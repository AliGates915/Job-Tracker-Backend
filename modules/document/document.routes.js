// backend/modules/document/document.routes.js
import express from "express";
import upload from "./multer.config.js";
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
  proxyDocument,
} from "./document.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Public proxy endpoint (no authentication required for the iframe)
// But we'll handle authentication inside the controller
router.get("/proxy/:id", proxyDocument);

// All other routes require authentication
router.use(authenticate);

router.post("/upload", upload.single("file"), uploadDocument);
router.get("/", getDocuments);
router.delete("/:id", deleteDocument);

export default router;
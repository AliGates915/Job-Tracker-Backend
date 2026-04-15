import express from "express";
import upload from "./multer.config.js";
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
} from "./document.controller.js";

const router = express.Router();

router.post("/upload", upload.single("file"), uploadDocument);
router.get("/", getDocuments);
router.delete("/:id", deleteDocument);

export default router;
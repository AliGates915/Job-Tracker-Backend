import Document from "./document.model.js";
import Application from "../application/application.model.js";
import { v2 as cloudinary } from '../../config/cloudinary.js';

export const uploadDocument = async (req, res) => {
  try {
    console.log('=== Upload Request Details ===');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    const { fileType, userId, applicationId } = req.body;
    
    // Validations
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "userId is required" 
      });
    }
    
    if (!["resume", "cover_letter"].includes(fileType)) {
      return res.status(400).json({ 
        success: false,
        message: "fileType must be resume or cover_letter" 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded" 
      });
    }
    
    // Get file URL from Cloudinary
    const fileUrl = req.file.path;
    const publicId = req.file.filename;
    
    console.log('Cloudinary upload successful:', { fileUrl, publicId });
    
    // Save to database
    const newDocument = await Document.create({
      userId,
      applicationId: applicationId || null,
      fileName: req.file.originalname,
      fileUrl: fileUrl,
      publicId: publicId,
      fileType,
    });
    
    console.log('Document saved to database:', newDocument._id);
    
    // Link document to application if applicationId is provided
    if (applicationId) {
      const application = await Application.findById(applicationId);
      if (application) {
        if (fileType === "resume") {
          application.resumeDocumentId = newDocument._id;
        } else if (fileType === "cover_letter") {
          application.coverLetterDocumentId = newDocument._id;
        }
        await application.save();
        console.log(`Document linked to application ${applicationId}`);
      }
    }
    
    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: newDocument,
    });
    
  } catch (error) {
    console.error('=== Upload Error Details ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Handle specific Cloudinary errors
    if (error.message && error.message.includes('Cloudinary')) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary upload failed",
        error: error.message,
      });
    }
    
    // Handle multer errors
    if (error.message && error.message.includes('file')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};


export const getDocuments = async (req, res) => {
  try {
    const { userId, applicationId } = req.query;
    if (!userId) return res.status(400).json({ message: "userId query param required" });
    
    let query = { userId };
    if (applicationId) {
      query.applicationId = applicationId;
    }
    
    const docs = await Document.find(query).sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    
    // Delete from Cloudinary
    if (doc.publicId) {
      await cloudinary.uploader.destroy(doc.publicId);
    }
    
    // Remove reference from application
    if (doc.applicationId) {
      const application = await Application.findById(doc.applicationId);
      if (application) {
        if (application.resumeDocumentId?.toString() === doc._id.toString()) {
          application.resumeDocumentId = null;
        }
        if (application.coverLetterDocumentId?.toString() === doc._id.toString()) {
          application.coverLetterDocumentId = null;
        }
        await application.save();
      }
    }
    
    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
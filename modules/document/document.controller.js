// backend/modules/document/document.controller.js
import Document from "./document.model.js";
import jwt from 'jsonwebtoken';
import Application from "../application/application.model.js";
import cloudinary from '../../config/cloudinary.js';
import axios from 'axios';

export const uploadDocument = async (req, res) => {
  try {
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
    
    // Determine resource type based on file mimetype
    let resourceType = 'auto';
    let isRaw = false;
    
    if (req.file.mimetype === 'application/pdf') {
      resourceType = 'raw'; // Use 'raw' for PDFs
      isRaw = true;
    } else if (req.file.mimetype.startsWith('image/')) {
      resourceType = 'image';
    }
    
    console.log('Uploading to Cloudinary with resource_type:', resourceType);
    
    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `documents/${userId}`,
          resource_type: resourceType,
          public_id: `${Date.now()}-${req.file.originalname.split('.')[0]}`,
          access_mode: 'public', // Force public access
          type: 'upload',
          ...(isRaw && { flags: 'attachment' }) // For PDFs
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      uploadStream.end(req.file.buffer);
    });
    
    console.log('Cloudinary upload successful:', {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      resourceType: uploadResult.resource_type
    });
    
    // For raw resources (PDFs), construct a publicly accessible URL
    let fileUrl = uploadResult.secure_url;
    if (isRaw && uploadResult.public_id) {
      // Use the raw URL format that doesn't require authentication
      fileUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${uploadResult.public_id}`;
    }
    
    // Save to database
    const newDocument = await Document.create({
      userId,
      applicationId: applicationId || null,
      fileName: req.file.originalname,
      fileUrl: fileUrl,
      publicId: uploadResult.public_id,
      fileType,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      resourceType: uploadResult.resource_type,
    });
    
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
      }
    }
    
    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: newDocument,
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error.message,
    });
  }
};


export const proxyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get token from headers
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    // Verify token and get user ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    
    const document = await Document.findOne({ _id: id, userId });
    
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    
    // Fetch the file from Cloudinary
    const response = await axios({
      method: 'get',
      url: document.fileUrl,
      responseType: 'arraybuffer',
    });
    
    // Set headers for inline display
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Send the file data
    res.send(response.data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch document' });
  }
};


export const getDocuments = async (req, res) => {
  try {
    const { userId, applicationId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "userId query param required" 
      });
    }
    
    let query = { userId };
    if (applicationId) {
      query.applicationId = applicationId;
    }
    
    const docs = await Document.find(query).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: docs
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    const document = await Document.findOne({ _id: id, userId });
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }
    
    // Delete from Cloudinary
    if (document.publicId) {
      await cloudinary.uploader.destroy(document.publicId, {
        resource_type: document.resourceType || 'image'
      });
    }
    
    // Remove reference from application if linked
    if (document.applicationId) {
      const application = await Application.findById(document.applicationId);
      if (application) {
        if (document.fileType === "resume") {
          application.resumeDocumentId = null;
        } else if (document.fileType === "cover_letter") {
          application.coverLetterDocumentId = null;
        }
        await application.save();
      }
    }
    
    await Document.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
import Document from "./document.model.js";

export const uploadDocument = async (req, res) => {
  try {
    const { fileType, userId } = req.body;

    const newDocument = await Document.create({
      userId,
      fileName: req.file.originalname,
      fileUrl: req.file.path,
      fileType,
    });

    res.status(201).json({
      message: "Document uploaded successfully",
      data: newDocument,
    });
  } catch (error) {
    res.status(500).json({
      message: "Upload failed",
      error: error.message,
    });
  }
};

export const getDocuments = async (req, res) => {
  const docs = await Document.find();
  res.json(docs);
};

export const deleteDocument = async (req, res) => {
  await Document.findByIdAndDelete(req.params.id);

  res.json({
    message: "Document deleted successfully",
  });
};
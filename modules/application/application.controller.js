import Application from "./application.model.js";

export const createApplication = async (req, res) => {
  const application = await Application.create({ ...req.body, userId: req.user._id });
  res.json(application);
};

export const getApplications = async (req, res) => {
  const applications = await Application.find({ userId: req.user._id });
  res.json(applications);
};

export const updateApplication = async (req, res) => {
  const application = await Application.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    req.body,
    { new: true }
  );
  if (!application) return res.status(404).json({ message: "Not found" });
  res.json(application);
};

export const deleteApplication = async (req, res) => {
  const result = await Application.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!result) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
};
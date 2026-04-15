import User from "../auth/auth.model.js";
import bcrypt from "bcrypt";

export const updateProfile = async (req, res) => {
  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(updatedUser);
};

export const changePassword = async (req, res) => {
  const { newPassword } = req.body;

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await User.findByIdAndUpdate(req.params.id, {
    password: hashedPassword,
  });

  res.json({ message: "Password updated successfully" });
};
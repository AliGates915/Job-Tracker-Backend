import express from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes.js";
import applicationRoutes from "./modules/application/application.routes.js";
// import userRoutes from "./modules/user/user.routes.js";
import documentRoutes from "./modules/document/document.routes.js";
import reminderRoutes from "./modules/reminder/reminder.routes.js";
// import analyticsRoutes from "./modules/analytics/analytics.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
// app.use("/api/users", userRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/reminders", reminderRoutes);
// app.use("/api/analytics", analyticsRoutes);

export default app;
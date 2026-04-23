import express from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes.js";
import applicationRoutes from "./modules/application/application.routes.js";
// import userRoutes from "./modules/user/user.routes.js";
import documentRoutes from "./modules/document/document.routes.js";
import reminderRoutes from "./modules/reminder/reminder.routes.js";
// import analyticsRoutes from "./modules/analytics/analytics.routes.js";

const app = express();

// Configure CORS properly
app.use(cors({
  origin: ['http://localhost:8080', 'https://job-tracker-mu-ten.vercel.app'],/ Your frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Routes
app.use("/api/auth", authRoutes);
// app.use("/api/users", userRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/reminders", reminderRoutes);
// app.use("/api/analytics", analyticsRoutes);

export default app;

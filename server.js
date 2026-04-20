import app from "./app.js";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import dns from "dns";
import { startReminderScheduler } from "./modules/reminder/reminder.controller.js";

dns.setServers(["1.1.1.1","8.8.8.8"]);

dotenv.config();
startReminderScheduler();

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
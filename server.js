import app from "./app.js";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import dns from "dns";

dns.setServers(["1.1.1.1","8.8.8.8"]);

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
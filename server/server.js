require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db"); // Import the DB connection function

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to the Database
connectDB();

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON bodies (highly recommended for APIs)
app.use(express.json());

// The requested health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Attempt to connect using the URI from your .env file
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`🍃 MongoDB Connected Successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);
    // Exit the node process with a failure code (1) if it can't connect
    process.exit(1);
  }
};

module.exports = connectDB;

// authController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in the environment");
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const formatUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

// @desc    Register a new user
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    // Body is already validated + sanitized by express-validator middleware
    // by the time we get here, so no need to re-check presence/format.
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, password: hashedPassword });

    return res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: formatUser(user),
    });
  } catch (error) {
    // Mongoose schema validation still acts as a second line of defense
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({ success: false, message });
    }

    console.error("Register error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Authenticate user and return JWT
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    return res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get logged-in user's profile
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return res.status(200).json({ success: true, user: formatUser(user) });
  } catch (error) {
    console.error("Get current user error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { register, login, getMe };

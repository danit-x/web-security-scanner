const express = require('express');
const { register, login } = require('../controllers/authController');

const router = express.Router();

// Mounted at /api/auth in server.js
router.post('/register', register);
router.post('/login', login);

module.exports = router;

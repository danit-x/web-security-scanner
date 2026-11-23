const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token is required' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authorization token is required' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in the environment');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authorization token has expired' });
    }

    // JsonWebTokenError is the base class of every jsonwebtoken verification
    // error, including NotBeforeError (token not active yet), which used to
    // fall through to the 500 below (DEF-007).
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid authorization token' });
    }

    console.error('Auth middleware error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = authMiddleware;

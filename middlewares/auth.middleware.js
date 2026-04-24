import jwt from 'jsonwebtoken';
import User from '../modules/auth/auth.model.js';

export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and attach full user object
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if account is active
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      ...user.toObject()
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    console.error('Auth error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

// Middleware to check if user is admin
export const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin rights required.' });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Authorization error' });
  }
};

// Middleware to check if user is admin or resource owner
export const isAdminOrOwner = (req, res, next) => {
  try {
    const resourceUserId = req.params.userId || req.body.userId || req.query.userId;
    
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Allow if user is admin or if they own the resource
    if (req.user.role === 'admin' || req.user.userId === resourceUserId) {
      return next();
    }
    
    return res.status(403).json({ message: 'Access denied. You can only access your own resources.' });
  } catch (error) {
    return res.status(500).json({ message: 'Authorization error' });
  }
};

// Optional: Middleware for optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (user && user.isActive !== false) {
        req.user = {
          userId: user._id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          ...user.toObject()
        };
      }
    }
    next();
  } catch (error) {
    // Don't fail on optional auth, just continue without user
    next();
  }
};
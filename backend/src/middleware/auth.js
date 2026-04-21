const { verifyToken } = require('../utils/jwt');
const { query } = require('../utils/db');

/**
 * Middleware: Validate JWT and attach user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired. Please log in again.' });
      }
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // Verify user still exists and is active in the database
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.role, u.organization_id, u.is_active, o.slug as org_slug, o.name as org_name
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1 AND u.organization_id = $2`,
      [decoded.sub, decoded.org]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'User account not found or deactivated.' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

/**
 * Middleware factory: Require specific roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
};

module.exports = { authenticate, requireRole };

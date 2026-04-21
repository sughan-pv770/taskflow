const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start in production without it.');
    process.exit(1);
  } else {
    console.warn('WARNING: JWT_SECRET not set. Using insecure fallback secret for development only.');
  }
}

const EFFECTIVE_SECRET = JWT_SECRET || 'fallback_dev_secret_do_not_use_in_production';

const generateToken = (payload) => {
  return jwt.sign(payload, EFFECTIVE_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const verifyToken = (token) => {
  return jwt.verify(token, EFFECTIVE_SECRET);
};

const buildTokenPayload = (user) => ({
  sub: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  org: user.organization_id,
  orgSlug: user.org_slug || null,
});

module.exports = { generateToken, verifyToken, buildTokenPayload };

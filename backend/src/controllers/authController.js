const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../utils/db');
const { generateToken, buildTokenPayload } = require('../utils/jwt');
const { auditLog } = require('../utils/auditLogger');

/**
 * POST /api/auth/register
 * Register a new organization + admin user
 */
const register = async (req, res) => {
  try {
    const { orgName, name, email, password } = req.body;

    // Check email uniqueness across all orgs (global unique email)
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Generate org slug
    const baseSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const check = await query(`SELECT id FROM organizations WHERE slug = $1`, [slug]);
      if (!check.rows.length) break;
      slug = `${baseSlug}-${suffix++}`;
    }

    const orgId = uuidv4();
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await query(`INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)`, [orgId, orgName, slug]);
    await query(
      `INSERT INTO users (id, organization_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, 'admin')`,
      [userId, orgId, name, email.toLowerCase(), passwordHash]
    );

    const user = { id: userId, name, email: email.toLowerCase(), role: 'admin', organization_id: orgId, org_slug: slug };
    const token = generateToken(buildTokenPayload(user));

    await auditLog({
      organizationId: orgId,
      actorId: userId,
      actorName: name,
      actorEmail: email.toLowerCase(),
      action: 'USER_REGISTERED',
      entityType: 'user',
      newValues: { userId, orgId, role: 'admin' },
    });

    return res.status(201).json({
      token,
      user: { id: userId, name, email: email.toLowerCase(), role: 'admin', organizationId: orgId, orgSlug: slug, orgName },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.organization_id, u.is_active,
              o.slug as org_slug, o.name as org_name
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated.' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses OAuth login. Please sign in with your provider.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(buildTokenPayload(user));

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        orgSlug: user.org_slug,
        orgName: user.org_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  const u = req.user;
  return res.json({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    organizationId: u.organization_id,
    orgSlug: u.org_slug,
    orgName: u.org_name,
  });
};

/**
 * POST /api/auth/accept-invite
 */
const acceptInvite = async (req, res) => {
  try {
    const { token, name, password } = req.body;

    const { rows: invites } = await query(
      `SELECT * FROM invites WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [token]
    );

    if (!invites.length) {
      return res.status(400).json({ error: 'Invite link is invalid or has expired.' });
    }

    const invite = invites[0];

    // Check email not already registered in this org
    const dup = await query(`SELECT id FROM users WHERE email = $1`, [invite.email.toLowerCase()]);
    if (dup.rows.length) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await query(
      `INSERT INTO users (id, organization_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, invite.organization_id, name, invite.email.toLowerCase(), passwordHash, invite.role]
    );
    await query(`UPDATE invites SET used_at = NOW() WHERE id = $1`, [invite.id]);

    const { rows: orgs } = await query(`SELECT slug, name FROM organizations WHERE id = $1`, [invite.organization_id]);
    const org = orgs[0];

    const user = { id: userId, name, email: invite.email, role: invite.role, organization_id: invite.organization_id, org_slug: org.slug };
    const authToken = generateToken(buildTokenPayload(user));

    await auditLog({
      organizationId: invite.organization_id,
      actorId: userId,
      actorName: name,
      actorEmail: invite.email.toLowerCase(),
      action: 'USER_JOINED_VIA_INVITE',
      entityType: 'user',
      newValues: { userId, role: invite.role },
    });

    return res.status(201).json({
      token: authToken,
      user: { id: userId, name, email: invite.email, role: invite.role, organizationId: invite.organization_id, orgSlug: org.slug, orgName: org.name },
    });
  } catch (err) {
    console.error('Accept invite error:', err);
    return res.status(500).json({ error: 'Failed to accept invite.' });
  }
};

module.exports = { register, login, getMe, acceptInvite };

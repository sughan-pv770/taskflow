const { query } = require('../utils/db');
const { auditLog } = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * GET /api/admin/users
 * List all users in the admin's organization
 */
const listUsers = async (req, res) => {
  try {
    const { organization_id: orgId } = req.user;

    const { rows } = await query(
      `SELECT id, name, email, role, is_active, created_at, updated_at
       FROM users
       WHERE organization_id = $1
       ORDER BY created_at ASC`,
      [orgId]
    );

    return res.json(rows);
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ error: 'Failed to retrieve users.' });
  }
};

/**
 * PATCH /api/admin/users/:id/role
 * Change a user's role
 */
const updateUserRole = async (req, res) => {
  try {
    const { organization_id: orgId, id: actorId, name: actorName, email: actorEmail } = req.user;
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or member.' });
    }

    // Cannot change own role
    if (id === actorId) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    const { rows } = await query(
      `UPDATE users SET role = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING id, name, email, role, is_active`,
      [role, id, orgId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found in your organization.' });
    }

    await auditLog({
      organizationId: orgId,
      actorId,
      actorName,
      actorEmail,
      action: 'USER_ROLE_CHANGED',
      entityType: 'user',
      newValues: { userId: id, newRole: role },
    });

    return res.json(rows[0]);
  } catch (err) {
    console.error('Update role error:', err);
    return res.status(500).json({ error: 'Failed to update role.' });
  }
};

/**
 * PATCH /api/admin/users/:id/deactivate
 */
const deactivateUser = async (req, res) => {
  try {
    const { organization_id: orgId, id: actorId, name: actorName, email: actorEmail } = req.user;
    const { id } = req.params;

    if (id === actorId) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    const { rows } = await query(
      `UPDATE users SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, email, role, is_active`,
      [id, orgId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found in your organization.' });
    }

    await auditLog({
      organizationId: orgId,
      actorId,
      actorName,
      actorEmail,
      action: 'USER_DEACTIVATED',
      entityType: 'user',
      newValues: { userId: id },
    });

    return res.json(rows[0]);
  } catch (err) {
    console.error('Deactivate user error:', err);
    return res.status(500).json({ error: 'Failed to deactivate user.' });
  }
};

/**
 * PATCH /api/admin/users/:id/activate
 */
const activateUser = async (req, res) => {
  try {
    const { organization_id: orgId, id: actorId, name: actorName, email: actorEmail } = req.user;
    const { id } = req.params;

    const { rows } = await query(
      `UPDATE users SET is_active = true, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, email, role, is_active`,
      [id, orgId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found in your organization.' });
    }

    await auditLog({
      organizationId: orgId,
      actorId,
      actorName,
      actorEmail,
      action: 'USER_ACTIVATED',
      entityType: 'user',
      newValues: { userId: id },
    });

    return res.json(rows[0]);
  } catch (err) {
    console.error('Activate user error:', err);
    return res.status(500).json({ error: 'Failed to activate user.' });
  }
};

/**
 * POST /api/admin/invites
 * Send an invite to join the organization
 */
const createInvite = async (req, res) => {
  try {
    const { organization_id: orgId, id: actorId, name: actorName, email: actorEmail } = req.user;
    const { email, role = 'member' } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or member.' });
    }

    // Check if email already a member of THIS org
    const existing = await query(
      `SELECT id FROM users WHERE email = $1 AND organization_id = $2`,
      [email.toLowerCase(), orgId]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'A user with this email is already in your organization.' });
    }

    // Also check for a pending (unused, non-expired) invite for this email in this org
    const pendingInvite = await query(
      `SELECT id FROM invites WHERE email = $1 AND organization_id = $2 AND used_at IS NULL AND expires_at > NOW()`,
      [email.toLowerCase(), orgId]
    );
    if (pendingInvite.rows.length) {
      return res.status(409).json({ error: 'An active invite for this email already exists.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { rows } = await query(
      `INSERT INTO invites (id, organization_id, email, role, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, role, token, expires_at`,
      [uuidv4(), orgId, email.toLowerCase(), role, token, actorId, expiresAt]
    );

    await auditLog({
      organizationId: orgId,
      actorId,
      actorName,
      actorEmail,
      action: 'USER_INVITED',
      entityType: 'invite',
      newValues: { invitedEmail: email, role },
    });

    return res.status(201).json({
      ...rows[0],
      inviteUrl: `${process.env.FRONTEND_URL}/accept-invite?token=${token}`,
    });
  } catch (err) {
    console.error('Create invite error:', err);
    return res.status(500).json({ error: 'Failed to create invite.' });
  }
};

/**
 * GET /api/admin/invites
 */
const listInvites = async (req, res) => {
  try {
    const { organization_id: orgId } = req.user;

    const { rows } = await query(
      `SELECT i.id, i.email, i.role, i.expires_at, i.used_at, i.created_at,
              u.name AS invited_by_name
       FROM invites i
       LEFT JOIN users u ON u.id = i.invited_by
       WHERE i.organization_id = $1
       ORDER BY i.created_at DESC`,
      [orgId]
    );

    return res.json(rows);
  } catch (err) {
    console.error('List invites error:', err);
    return res.status(500).json({ error: 'Failed to retrieve invites.' });
  }
};

/**
 * GET /api/admin/audit-logs
 */
const getAuditLogs = async (req, res) => {
  try {
    const { organization_id: orgId } = req.user;
    const { page = 1, limit = 50, action, task_id } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [`organization_id = $1`];
    const params = [orgId];
    let idx = 2;

    if (action) {
      conditions.push(`action = $${idx++}`);
      params.push(action);
    }
    if (task_id) {
      conditions.push(`task_id = $${idx++}`);
      params.push(task_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(`SELECT COUNT(*) FROM audit_logs ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const { rows } = await query(
      `SELECT id, task_id, actor_id, actor_name, actor_email, action, entity_type,
              old_values, new_values, metadata, created_at
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limitNum, offset]
    );

    return res.json({
      logs: rows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    return res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
};

/**
 * GET /api/admin/org
 * Get organization info
 */
const getOrg = async (req, res) => {
  try {
    const { organization_id: orgId } = req.user;
    const { rows } = await query(`SELECT id, name, slug, created_at FROM organizations WHERE id = $1`, [orgId]);
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve organization.' });
  }
};

/**
 * GET /api/users - org-scoped user list for dropdowns (any authenticated user)
 */
const listOrgUsers = async (req, res) => {
  try {
    const { organization_id: orgId } = req.user;
    const { rows } = await query(
      `SELECT id, name, email, role FROM users WHERE organization_id = $1 AND is_active = true ORDER BY name`,
      [orgId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve users.' });
  }
};

module.exports = { listUsers, updateUserRole, deactivateUser, activateUser, createInvite, listInvites, getAuditLogs, getOrg, listOrgUsers };

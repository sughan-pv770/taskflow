const { query } = require('./db');

/**
 * Write an audit log entry (append-only, never updated or deleted).
 */
const auditLog = async ({
  organizationId,
  taskId = null,
  actorId,
  actorName,
  actorEmail,
  action,
  entityType = 'task',
  oldValues = null,
  newValues = null,
  metadata = null,
}) => {
  try {
    await query(
      `INSERT INTO audit_logs
         (organization_id, task_id, actor_id, actor_name, actor_email, action, entity_type, old_values, new_values, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        organizationId,
        taskId,
        actorId,
        actorName,
        actorEmail,
        action,
        entityType,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    // Audit log failures must never crash the main request
    console.error('[AUDIT LOG ERROR]', err.message);
  }
};

module.exports = { auditLog };

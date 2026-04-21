const { query } = require('../utils/db');
const { auditLog } = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/tasks/:id/comments
 */
const listComments = async (req, res) => {
  try {
    const { organization_id: orgId, id: userId, role } = req.user;
    const { id: taskId } = req.params;

    // Verify task belongs to org
    const taskCheck = await query(
      `SELECT id, creator_id, assignee_id FROM tasks WHERE id = $1 AND organization_id = $2`,
      [taskId, orgId]
    );
    if (!taskCheck.rows.length) return res.status(404).json({ error: 'Task not found.' });

    const task = taskCheck.rows[0];
    if (role === 'member' && task.creator_id !== userId && task.assignee_id !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { rows } = await query(
      `SELECT c.id, c.body, c.created_at, c.updated_at,
              c.author_id, u.name AS author_name, u.email AS author_email
       FROM task_comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.task_id = $1 AND c.organization_id = $2
       ORDER BY c.created_at ASC`,
      [taskId, orgId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('List comments error:', err);
    return res.status(500).json({ error: 'Failed to retrieve comments.' });
  }
};

/**
 * POST /api/tasks/:id/comments
 */
const addComment = async (req, res) => {
  try {
    const { organization_id: orgId, id: userId, name: userName, email: userEmail, role } = req.user;
    const { id: taskId } = req.params;
    const { body } = req.body;

    if (!body || !body.trim()) {
      return res.status(422).json({ error: 'Comment cannot be empty.' });
    }

    const taskCheck = await query(
      `SELECT id, creator_id, assignee_id FROM tasks WHERE id = $1 AND organization_id = $2`,
      [taskId, orgId]
    );
    if (!taskCheck.rows.length) return res.status(404).json({ error: 'Task not found.' });

    const task = taskCheck.rows[0];
    if (role === 'member' && task.creator_id !== userId && task.assignee_id !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { rows } = await query(
      `INSERT INTO task_comments (id, task_id, organization_id, author_id, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, body, created_at, author_id`,
      [uuidv4(), taskId, orgId, userId, body.trim()]
    );

    // Touch task updated_at so it surfaces in recent activity
    await query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1`, [taskId]);

    await auditLog({
      organizationId: orgId,
      taskId,
      actorId: userId,
      actorName: userName,
      actorEmail: userEmail,
      action: 'COMMENT_ADDED',
      entityType: 'comment',
      newValues: { body: body.trim().slice(0, 120) },
    });

    return res.status(201).json({
      ...rows[0],
      author_name: userName,
      author_email: userEmail,
    });
  } catch (err) {
    console.error('Add comment error:', err);
    return res.status(500).json({ error: 'Failed to add comment.' });
  }
};

/**
 * DELETE /api/tasks/:id/comments/:commentId
 */
const deleteComment = async (req, res) => {
  try {
    const { organization_id: orgId, id: userId, role } = req.user;
    const { id: taskId, commentId } = req.params;

    const { rows } = await query(
      `SELECT c.id, c.author_id FROM task_comments c
       JOIN tasks t ON t.id = c.task_id
       WHERE c.id = $1 AND c.task_id = $2 AND c.organization_id = $3`,
      [commentId, taskId, orgId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Comment not found.' });

    const comment = rows[0];
    if (role !== 'admin' && comment.author_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own comments.' });
    }

    await query(`DELETE FROM task_comments WHERE id = $1`, [commentId]);
    return res.status(204).send();
  } catch (err) {
    console.error('Delete comment error:', err);
    return res.status(500).json({ error: 'Failed to delete comment.' });
  }
};

module.exports = { listComments, addComment, deleteComment };

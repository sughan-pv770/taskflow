const { query } = require('../utils/db');
const { auditLog } = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');

const VALID_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

/**
 * GET /api/tasks
 * List tasks scoped to the authenticated user's organization.
 * Members only see their assigned or created tasks.
 * Admins see all tasks in the org.
 */
const listTasks = async (req, res) => {
  try {
    const { organization_id: orgId, id: userId, role } = req.user;
    const {
      status, priority, assignee_id, search,
      sort_by = 'created_at', sort_dir = 'desc',
      page = 1, limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [`t.organization_id = $1`];
    const params = [orgId];
    let idx = 2;

    // Members only see tasks they created or are assigned to
    if (role === 'member') {
      conditions.push(`(t.creator_id = $${idx} OR t.assignee_id = $${idx})`);
      params.push(userId);
      idx++;
    }

    if (status && VALID_STATUSES.includes(status)) {
      conditions.push(`t.status = $${idx++}`);
      params.push(status);
    }
    if (priority && VALID_PRIORITIES.includes(priority)) {
      conditions.push(`t.priority = $${idx++}`);
      params.push(priority);
    }
    if (assignee_id) {
      conditions.push(`t.assignee_id = $${idx++}`);
      params.push(assignee_id);
    }
    if (search) {
      conditions.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const allowed_sort = ['created_at', 'updated_at', 'due_date', 'priority', 'status', 'title'];
    const sortCol = allowed_sort.includes(sort_by) ? sort_by : 'created_at';
    const sortDir = sort_dir === 'asc' ? 'ASC' : 'DESC';

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) FROM tasks t ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const { rows: tasks } = await query(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
              t.created_at, t.updated_at,
              t.creator_id,
              creator.name AS creator_name, creator.email AS creator_email,
              t.assignee_id,
              assignee.name AS assignee_name, assignee.email AS assignee_email
       FROM tasks t
       LEFT JOIN users creator ON creator.id = t.creator_id
       LEFT JOIN users assignee ON assignee.id = t.assignee_id
       ${whereClause}
       ORDER BY t.${sortCol} ${sortDir}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limitNum, offset]
    );

    return res.json({
      tasks,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('List tasks error:', err);
    return res.status(500).json({ error: 'Failed to retrieve tasks.' });
  }
};

/**
 * GET /api/tasks/:id
 */
const getTask = async (req, res) => {
  try {
    const { organization_id: orgId, id: userId, role } = req.user;
    const { id } = req.params;

    const { rows } = await query(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
              t.created_at, t.updated_at, t.organization_id,
              t.creator_id, creator.name AS creator_name, creator.email AS creator_email,
              t.assignee_id, assignee.name AS assignee_name, assignee.email AS assignee_email
       FROM tasks t
       LEFT JOIN users creator ON creator.id = t.creator_id
       LEFT JOIN users assignee ON assignee.id = t.assignee_id
       WHERE t.id = $1 AND t.organization_id = $2`,
      [id, orgId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = rows[0];

    // Members can only view tasks they created or are assigned to
    if (role === 'member' && task.creator_id !== userId && task.assignee_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to view this task.' });
    }

    return res.json(task);
  } catch (err) {
    console.error('Get task error:', err);
    return res.status(500).json({ error: 'Failed to retrieve task.' });
  }
};

/**
 * POST /api/tasks
 */
const createTask = async (req, res) => {
  try {
    const { organization_id: orgId, id: userId, name: userName, email: userEmail } = req.user;
    const { title, description, status = 'todo', priority = 'medium', assignee_id, due_date } = req.body;

    // Validate assignee belongs to same org
    if (assignee_id) {
      const check = await query(`SELECT id FROM users WHERE id = $1 AND organization_id = $2`, [assignee_id, orgId]);
      if (!check.rows.length) {
        return res.status(400).json({ error: 'Assignee must belong to your organization.' });
      }
    }

    const taskId = uuidv4();
    const { rows } = await query(
      `INSERT INTO tasks (id, organization_id, title, description, status, priority, creator_id, assignee_id, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [taskId, orgId, title, description || null, status, priority, userId, assignee_id || null, due_date || null]
    );

    const task = rows[0];

    await auditLog({
      organizationId: orgId,
      taskId: task.id,
      actorId: userId,
      actorName: userName,
      actorEmail: userEmail,
      action: 'TASK_CREATED',
      newValues: { title, status, priority, assignee_id: assignee_id || null },
    });

    return res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err);
    return res.status(500).json({ error: 'Failed to create task.' });
  }
};

/**
 * PATCH /api/tasks/:id
 */
const updateTask = async (req, res) => {
  try {
    const { organization_id: orgId, id: userId, name: userName, email: userEmail, role } = req.user;
    const { id } = req.params;

    const { rows: existing } = await query(
      `SELECT * FROM tasks WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );
    if (!existing.length) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = existing[0];

    // Members can only update tasks they created or are assigned to
    if (role === 'member' && task.creator_id !== userId && task.assignee_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to update this task.' });
    }

    const { title, description, status, priority, assignee_id, due_date } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined && VALID_STATUSES.includes(status)) updates.status = status;
    if (priority !== undefined && VALID_PRIORITIES.includes(priority)) updates.priority = priority;
    if (due_date !== undefined) updates.due_date = due_date || null;

    if (assignee_id !== undefined) {
      if (assignee_id === null) {
        updates.assignee_id = null;
      } else {
        const check = await query(`SELECT id FROM users WHERE id = $1 AND organization_id = $2`, [assignee_id, orgId]);
        if (!check.rows.length) {
          return res.status(400).json({ error: 'Assignee must belong to your organization.' });
        }
        updates.assignee_id = assignee_id;
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 3}`);
    const setValues = Object.values(updates);

    const { rows: updated } = await query(
      `UPDATE tasks SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, orgId, ...setValues]
    );

    await auditLog({
      organizationId: orgId,
      taskId: id,
      actorId: userId,
      actorName: userName,
      actorEmail: userEmail,
      action: 'TASK_UPDATED',
      oldValues: { title: task.title, status: task.status, priority: task.priority, assignee_id: task.assignee_id },
      newValues: updates,
    });

    return res.json(updated[0]);
  } catch (err) {
    console.error('Update task error:', err);
    return res.status(500).json({ error: 'Failed to update task.' });
  }
};

/**
 * DELETE /api/tasks/:id
 */
const deleteTask = async (req, res) => {
  try {
    const { organization_id: orgId, id: userId, name: userName, email: userEmail, role } = req.user;
    const { id } = req.params;

    const { rows: existing } = await query(
      `SELECT * FROM tasks WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );
    if (!existing.length) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = existing[0];

    // Members can only delete tasks they created
    if (role === 'member' && task.creator_id !== userId) {
      return res.status(403).json({ error: 'You can only delete tasks you created.' });
    }

    await query(`DELETE FROM tasks WHERE id = $1 AND organization_id = $2`, [id, orgId]);

    await auditLog({
      organizationId: orgId,
      taskId: id,
      actorId: userId,
      actorName: userName,
      actorEmail: userEmail,
      action: 'TASK_DELETED',
      oldValues: { title: task.title, status: task.status, priority: task.priority },
    });

    return res.status(204).send();
  } catch (err) {
    console.error('Delete task error:', err);
    return res.status(500).json({ error: 'Failed to delete task.' });
  }
};

/**
 * GET /api/tasks/stats
 * Dashboard stats for the org
 */
const getStats = async (req, res) => {
  try {
    const { organization_id: orgId, id: userId, role } = req.user;

    let scopeClause = `organization_id = $1`;
    let aliasedScopeClause = `t.organization_id = $1`;
    const params = [orgId];

    if (role === 'member') {
      scopeClause += ` AND (creator_id = $2 OR assignee_id = $2)`;
      aliasedScopeClause += ` AND (t.creator_id = $2 OR t.assignee_id = $2)`;
      params.push(userId);
    }

    const { rows: statusCounts } = await query(
      `SELECT status, COUNT(*) as count FROM tasks WHERE ${scopeClause} GROUP BY status`,
      params
    );

    const { rows: priorityCounts } = await query(
      `SELECT priority, COUNT(*) as count FROM tasks WHERE ${scopeClause} GROUP BY priority`,
      params
    );

    const { rows: overdue } = await query(
      `SELECT COUNT(*) as count FROM tasks
       WHERE ${scopeClause} AND due_date < NOW() AND status NOT IN ('done', 'cancelled')`,
      params
    );

    const { rows: recent } = await query(
      `SELECT t.id, t.title, t.status, t.priority, t.updated_at,
              assignee.name AS assignee_name
       FROM tasks t
       LEFT JOIN users assignee ON assignee.id = t.assignee_id
       WHERE ${aliasedScopeClause}
       ORDER BY t.updated_at DESC LIMIT 5`,
      params
    );

    return res.json({
      statusCounts: Object.fromEntries(statusCounts.map(r => [r.status, parseInt(r.count)])),
      priorityCounts: Object.fromEntries(priorityCounts.map(r => [r.priority, parseInt(r.count)])),
      overdueCount: parseInt(overdue[0].count),
      recentTasks: recent,
    });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
};

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask, getStats };

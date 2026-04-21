const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  listUsers, updateUserRole, deactivateUser, activateUser,
  createInvite, listInvites, getAuditLogs, getOrg, listOrgUsers
} = require('../controllers/adminController');

// All admin routes require authentication
router.use(authenticate);

// Org-scoped user list (available to all authenticated users for assignee dropdowns)
router.get('/users/org', listOrgUsers);

// Admin-only below
router.use(requireRole('admin'));

router.get('/org', getOrg);

router.get('/users', listUsers);

router.patch('/users/:id/role', [
  body('role').isIn(['admin', 'member']).withMessage('Role must be admin or member.'),
  validate,
], updateUserRole);

router.patch('/users/:id/deactivate', deactivateUser);
router.patch('/users/:id/activate', activateUser);

router.get('/invites', listInvites);

router.post('/invites', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('role').optional().isIn(['admin', 'member']).withMessage('Role must be admin or member.'),
  validate,
], createInvite);

router.get('/audit-logs', getAuditLogs);

module.exports = router;

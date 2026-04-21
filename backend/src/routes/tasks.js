const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { listTasks, getTask, createTask, updateTask, deleteTask, getStats } = require('../controllers/taskController');

router.use(authenticate);

router.get('/stats', getStats);

router.get('/', listTasks);

router.get('/:id', getTask);

router.post('/', [
  body('title').trim().isLength({ min: 1, max: 500 }).withMessage('Title is required (max 500 chars).'),
  body('description').optional().isLength({ max: 5000 }).withMessage('Description too long.'),
  body('status').optional().isIn(['todo', 'in_progress', 'in_review', 'done', 'cancelled']).withMessage('Invalid status.'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority.'),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage('Due date must be a valid date.'),
  validate,
], createTask);

router.patch('/:id', [
  body('title').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Title must be 1-500 chars.'),
  body('description').optional().isLength({ max: 5000 }).withMessage('Description too long.'),
  body('status').optional().isIn(['todo', 'in_progress', 'in_review', 'done', 'cancelled']).withMessage('Invalid status.'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority.'),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage('Due date must be a valid date.'),
  validate,
], updateTask);

router.delete('/:id', deleteTask);

module.exports = router;

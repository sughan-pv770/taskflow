const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { register, login, getMe, acceptInvite } = require('../controllers/authController');

router.post('/register', [
  body('orgName').trim().isLength({ min: 2, max: 100 }).withMessage('Organization name must be 2-100 characters.'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
  validate,
], register);

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
  validate,
], login);

router.get('/me', authenticate, getMe);

router.post('/accept-invite', [
  body('token').notEmpty().withMessage('Invite token is required.'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
  validate,
], acceptInvite);

module.exports = router;

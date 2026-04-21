const express = require('express');
const router = express.Router({ mergeParams: true }); // inherit :id from parent
const { authenticate } = require('../middleware/auth');
const { listComments, addComment, deleteComment } = require('../controllers/commentController');

router.use(authenticate);

router.get('/', listComments);
router.post('/', addComment);
router.delete('/:commentId', deleteComment);

module.exports = router;

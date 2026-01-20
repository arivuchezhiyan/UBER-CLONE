const express = require('express');
const { addRating, getUserRating } = require('../controllers/ratingController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, addRating);
router.get('/:userId', getUserRating);

module.exports = router;

const Rating = require('../models/Rating');
const User = require('../models/User');

// Add rating
const addRating = async (req, res) => {
  try {
    const { bookingId, ratedUserId, rating, review } = req.body;

    const ratingRecord = new Rating({
      bookingId,
      ratedBy: req.userId,
      ratedUser: ratedUserId,
      rating,
      review,
    });

    await ratingRecord.save();

    // Update user rating average
    const ratings = await Rating.find({ ratedUser: ratedUserId });
    const avgRating = ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length;

    await User.findByIdAndUpdate(ratedUserId, {
      rating: avgRating,
      numberOfRatings: ratings.length,
    });

    res.status(201).json(ratingRecord);
  } catch (error) {
    res.status(500).json({ message: 'Error adding rating', error: error.message });
  }
};

// Get user rating
const getUserRating = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    res.json({ rating: user.rating, numberOfRatings: user.numberOfRatings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching rating', error: error.message });
  }
};

module.exports = { addRating, getUserRating };

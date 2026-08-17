const mongoose = require('mongoose');

// ============================================================
// FARE MODIFIER — Surge, Night, Holiday, Rain pricing modifiers
// Mirrors PICKME schema: table 23 (fare_modifier)
// ============================================================
const fareModifierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  modifierType: { 
    type: String, 
    enum: ['SURGE', 'NIGHT', 'HOLIDAY', 'RAIN', 'CUSTOM'], 
    required: true 
  },
  
  multiplier: { type: Number, default: 1.0, min: 1.0 },      // e.g. 1.5x surge
  flatAddition: { type: Number, default: 0 },                  // Flat amount to add

  appliesToCategory: String,                                    // null = all categories
  
  // Time-based applicability (e.g. night charges 11PM-6AM)
  startTime: String,    // "23:00"
  endTime: String,      // "06:00"

  validFrom: Date,
  validUntil: Date,

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

fareModifierSchema.index({ modifierType: 1, isActive: 1 });

module.exports = mongoose.model('FareModifier', fareModifierSchema);

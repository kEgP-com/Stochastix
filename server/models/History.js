const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  timestamp: {
    type: Number,
    required: true
  },
  settings: {
    type: Object,
    required: true
  },
  players: [{
    name: String,
    isAI: Boolean,
    pointChange: Number
  }],
  winner: {
    type: String,
    required: true
  },
  totalRolls: {
    type: Number,
    required: true
  },
  rolls: {
    type: [Number],
    required: true
  },
  tiebreaker: {
    type: Object,
    default: null
  }
});

module.exports = mongoose.model('History', historySchema);

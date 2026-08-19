const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  points: {
    type: Number,
    default: 1000
  },
  email: {
    type: String,
    default: null
  },
  password: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model('User', userSchema);

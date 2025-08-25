const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,      // نص الخبر
    default: ""
  },
  imageUrl: {
    type: String,      // رابط الصورة
    default: ""
  },
  buttonText: {
    type: String,      // نص الزر
    default: ""
  },
  buttonLinkUrl: {
    type: String,      // رابط الزر
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('News', newsSchema);

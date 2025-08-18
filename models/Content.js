const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
  data: { type: Object, default: {} },
  updatedAt: { type: Date, default: Date.now }
});
ContentSchema.pre('save', function(next){ this.updatedAt = new Date(); next(); });

module.exports = mongoose.model('Content', ContentSchema);
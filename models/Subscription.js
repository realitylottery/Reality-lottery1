const mongoose = require('mongoose');
const { Schema } = mongoose;

const SubscriptionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, required: true },
  status: { type: String, enum: ['pending','active','rejected','canceled'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', SubscriptionSchema);
const mongoose = require('mongoose');
const { Schema } = mongoose;

const PaymentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  method: { type: String, default: 'Demo' },
  type: { type: String, default: 'Subscription' },
  reference: { type: String },
  status: { type: String, enum: ['pending','completed','rejected'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
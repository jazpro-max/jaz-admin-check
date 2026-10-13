const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema(
  {
    admin: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    target_phone: {
      type: String,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ip: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AdminLog', adminLogSchema);

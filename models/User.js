const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // never return password by default
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    commission: {
      type: Number,
      default: 0,
      min: 0,
    },
    referrals_count: {
      type: Number,
      default: 0,
    },
    invitation_code: {
      type: String,
      unique: true,
      sparse: true,
    },
    referred_by: {
      type: String, // invitation_code of the referrer
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate unique invitation code
userSchema.statics.generateInviteCode = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

module.exports = mongoose.model('User', userSchema);

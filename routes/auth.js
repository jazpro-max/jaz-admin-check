const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// =====================================================
// POST /api/auth/login
// Body: { phone, password }
// Works for both regular users and admin
// =====================================================
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone and password are required',
      });
    }

    const user = await User.findOne({ phone }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password',
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Contact support.',
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        balance: user.balance,
        commission: user.commission,
        role: user.role,
        invitation_code: user.invitation_code,
        status: user.status,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =====================================================
// POST /api/auth/register  (regular user registration)
// =====================================================
router.post('/register', async (req, res) => {
  try {
    const { phone, password, inviteCode } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const exists = await User.findOne({ phone });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered',
      });
    }

    // Optional: handle referral
    let referredBy = null;
    if (inviteCode) {
      const referrer = await User.findOne({ invitation_code: inviteCode });
      if (referrer) {
        referredBy = inviteCode;
        referrer.referrals_count += 1;
        // Optional: give commission here
        await referrer.save();
      }
    }

    const invitation_code = User.generateInviteCode();

    const user = await User.create({
      phone,
      password,
      invitation_code,
      referred_by: referredBy,
    });

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        balance: user.balance,
        commission: user.commission,
        role: user.role,
        invitation_code: user.invitation_code,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

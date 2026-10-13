const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const AdminLog = require('../models/AdminLog');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(protect, adminOnly);

// Helper: write admin audit log
const logAction = async (adminPhone, action, targetPhone, details, ip) => {
  try {
    await AdminLog.create({
      admin: adminPhone,
      action,
      target_phone: targetPhone,
      details,
      ip,
    });
  } catch (err) {
    console.error('Failed to write admin log:', err.message);
  }
};

// =====================================================
// GET /api/admin/users
// Returns all users + all orders (matches frontend)
// =====================================================
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .lean();

    // Normalize id for frontend
    const formattedUsers = users.map((u) => ({
      ...u,
      id: u._id,
    }));

    const formattedOrders = orders.map((o) => ({
      ...o,
      id: o._id,
    }));

    res.json({
      success: true,
      users: formattedUsers,
      orders: formattedOrders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =====================================================
// POST /api/admin/update-balance
// Body: { phone, type: 'balance'|'commission', action: 'set'|'add'|'subtract', amount, note }
// =====================================================
router.post('/update-balance', async (req, res) => {
  try {
    const { phone, type, action, amount, note } = req.body;

    if (!phone || !type || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'phone, type and amount are required',
      });
    }

    if (!['balance', 'commission'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be balance or commission',
      });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'amount must be a non-negative number',
      });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const oldValue = user[type];
    let newValue;

    switch (action) {
      case 'add':
        newValue = oldValue + numAmount;
        break;
      case 'subtract':
        newValue = Math.max(0, oldValue - numAmount);
        break;
      case 'set':
      default:
        newValue = numAmount;
        break;
    }

    user[type] = newValue;
    await user.save();

    await logAction(
      req.user.phone,
      `update_${type}`,
      phone,
      { action: action || 'set', oldValue, newValue, note },
      req.ip
    );

    res.json({
      success: true,
      message: `${type} updated successfully`,
      data: {
        phone,
        type,
        oldValue,
        newValue,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =====================================================
// POST /api/admin/update-status
// Body: { phone, status: 'active'|'suspended' }
// =====================================================
router.post('/update-status', async (req, res) => {
  try {
    const { phone, status } = req.body;

    if (!phone || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'phone and valid status (active|suspended) required',
      });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot change status of admin accounts',
      });
    }

    const oldStatus = user.status;
    user.status = status;
    await user.save();

    await logAction(
      req.user.phone,
      'update_status',
      phone,
      { oldStatus, newStatus: status },
      req.ip
    );

    res.json({
      success: true,
      message: `Account ${status === 'suspended' ? 'suspended' : 'activated'}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =====================================================
// POST /api/admin/reset-referrals
// Body: { phone }
// =====================================================
router.post('/reset-referrals', async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.referrals_count = 0;
    await user.save();

    await logAction(req.user.phone, 'reset_referrals', phone, {}, req.ip);

    res.json({ success: true, message: 'Referrals count reset to 0' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =====================================================
// GET /api/admin/transactions
// =====================================================
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const formatted = transactions.map((t) => ({
      ...t,
      id: t._id,
    }));

    res.json({
      success: true,
      transactions: formatted,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =====================================================
// POST /api/admin/transaction/approve
// Body: { id }
// =====================================================
router.post('/transaction/approve', async (req, res) => {
  try {
    const { id } = req.body;
    const tx = await Transaction.findById(id);

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (tx.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is already processed',
      });
    }

    const user = await User.findOne({ phone: tx.phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Apply the transaction
    if (tx.type === 'deposit') {
      user.balance += tx.amount;
    } else if (tx.type === 'withdrawal') {
      if (user.balance < tx.amount) {
        return res.status(400).json({
          success: false,
          message: 'User has insufficient balance',
        });
      }
      user.balance -= tx.amount;
    }

    await user.save();

    tx.status = 'approved';
    tx.processed_by = req.user.phone;
    tx.processed_at = new Date();
    await tx.save();

    await logAction(
      req.user.phone,
      'approve_transaction',
      tx.phone,
      { txId: id, type: tx.type, amount: tx.amount },
      req.ip
    );

    res.json({
      success: true,
      message: 'Transaction approved and balance updated',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =====================================================
// POST /api/admin/transaction/reject
// Body: { id, note? }
// =====================================================
router.post('/transaction/reject', async (req, res) => {
  try {
    const { id, note } = req.body;
    const tx = await Transaction.findById(id);

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (tx.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is already processed',
      });
    }

    tx.status = 'rejected';
    tx.admin_note = note || '';
    tx.processed_by = req.user.phone;
    tx.processed_at = new Date();
    await tx.save();

    await logAction(
      req.user.phone,
      'reject_transaction',
      tx.phone,
      { txId: id, type: tx.type, amount: tx.amount, note },
      req.ip
    );

    res.json({
      success: true,
      message: 'Transaction rejected',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =====================================================
// GET /api/admin/logs  (optional audit trail)
// =====================================================
router.get('/logs', async (req, res) => {
  try {
    const logs = await AdminLog.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

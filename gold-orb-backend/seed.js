/**
 * Seed script – creates the first admin account and some sample data.
 * Run: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Order = require('./models/Order');
const Transaction = require('./models/Transaction');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/goldorb';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data (optional – comment out in production)
    // await User.deleteMany({});
    // await Order.deleteMany({});
    // await Transaction.deleteMany({});

    // Create admin if not exists
    const adminPhone = process.env.ADMIN_PHONE || '0700000000';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@GoldOrb2026';

    let admin = await User.findOne({ phone: adminPhone });
    if (!admin) {
      admin = await User.create({
        phone: adminPhone,
        password: adminPassword,
        role: 'admin',
        invitation_code: 'ADMIN001',
        balance: 0,
        commission: 0,
      });
      console.log(`✅ Admin created → phone: ${adminPhone}  password: ${adminPassword}`);
    } else {
      console.log(`ℹ️  Admin already exists → ${adminPhone}`);
    }

    // Create a few sample users
    const sampleUsers = [
      { phone: '0701111111', password: 'user123', balance: 25000, commission: 3500, referrals_count: 3 },
      { phone: '0702222222', password: 'user123', balance: 10000, commission: 1200, referrals_count: 1 },
      { phone: '0703333333', password: 'user123', balance: 5000,  commission: 0,    referrals_count: 0 },
    ];

    for (const u of sampleUsers) {
      const exists = await User.findOne({ phone: u.phone });
      if (!exists) {
        const code = User.generateInviteCode();
        await User.create({
          ...u,
          invitation_code: code,
          role: 'user',
        });
        console.log(`✅ Sample user created → ${u.phone}`);
      }
    }

    // Sample investment orders
    const users = await User.find({ role: 'user' });
    if (users.length && (await Order.countDocuments()) === 0) {
      await Order.create([
        {
          user: users[0]._id,
          phone: users[0].phone,
          product_name: 'Gold Starter Pack',
          price: 15000,
          daily_income: 500,
          status: 'active',
        },
        {
          user: users[1]._id,
          phone: users[1].phone,
          product_name: 'Gold Premium',
          price: 50000,
          daily_income: 1800,
          status: 'active',
        },
      ]);
      console.log('✅ Sample investment orders created');
    }

    // Sample pending transactions
    if (users.length && (await Transaction.countDocuments()) === 0) {
      await Transaction.create([
        {
          user: users[0]._id,
          phone: users[0].phone,
          type: 'deposit',
          amount: 20000,
          method: 'MTN MoMo',
          status: 'pending',
        },
        {
          user: users[1]._id,
          phone: users[1].phone,
          type: 'withdrawal',
          amount: 5000,
          method: 'Airtel Money',
          status: 'pending',
        },
      ]);
      console.log('✅ Sample transactions created');
    }

    console.log('\n🎉 Seed completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();

# Gold Orb Backend

Complete Node.js + Express + MongoDB backend for the Gold Orb investment platform, including a full Admin API.

## Features

- User registration & login (JWT)
- Password hashing with bcrypt
- Admin-only protected routes
- User management (balance, commission, suspend/activate, reset)
- Deposit & Withdrawal approval workflow
- Investment lease tracking
- Admin audit logs
- Ready-to-use seed script

---

## Quick Start

### 1. Install dependencies

```bash
cd gold-orb-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/goldorb
JWT_SECRET=your_super_long_random_secret_here_min_32_chars
JWT_EXPIRES_IN=7d
ADMIN_PHONE=0700000000
ADMIN_PASSWORD=Admin@GoldOrb2026
```

### 3. Start MongoDB

Make sure MongoDB is running locally (or use MongoDB Atlas and put the connection string in `.env`).

### 4. Seed the database (creates admin + sample data)

```bash
npm run seed
```

### 5. Run the server

```bash
npm run dev          # with nodemon
# or
npm start
```

Server will start at: **http://localhost:5000**

Admin panel: **http://localhost:5000/admin.html**

---

## Admin Login

After seeding:

| Field    | Value               |
|----------|---------------------|
| Phone    | `0700000000`        |
| Password | `Admin@GoldOrb2026` |

Use these credentials on the login page of your frontend (or any tool that calls `POST /api/auth/login`).

The returned JWT must be sent as:

```
Authorization: Bearer <token>
```

on every `/api/admin/*` request.

---

## API Reference

### Auth

| Method | Endpoint              | Body                          | Description          |
|--------|-----------------------|-------------------------------|----------------------|
| POST   | `/api/auth/register`  | `{ phone, password, inviteCode? }` | Register new user |
| POST   | `/api/auth/login`     | `{ phone, password }`         | Login (user or admin)|

### Admin (requires `Authorization: Bearer <admin-jwt>`)

| Method | Endpoint                          | Body / Query                          | Description                    |
|--------|-----------------------------------|---------------------------------------|--------------------------------|
| GET    | `/api/admin/users`                | —                                     | All users + all orders         |
| POST   | `/api/admin/update-balance`       | `{ phone, type, action, amount, note? }` | Adjust balance / commission |
| POST   | `/api/admin/update-status`        | `{ phone, status }`                   | Suspend / Activate account     |
| POST   | `/api/admin/reset-referrals`      | `{ phone }`                           | Reset referral count           |
| GET    | `/api/admin/transactions`         | —                                     | List deposits & withdrawals    |
| POST   | `/api/admin/transaction/approve`  | `{ id }`                              | Approve pending transaction    |
| POST   | `/api/admin/transaction/reject`   | `{ id, note? }`                       | Reject pending transaction     |
| GET    | `/api/admin/logs`                 | —                                     | Admin audit trail              |

**`type`**: `"balance"` | `"commission"`  
**`action`**: `"set"` | `"add"` | `"subtract"`  
**`status`**: `"active"` | `"suspended"`

---

## Folder Structure

```
gold-orb-backend/
├── config/
│   └── db.js
├── middleware/
│   └── auth.js
├── models/
│   ├── User.js
│   ├── Order.js
│   ├── Transaction.js
│   └── AdminLog.js
├── routes/
│   ├── auth.js
│   └── admin.js
├── public/                 ← put admin.html here
├── .env.example
├── package.json
├── seed.js
├── server.js
└── README.md
```

---

## Placing the Admin Panel

Copy the professional `admin.html` into the `public` folder:

```bash
mkdir -p public
cp ../admin.html public/admin.html
```

Then open: **http://localhost:5000/admin.html**

---

## Security Checklist

- [x] Passwords hashed with bcrypt (cost 12)
- [x] Passwords never returned in API responses
- [x] Admin routes protected by JWT + role check
- [x] Suspended users cannot login
- [x] Admin actions are logged
- [ ] Change the default `JWT_SECRET` and admin password before production
- [ ] Use HTTPS in production
- [ ] Add rate limiting (e.g. `express-rate-limit`) on login and balance endpoints
- [ ] Consider IP whitelist for admin routes

---

## Next Steps You May Want

1. Add daily income cron job for active investments
2. Mobile Money payment gateway integration
3. SMS notifications (Africa's Talking / Twilio)
4. Referral commission payout rules
5. Frontend user dashboard

Feel free to request any of the above.

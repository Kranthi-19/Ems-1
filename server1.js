const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Use environment variable for DB (IMPORTANT)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ✅ Create table (runs once)
const createTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        event_type TEXT,
        event_date TEXT,
        guest_count TEXT,
        city TEXT,
        budget TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err.message);
  }
};

createTable();

// ✅ Test route
app.get('/', (req, res) => {
  res.send('🚀 Backend is running successfully!');
});

// ✅ Save booking API
app.post('/api/booking', async (req, res) => {
  const { name, phone, email, eventType, eventDate, guestCount, city, budget } = req.body;

  try {
    await pool.query(
      `INSERT INTO bookings (name, phone, email, event_type, event_date, guest_count, city, budget)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [name, phone, email, eventType, eventDate, guestCount, city, budget]
    );

    res.json({
      success: true,
      message: "✅ Booking saved successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ✅ Get all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bookings ORDER BY created_at DESC'
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});

// ✅ Use dynamic port (IMPORTANT for deployment)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
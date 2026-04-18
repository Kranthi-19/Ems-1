const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

console.log("📦 DATABASE_URL:", process.env.DATABASE_URL ? "SET ✅" : "NOT SET ❌");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ DB CONNECTION FAILED:", err.message);
  } else {
    console.log("✅ DB CONNECTED SUCCESSFULLY");
    release();
    client && release();
  }
});

app.get('/', (req, res) => res.send('🚀 Running!'));

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ connected: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

app.post('/api/booking', async (req, res) => {
  console.log("📩 Body received:", req.body);
  const { name, phone, email, eventType, eventDate, guestCount, city, budget } = req.body;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        name TEXT, phone TEXT, email TEXT,
        event_type TEXT, event_date TEXT,
        guest_count TEXT, city TEXT, budget TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(
      `INSERT INTO bookings (name, phone, email, event_type, event_date, guest_count, city, budget)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [name, phone, email, eventType, eventDate, guestCount, city, budget]
    );
    console.log("✅ Booking inserted!");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Booking error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

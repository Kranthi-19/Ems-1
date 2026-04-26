const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // use service key here (not anon)
);

// ── EMAIL SETUP ──
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ── REGISTER ──
router.post('/register', async (req, res) => {
  try {
    const {
      name, email, phone, password,
      business_name, years_in_business, team_size,
      description, gst_number, website_url, instagram, facebook,
      primary_category, event_types,
      primary_city, locality, travel_coverage, other_cities,
      available_days, available_from, available_until,
      plan, services, heard_from
    } = req.body;

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert vendor
    const { data: vendor, error } = await supabase
      .from('vendors')
      .insert([{
        name, email, phone, password_hash,
        business_name, years_in_business, team_size,
        description, gst_number, website_url, instagram, facebook,
        primary_category, event_types,
        primary_city, locality, travel_coverage, other_cities,
        available_days, available_from, available_until,
        plan, heard_from,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) return res.json({ success: false, error: error.message });

    // Insert services
    if (services && services.length > 0) {
      const svcRows = services.map(s => ({
        vendor_id: vendor.id,
        service_name: s.name,
        price: s.price,
        price_unit: s.unit
      }));
      await supabase.from('vendor_services').insert(svcRows);
    }

    // Email to vendor — registration received
    await mailer.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: '🎊 Welcome to Utsav — Registration Received!',
      html: `
        <h2>Hi ${name}!</h2>
        <p>Thank you for registering as a vendor on <strong>Utsav.in</strong>.</p>
        <p>Your application is under review. Our admin team will verify your documents within <strong>24–48 hours</strong>.</p>
        <p>You will receive another email once your account is approved.</p>
        <br/>
        <p>— Team Utsav</p>
      `
    });

    // Email to admin — new vendor waiting
    await mailer.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `🔔 New Vendor Registration — ${business_name}`,
      html: `
        <h3>New vendor registration received</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Business:</strong> ${business_name}</p>
        <p><strong>Category:</strong> ${primary_category}</p>
        <p><strong>City:</strong> ${primary_city}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Plan:</strong> ${plan}</p>
        <br/>
        <a href="${process.env.ADMIN_PANEL_URL}">Open Admin Panel →</a>
      `
    });

    res.json({ success: true, vendor_id: vendor.id });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── LOGIN ──
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: vendor, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !vendor) {
      return res.json({ success: false, error: 'Invalid email or password' });
    }

    if (vendor.status !== 'approved') {
      return res.json({ 
        success: false, 
        error: vendor.status === 'pending' 
          ? 'Your account is pending admin approval.' 
          : 'Your account has been rejected or suspended.'
      });
    }

    const valid = await bcrypt.compare(password, vendor.password_hash);
    if (!valid) return res.json({ success: false, error: 'Invalid email or password' });

    const token = jwt.sign(
      { vendor_id: vendor.id, email: vendor.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        business_name: vendor.business_name,
        primary_category: vendor.primary_category,
        primary_city: vendor.primary_city,
        plan: vendor.plan,
        status: vendor.status
      }
    });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── DASHBOARD DATA ──
router.get('/dashboard/:vendor_id', async (req, res) => {
  try {
    const { vendor_id } = req.params;

    const [vendor, bookings, reviews, services, payouts, notifications] = await Promise.all([
      supabase.from('vendors').select('*').eq('id', vendor_id).single(),
      supabase.from('bookings').select('*').eq('vendor_id', vendor_id).order('created_at', { ascending: false }),
      supabase.from('reviews').select('*').eq('vendor_id', vendor_id).order('created_at', { ascending: false }),
      supabase.from('vendor_services').select('*').eq('vendor_id', vendor_id),
      supabase.from('payouts').select('*').eq('vendor_id', vendor_id).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('vendor_id', vendor_id).order('created_at', { ascending: false })
    ]);

    res.json({
      success: true,
      vendor: vendor.data,
      bookings: bookings.data,
      reviews: reviews.data,
      services: services.data,
      payouts: payouts.data,
      notifications: notifications.data
    });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
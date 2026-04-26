const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const {
      name, email, phone, password,
      business_name, years_in_business, team_size,
      description, gst_number, website_url,
      instagram, facebook, heard_from,
      primary_category, event_types,
      primary_city, locality, full_address,
      travel_coverage, other_cities,
      available_days, available_from, available_until,
      max_bookings_per_month, advance_booking,
      services, aadhaar_url, pan_url,
      bank_details, portfolio_url, plan
    } = req.body;

    const password_hash = await bcrypt.hash(password, 10);

    const { data: vendor, error } = await supabase
      .from('vendors')
      .insert([{
        name, email, phone, password_hash,
        business_name, years_in_business, team_size,
        description, gst_number, website_url,
        instagram, facebook, heard_from,
        primary_category, event_types,
        primary_city, locality, full_address,
        travel_coverage, other_cities,
        available_days, available_from, available_until,
        max_bookings_per_month, advance_booking,
        services, aadhaar_url, pan_url,
        bank_details, portfolio_url, plan,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) return res.json({ success: false, error: error.message });

    await mailer.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to Utsav — Registration Received!',
      html: `
        <h2>Hi ${name}!</h2>
        <p>Thank you for registering as a vendor on <strong>Utsav</strong>.</p>
        <p>Your application is under review. Our admin will verify your details within 24–48 hours.</p>
        <p>You will receive another email once your account is approved with your login link.</p>
        <p>— Team Utsav</p>
      `
    });

    await mailer.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `New Vendor Registration — ${business_name}`,
      html: `
        <h3>New vendor registration received</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Business:</strong> ${business_name}</p>
        <p><strong>Category:</strong> ${primary_category}</p>
        <p><strong>City:</strong> ${primary_city}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Plan:</strong> ${plan}</p>
        <a href="${process.env.ADMIN_PANEL_URL}">Open Admin Panel</a>
      `
    });

    res.json({ success: true, vendor_id: vendor.id });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// LOGIN
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

    if (vendor.status === 'pending') {
      return res.json({ success: false, error: 'Your account is under review. Please wait for admin approval.' });
    }

    if (vendor.status === 'rejected') {
      return res.json({ success: false, error: 'Your application was not approved. Contact support.' });
    }

    if (vendor.status === 'suspended') {
      return res.json({ success: false, error: 'Your account has been suspended. Contact support.' });
    }

    const valid = await bcrypt.compare(password, vendor.password_hash);
    if (!valid) {
      return res.json({ success: false, error: 'Invalid email or password' });
    }

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

// DASHBOARD
router.get('/dashboard/:vendor_id', async (req, res) => {
  try {
    const { vendor_id } = req.params;

    const [vendor, bookings, reviews, notifications, payouts, messages] = await Promise.all([
      supabase.from('vendors').select('*').eq('id', vendor_id).single(),
      supabase.from('bookings').select('*').eq('vendor_id', vendor_id).order('created_at', { ascending: false }),
      supabase.from('reviews').select('*').eq('vendor_id', vendor_id).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('vendor_id', vendor_id).order('created_at', { ascending: false }),
      supabase.from('payouts').select('*').eq('vendor_id', vendor_id).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').eq('vendor_id', vendor_id).order('created_at', { ascending: false })
    ]);

    res.json({
      success: true,
      vendor: vendor.data,
      bookings: bookings.data || [],
      reviews: reviews.data || [],
      notifications: notifications.data || [],
      payouts: payouts.data || [],
      messages: messages.data || []
    });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;

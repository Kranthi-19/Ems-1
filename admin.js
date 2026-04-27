const express = require('express');
const router = express.Router();
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

// ── GET ALL VENDORS ──
router.get('/vendors', async (req, res) => {
  const { status } = req.query;
  let query = supabase.from('vendors').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  res.json({ success: !error, vendors: data || [], error });
});

// ── APPROVE VENDOR ──
router.post('/approve/:vendor_id', async (req, res) => {
  try {
    const { vendor_id } = req.params;

    const { data: vendor, error } = await supabase
      .from('vendors')
      .update({ status: 'approved', approved_at: new Date() })
      .eq('id', vendor_id)
      .select()
      .single();

    if (error) return res.json({ success: false, error: error.message });

    // Email vendor with login link
    await mailer.sendMail({
      from: process.env.EMAIL_USER,
      to: vendor.email,
      subject: 'Your Utsav Vendor Account is Approved!',
      html: `
        <h2>Congratulations ${vendor.name}!</h2>
        <p>Your vendor account on <strong>Utsav</strong> has been <strong>approved</strong>!</p>
        <p>Login using the credentials you provided during registration:</p>
        <ul>
          <li><strong>Email:</strong> ${vendor.email}</li>
          <li><strong>Password:</strong> the password you set during registration</li>
        </ul>
        <a href="${process.env.VENDOR_DASHBOARD_URL}"
           style="background:#E8560A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px;">
          Login to Dashboard
        </a>
        <p>— Team Utsav</p>
      `
    });

    // Notification in DB
    await supabase.from('notifications').insert([{
      vendor_id: vendor_id,
      title: 'Account Approved!',
      message: 'Your Utsav vendor profile is now live. Start receiving bookings!'
    }]);

    res.json({ success: true });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── REJECT VENDOR ──
router.post('/reject/:vendor_id', async (req, res) => {
  try {
    const { vendor_id } = req.params;
    const { reason } = req.body;

    const { data: vendor, error } = await supabase
      .from('vendors')
      .update({ status: 'rejected', admin_note: reason })
      .eq('id', vendor_id)
      .select()
      .single();

    if (error) return res.json({ success: false, error: error.message });

    await mailer.sendMail({
      from: process.env.EMAIL_USER,
      to: vendor.email,
      subject: 'Utsav Vendor Application Update',
      html: `
        <h2>Hi ${vendor.name},</h2>
        <p>Unfortunately your vendor application was not approved at this time.</p>
        <p><strong>Reason:</strong> ${reason || 'Documents incomplete or not meeting our standards.'}</p>
        <p>You can re-apply after addressing the above. Contact us at support@utsav.in</p>
        <p>— Team Utsav</p>
      `
    });

    res.json({ success: true });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── SUSPEND VENDOR ──
router.post('/suspend/:vendor_id', async (req, res) => {
  try {
    const { vendor_id } = req.params;
    await supabase.from('vendors').update({ status: 'suspended' }).eq('id', vendor_id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;

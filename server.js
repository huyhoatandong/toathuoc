require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'toa-thuoc-tu-tuc-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 }
}));

function requireLogin(req, res, next) {
  if (req.session && req.session.doctor) return next();
  if (req.path.startsWith('/api')) return res.status(401).json({ ok: false, error: 'Chưa đăng nhập' });
  return res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.doctor && req.session.doctor.is_admin) return next();
  if (req.path.startsWith('/api')) return res.status(403).json({ ok: false, error: 'Chỉ admin mới được dùng chức năng này' });
  return res.status(403).send('Chỉ admin mới được dùng chức năng này');
}

function normalizeMedicine(row) {
  return {
    id: row.id,
    name: row.name || '',
    default_quantity: row.default_quantity || '',
    default_days: row.default_days || '',
    default_dose: row.default_dose || '',
    default_route: row.default_route || '',
    default_instruction: row.default_instruction || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function ensureSampleMedicines() {
  const { count, error } = await supabase.from('medicines').select('*', { count: 'exact', head: true });
  if (error || (count && count > 0)) return;

  await supabase.from('medicines').insert([
    { name: 'Paracetamol 500mg', default_quantity: '10 viên', default_days: '3', default_dose: '1 viên', default_route: 'Uống sau ăn', default_instruction: 'Khi đau/sốt' },
    { name: 'Omeprazol 20mg', default_quantity: '14 viên', default_days: '1', default_dose: '1 viên', default_route: 'Uống trước ăn 30 phút', default_instruction: '' }
  ]);
}


app.get('/login', (req, res) => {
  res.render('login', { error: '' });
});

app.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    const { data: doctor, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('username', username)
      .limit(1)
      .single();

    if (error || !doctor) {
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu' });
    }

    const ok = await bcrypt.compare(password, doctor.password_hash || '');
    if (!ok) {
      return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu' });
    }

    req.session.doctor = {
      id: doctor.id,
      username: doctor.username,
      full_name: doctor.full_name,
      title: doctor.title || '',
      is_admin: !!doctor.is_admin
    };

    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});


app.get('/users', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const { data: doctors, error } = await supabase
      .from('doctors')
      .select('id, username, full_name, title, is_admin, created_at, updated_at')
      .order('id', { ascending: true });

    if (error) throw error;

    res.render('users', {
      doctor: req.session.doctor,
      doctors: doctors || [],
      error: '',
      success: ''
    });
  } catch (err) {
    next(err);
  }
});

app.post('/users/create', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const full_name = String(req.body.full_name || '').trim();
    const title = String(req.body.title || '').trim();
    const is_admin = req.body.is_admin === 'on';

    if (!username || !password || !full_name) {
      throw new Error('Cần nhập tài khoản, mật khẩu và tên bác sĩ');
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { error } = await supabase.from('doctors').insert({
      username,
      password_hash,
      full_name,
      title,
      is_admin,
      updated_at: new Date().toISOString()
    });

    if (error) throw error;
    res.redirect('/users');
  } catch (err) {
    next(err);
  }
});

app.post('/users/:id/password', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const password = String(req.body.password || '');
    if (!password) throw new Error('Cần nhập mật khẩu mới');

    const password_hash = await bcrypt.hash(password, 10);

    const { error } = await supabase
      .from('doctors')
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;
    res.redirect('/users');
  } catch (err) {
    next(err);
  }
});

app.post('/users/:id/delete', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.session.doctor.id)) {
      throw new Error('Không thể xóa chính tài khoản đang đăng nhập');
    }

    const { error } = await supabase
      .from('doctors')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.redirect('/users');
  } catch (err) {
    next(err);
  }
});


app.get('/api/me', requireLogin, (req, res) => {
  res.json({ ok: true, doctor: req.session.doctor });
});


app.get('/', requireLogin, async (req, res, next) => {
  try {
    await ensureSampleMedicines();
    const { data: patients, error: pErr } = await supabase.from('patients').select('*').order('updated_at', { ascending: false }).limit(300);
    if (pErr) throw pErr;
    const { data: medicines, error: mErr } = await supabase.from('medicines').select('*').order('name', { ascending: true });
    if (mErr) throw mErr;
    res.render('index', { patients: patients || [], medicines: (medicines || []).map(normalizeMedicine), doctor: req.session.doctor });
  } catch (err) { next(err); }
});

app.get('/api/patients', requireLogin, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('patients').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

app.get('/api/medicines', requireLogin, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('medicines').select('*').order('name', { ascending: true });
    if (error) throw error;
    res.json((data || []).map(normalizeMedicine));
  } catch (err) { next(err); }
});

app.post('/api/medicine', requireLogin, async (req, res, next) => {
  try {
    const m = req.body || {};
    const name = String(m.name || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'Thiếu tên thuốc' });

    const { error } = await supabase.from('medicines').upsert({
      name,
      default_quantity: m.default_quantity || '',
      default_days: m.default_days || '',
      default_dose: m.default_dose || '',
      default_route: m.default_route || '',
      default_instruction: m.default_instruction || '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'name' });

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.delete('/api/medicine/:id', requireLogin, async (req, res, next) => {
  try {
    const { error } = await supabase.from('medicines').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get('/api/prescriptions', requireLogin, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('prescriptions').select('*').order('id', { ascending: false }).limit(100);
    if (error) throw error;
    res.json((data || []).map(x => ({ ...x, items_json: JSON.stringify(x.items || []) })));
  } catch (err) { next(err); }
});

app.post('/api/prescription', requireLogin, async (req, res, next) => {
  try {
    const p = req.body || {};
    const patientName = String(p.patient_name || '').trim();
    const items = Array.isArray(p.items) ? p.items.filter(x => x && String(x.name || '').trim()) : [];

    if (!patientName) return res.status(400).json({ ok: false, error: 'Cần nhập họ tên bệnh nhân' });
    if (!items.length) return res.status(400).json({ ok: false, error: 'Cần nhập ít nhất 1 thuốc' });

    let patientId = null;
    const { data: existing, error: findErr } = await supabase.from('patients').select('*').ilike('name', patientName).limit(1);
    if (findErr) throw findErr;

    const patientPayload = {
      name: patientName,
      gender: p.gender || '',
      age: p.age || '',
      diagnosis: p.diagnosis || '',
      note: p.advice || '',
      updated_at: new Date().toISOString()
    };

    if (existing && existing.length) {
      patientId = existing[0].id;
      const { error } = await supabase.from('patients').update(patientPayload).eq('id', patientId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('patients').insert(patientPayload).select().single();
      if (error) throw error;
      patientId = data.id;
    }

        // Không tự cập nhật Danh mục thuốc tham khảo khi sửa thuốc trong phần ghi toa.
    // Danh mục chỉ thay đổi khi bấm nút Lưu thuốc ở khung Danh mục thuốc tham khảo.

    const { data: saved, error: saveErr } = await supabase.from('prescriptions').insert({
      patient_id: patientId,
      patient_name: patientName,
      gender: p.gender || '',
      age: p.age || '',
      diagnosis: p.diagnosis || '',
      advice: p.advice || '',
      prescription_date: p.prescription_date || null,
      doctor_id: req.session.doctor.id,
      doctor_name: req.session.doctor.full_name,
      doctor_title: req.session.doctor.title || '',
      items
    }).select().single();

    if (saveErr) throw saveErr;
    res.json({ ok: true, id: saved.id });
  } catch (err) { next(err); }
});


app.delete('/api/prescription/:id', requireLogin, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('prescriptions')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: err.message || 'Lỗi server' });
});

app.listen(PORT, () => console.log(`Toa thuốc tự túc đang chạy: http://localhost:${PORT}`));

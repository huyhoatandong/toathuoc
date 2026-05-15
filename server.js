require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

app.get('/', async (req, res, next) => {
  try {
    await ensureSampleMedicines();
    const { data: patients, error: pErr } = await supabase.from('patients').select('*').order('updated_at', { ascending: false }).limit(300);
    if (pErr) throw pErr;
    const { data: medicines, error: mErr } = await supabase.from('medicines').select('*').order('name', { ascending: true });
    if (mErr) throw mErr;
    res.render('index', { patients: patients || [], medicines: (medicines || []).map(normalizeMedicine) });
  } catch (err) { next(err); }
});

app.get('/api/patients', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('patients').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

app.get('/api/medicines', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('medicines').select('*').order('name', { ascending: true });
    if (error) throw error;
    res.json((data || []).map(normalizeMedicine));
  } catch (err) { next(err); }
});

app.post('/api/medicine', async (req, res, next) => {
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

app.delete('/api/medicine/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('medicines').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get('/api/prescriptions', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('prescriptions').select('*').order('id', { ascending: false }).limit(100);
    if (error) throw error;
    res.json((data || []).map(x => ({ ...x, items_json: JSON.stringify(x.items || []) })));
  } catch (err) { next(err); }
});

app.post('/api/prescription', async (req, res, next) => {
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
      items
    }).select().single();

    if (saveErr) throw saveErr;
    res.json({ ok: true, id: saved.id });
  } catch (err) { next(err); }
});


app.delete('/api/prescription/:id', async (req, res, next) => {
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

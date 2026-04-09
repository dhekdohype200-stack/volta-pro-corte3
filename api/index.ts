import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── SERVICES ────────────────────────────────────────────────────────────────

app.get('/api/services', async (_req, res) => {
  const { data, error } = await supabase.from('services').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/services', async (req, res) => {
  const { name, price, duration } = req.body;
  const { data, error } = await supabase
    .from('services')
    .insert({ name, price, duration })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.id });
});

app.delete('/api/services/:id', async (req, res) => {
  const { error } = await supabase.from('services').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── CLIENTS ─────────────────────────────────────────────────────────────────

app.get('/api/clients', async (_req, res) => {
  const { data, error } = await supabase.from('clients').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/clients', async (req, res) => {
  const { name, phone } = req.body;
  const { data, error } = await supabase
    .from('clients')
    .insert({ name, phone })
    .select()
    .single();
  if (error) return res.status(400).json({ error: 'Cliente já existe ou erro no cadastro' });
  res.json({ id: data.id });
});

app.delete('/api/clients/:id', async (req, res) => {
  const { error } = await supabase.from('clients').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

app.get('/api/appointments', async (_req, res) => {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      services (
        name,
        price
      )
    `)
    .order('date')
    .order('time');
  if (error) return res.status(500).json({ error: error.message });

  // Flatten to match original shape
  const result = (data ?? []).map((a: any) => ({
    ...a,
    service_name: a.services?.name ?? '',
    service_price: a.services?.price ?? 0,
    services: undefined,
  }));
  res.json(result);
});

app.post('/api/appointments', async (req, res) => {
  const { client_name, client_phone, service_id, date, time } = req.body;

  const { data, error } = await supabase
    .from('appointments')
    .insert({ client_name, client_phone, service_id, date, time })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Upsert client
  await supabase
    .from('clients')
    .upsert({ name: client_name, phone: client_phone }, { onConflict: 'phone', ignoreDuplicates: true });

  res.json({ id: data.id });
});

app.delete('/api/appointments/:id', async (req, res) => {
  const { error } = await supabase.from('appointments').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.patch('/api/appointments/:id/status', async (req, res) => {
  const { status } = req.body;
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

app.get('/api/settings', async (_req, res) => {
  const { data, error } = await supabase.from('settings').select('*');
  if (error) return res.status(500).json({ error: error.message });
  const obj = (data ?? []).reduce((acc: any, row: any) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  res.json(obj);
});

app.post('/api/settings', async (req, res) => {
  const settings = req.body;
  const rows = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }));
  const { error } = await supabase
    .from('settings')
    .upsert(rows, { onConflict: 'key' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── INACTIVE CLIENTS ─────────────────────────────────────────────────────────

app.get('/api/inactive-clients', async (_req, res) => {
  // Get all appointments with services
  const { data, error } = await supabase
    .from('appointments')
    .select('client_name, client_phone, date, services(price)');

  if (error) return res.status(500).json({ error: error.message });

  // Group by phone, find last visit, compute avg price
  const map: Record<string, { client_name: string; client_phone: string; dates: string[]; prices: number[] }> = {};
  for (const row of data ?? []) {
    const phone = row.client_phone;
    if (!map[phone]) map[phone] = { client_name: row.client_name, client_phone: phone, dates: [], prices: [] };
    map[phone].dates.push(row.date);
    map[phone].prices.push((row as any).services?.price ?? 0);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 15);

  const inactive = Object.values(map)
    .map((c) => {
      const lastVisit = c.dates.sort().at(-1)!;
      const avg_price = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
      return { client_name: c.client_name, client_phone: c.client_phone, last_visit: lastVisit, avg_price };
    })
    .filter((c) => new Date(c.last_visit) < thirtyDaysAgo)
    .sort((a, b) => b.last_visit.localeCompare(a.last_visit));

  res.json(inactive);
});

export default app;

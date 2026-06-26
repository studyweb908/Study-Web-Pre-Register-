import express from 'express';
import path from 'path';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

// Load environment variables.
import 'dotenv/config';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

// Vercel serverless functions might strip the /api prefix, so we add it back
// ONLY if we are running in Vercel and it's missing.
app.use((req, res, next) => {
  if (isVercel && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url === '/' ? '' : req.url);
  }
  console.log(`[DEBUG] Received request: ${req.method} ${req.url}`);
  next();
});

// --------------------------------------------------------
// SUPABASE SETUP
// --------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.warn("WARNING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set. Database operations will fail.");
}

async function readWaitlists(): Promise<any[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('waitlists').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error reading waitlists:', error);
    return [];
  }
  return data || [];
}

async function addWaitlist(user: any) {
  if (!supabase) return;
  const { error } = await supabase.from('waitlists').insert(user);
  if (error) console.error('Error adding to waitlist:', error);
}

async function deleteWaitlist(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from('waitlists').delete().eq('id', id);
  if (error) console.error('Error deleting waitlist:', error);
}

async function readConfig() {
  if (!supabase) return {};
  const { data, error } = await supabase.from('config').select('*').eq('id', 1).maybeSingle();
  if (error) {
    console.error('Error reading config:', error);
    return {};
  }
  return data || {};
}

async function writeConfig(cfg: any) {
  if (!supabase) return;
  const { data } = await supabase.from('config').select('id').eq('id', 1).maybeSingle();
  let error;
  if (data) {
    ({ error } = await supabase.from('config').update(cfg).eq('id', 1));
  } else {
    ({ error } = await supabase.from('config').insert({ id: 1, ...cfg }));
  }
  if (error) console.error('Error writing config:', error);
}

// --------------------------------------------------------
// API ENDPOINTS
// --------------------------------------------------------

// Public: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: supabase ? 'connected' : 'disconnected' });
});

// Admin Authentication Configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'studyweb908@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'studyweb2026admin';

// Admin: Login endpoint
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const checkEmail = email.trim().toLowerCase();
    const checkPassword = password.trim();
    
    if (checkEmail === ADMIN_EMAIL.toLowerCase() && checkPassword === ADMIN_PASSWORD) {
      return res.json({
        success: true,
        token: 'studyweb_admin_session_token_129841029',
        user: { email: ADMIN_EMAIL, role: 'ADMIN' }
      });
    } else {
      return res.status(401).json({ success: false, error: 'Invalid admin email or password' });
    }
  } catch (err) {
    console.error('Unhandled error in /api/admin/login:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// Get configurations
app.get('/api/admin/config', async (req, res) => {
  const cfg = await readConfig();
  res.json({
    spreadsheetId: cfg.spreadsheetId || '',
    googleEmail: cfg.googleEmail || '',
    isConnected: !!cfg.accessToken
  });
});

// Update configurations
app.post('/api/admin/config', async (req, res) => {
  const { spreadsheetId, accessToken, googleEmail } = req.body;
  const cfg = await readConfig();
  
  if (spreadsheetId !== undefined) cfg.spreadsheetId = spreadsheetId;
  if (accessToken !== undefined) cfg.accessToken = accessToken;
  if (googleEmail !== undefined) cfg.googleEmail = googleEmail;
  
  await writeConfig(cfg);
  res.json({ success: true, config: { spreadsheetId: cfg.spreadsheetId, googleEmail: cfg.googleEmail, isConnected: !!cfg.accessToken } });
});

// Create fully provisioned spreadsheet
app.post('/api/admin/create-sheet', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: 'Missing access token' });
  }

  try {
    const sheetResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title: 'StudyWeb Waitlist Tracker' },
        sheets: [{
          properties: {
            title: 'Waitlist',
            gridProperties: { rowCount: 1000, columnCount: 7 }
          }
        }]
      })
    });

    if (!sheetResponse.ok) {
      const errText = await sheetResponse.text();
      return res.status(sheetResponse.status).json({ error: 'Failed to create sheet', details: errText });
    }

    const sheetData = await sheetResponse.json();
    const spreadsheetId = sheetData.spreadsheetId;

    const headerResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Waitlist!A1:G1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [['First Name', 'Last Name', 'Email', 'Grade/Class', 'Country', 'Notify Launch', 'Timestamp']]
      })
    });

    if (!headerResponse.ok) {
      console.error('Failed to add headers to Google sheet', await headerResponse.text());
    }

    const cfg = await readConfig();
    cfg.spreadsheetId = spreadsheetId;
    cfg.accessToken = accessToken;
    delete cfg.formId;
    await writeConfig(cfg);

    res.json({ success: true, spreadsheetId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Internal helper to sync to Google Sheet
async function syncToGoogleSheet() {
  const cfg = await readConfig();
  if (!cfg.spreadsheetId || !cfg.accessToken) {
    return { success: false, error: 'Google Sheet not connected.' };
  }

  const waitlists = await readWaitlists();
  
  try {
    const range = 'Waitlist!A2:G';
    const values = waitlists.length > 0 ? waitlists.map((u: any) => [
      u.first_name, u.last_name, u.email, u.grade, u.country, u.notify_launch ? 'Yes' : 'No', u.created_at
    ]) : [];

    const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}/values/${range}:clear`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.accessToken}` }
    });

    if (!clearResponse.ok) {
      const errText = await clearResponse.text();
      if (clearResponse.status === 401 || errText.includes('authError') || errText.includes('UNAUTHENTICATED')) {
        cfg.accessToken = null;
        await writeConfig(cfg);
        return { success: false, error: 'Google account credentials have expired.' };
      }
      return { success: false, error: 'Failed to clear sheet: ' + errText };
    }

    if (values.length > 0) {
      const appendResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}/values/${range}:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      });

      if (!appendResponse.ok) {
        const errText = await appendResponse.text();
        if (appendResponse.status === 401 || errText.includes('authError') || errText.includes('UNAUTHENTICATED')) {
          cfg.accessToken = null;
          await writeConfig(cfg);
          return { success: false, error: 'Google account credentials have expired.' };
        }
        return { success: false, error: errText };
      }
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Get recent waitlist submissions
app.get('/api/admin/waitlists', async (req, res) => {
  const waitlists = await readWaitlists();
  res.json({ waitlists });
});

// Force sync all data
app.post('/api/admin/sync-sheet', async (req, res) => {
  const result = await syncToGoogleSheet();
  if (result.success) {
    res.json({ success: true, message: 'Synced successfully.' });
  } else {
    res.status(result.error === 'Google Sheet not connected.' ? 400 : 500).json({ error: result.error });
  }
});

// Delete a waitlist record
app.delete('/api/admin/waitlists/:id', async (req, res) => {
  const { id } = req.params;
  
  await deleteWaitlist(id);
  await syncToGoogleSheet();
  
  res.json({ success: true, message: 'Record deleted successfully' });
});

// Public Waitlist Registration Submit
app.post('/api/waitlist', async (req, res) => {
  try {
    const { first_name, last_name, email, grade, country, notify_launch } = req.body;
    
    if (!first_name || !last_name || !email || !grade || !country) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const timestamp = new Date().toISOString();
    const newUser = {
      first_name,
      last_name,
      email,
      grade,
      country,
      notify_launch: !!notify_launch,
      created_at: timestamp
    };

    // 1. Save to Supabase
    await addWaitlist(newUser);

    const cfg = await readConfig();
    let sheetSaved = false;
    let emailSent = false;
    let syncError = '';

    // 2. Synchronize to Google Sheets
    if (cfg.spreadsheetId && cfg.accessToken) {
      try {
        const range = 'Waitlist!A:G';
        const appendResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}/values/${range}:append?valueInputOption=RAW`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfg.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [[first_name, last_name, email, grade, country, notify_launch ? 'Yes' : 'No', timestamp]]
          })
        });

        if (appendResponse.ok) {
          sheetSaved = true;
        } else {
          const errText = await appendResponse.text();
          if (appendResponse.status === 401 || errText.includes('authError') || errText.includes('UNAUTHENTICATED')) {
            syncError = 'Admin Google credentials expired.';
            cfg.accessToken = null;
            await writeConfig(cfg);
          } else {
            syncError = 'Failed to append to Google Sheets: ' + appendResponse.status;
          }
        }
      } catch (sheetErr: any) {
        syncError = sheetErr.message;
      }
    }

    // 3. Send automated Welcome Email
    if (cfg.accessToken) {
      try {
        const subject = 'Welcome to StudyWeb 🚀';
        const bodyText = `Hi ${first_name},<br><br>
You're officially on the StudyWeb waitlist, and you've secured <strong style="color: #4f46e5;">50% off</strong> your first month!<br><br>
We'll notify you as soon as early access becomes available.<br><br>
<b>From Confusion To Clarity.</b><br><br>
— Team StudyWeb`;

        const str = [
          `To: ${email}`,
          `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
          'Content-Type: text/html; charset=utf-8',
          'MIME-Version: 1.0',
          '',
          bodyText
        ].join('\r\n');
        
        const raw = Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const mailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfg.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ raw })
        });

        if (mailResponse.ok) {
          emailSent = true;
        }
      } catch (mailErr) {
        console.error('Gmail API transmission error:', mailErr);
      }
    }

    res.json({
      success: true,
      user: newUser,
      sheetSaved,
      emailSent,
      syncError: syncError || undefined
    });
  } catch (err) {
    console.error('Unhandled error in /api/waitlist:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !isVercel) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!isVercel) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!isVercel) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else {
    app.use((req, res) => {
      res.status(404).json({ error: 'Not Found', url: req.url });
    });
  }
}

startServer();

export default app;

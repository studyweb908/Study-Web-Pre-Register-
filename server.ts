import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';

// Load environment variables.
import 'dotenv/config';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[DEBUG] Received request: ${req.method} ${req.url}`);
  next();
});

// Ensure the local data directory exists.
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const DATA_DIR = isVercel ? '/tmp/data' : path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const WAITLIST_FILE = path.join(DATA_DIR, 'waitlists.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Helper to read waitlists.
function readWaitlists(): any[] {
  if (fs.existsSync(WAITLIST_FILE)) {
    try {
      const data = fs.readFileSync(WAITLIST_FILE, 'utf-8');
      return JSON.parse(data) || [];
    } catch (e) {
      console.error('Error reading waitlists file, resetting', e);
      return [];
    }
  }
  return [];
}

// Helper to write waitlists.
function writeWaitlists(list: any[]) {
  fs.writeFileSync(WAITLIST_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

// Helper to read Google Workspace configuration.
function readConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data) || {};
    } catch (e) {
      return {};
    }
  }
  return {};
}

// Helper to write Google Workspace configuration.
function writeConfig(cfg: any) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

// --------------------------------------------------------
// API ENDPOINTS
// --------------------------------------------------------

// Public: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Admin Authentication Configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'studyweb908@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'studyweb2026admin';

// Admin: Login endpoint (custom simple password check)
app.post('/api/admin/login', async (req, res) => {
  console.log('[DEBUG] Login request body:', req.body);
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const checkEmail = email.trim().toLowerCase();
    const checkPassword = password.trim();
    const expectedEmail = ADMIN_EMAIL.toLowerCase();
    const expectedPassword = ADMIN_PASSWORD.trim();

    if (checkEmail === expectedEmail && checkPassword === expectedPassword) {
      // Return a dummy session token and admin details
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

// Get configurations (Google sheet ID and token info)
app.get('/api/admin/config', (req, res) => {
  const cfg = readConfig();
  // Don't send entire secret token to public if we want to be secure, or send a masked/simplified version
  res.json({
    spreadsheetId: cfg.spreadsheetId || '',
    googleEmail: cfg.googleEmail || '',
    isConnected: !!cfg.accessToken
  });
});

// Update configurations (Save Google spreadsheet and token)
app.post('/api/admin/config', (req, res) => {
  const { spreadsheetId, accessToken, googleEmail } = req.body;
  const cfg = readConfig();
  
  if (spreadsheetId !== undefined) cfg.spreadsheetId = spreadsheetId;
  if (accessToken !== undefined) cfg.accessToken = accessToken;
  if (googleEmail !== undefined) cfg.googleEmail = googleEmail;
  
  writeConfig(cfg);
  res.json({ success: true, config: { spreadsheetId: cfg.spreadsheetId, googleEmail: cfg.googleEmail, isConnected: !!cfg.accessToken } });
});

// Create fully provisioned spreadsheet on behalf of the logged-in Google user.
app.post('/api/admin/create-sheet', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: 'Missing access token' });
  }

  try {
    // 1. Create a spreadsheet via Google Sheets API v4
    const sheetResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: 'StudyWeb Waitlist Tracker'
        },
        sheets: [
          {
            properties: {
              title: 'Waitlist',
              gridProperties: {
                rowCount: 1000,
                columnCount: 7
              }
            }
          }
        ]
      })
    });

    if (!sheetResponse.ok) {
      const errText = await sheetResponse.text();
      return res.status(sheetResponse.status).json({ error: 'Failed to create sheet', details: errText });
    }

    const sheetData = await sheetResponse.json();
    const spreadsheetId = sheetData.spreadsheetId;

    // 2. Add header rows
    const headerResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Waitlist!A1:G1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [
          ['First Name', 'Last Name', 'Email', 'Grade/Class', 'Country', 'Notify Launch', 'Timestamp']
        ]
      })
    });

    if (!headerResponse.ok) {
      console.error('Failed to add headers to Google sheet', await headerResponse.text());
    }

    // Save configuration locally
    const cfg = readConfig();
    cfg.spreadsheetId = spreadsheetId;
    cfg.accessToken = accessToken;
    // Delete any existing formId from config
    delete cfg.formId;
    writeConfig(cfg);

    res.json({ success: true, spreadsheetId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Internal helper to sync to Google Sheet
async function syncToGoogleSheet() {
  const cfg = readConfig();
  if (!cfg.spreadsheetId || !cfg.accessToken) {
    return { success: false, error: 'Google Sheet not connected.' };
  }

  const waitlists = readWaitlists();
  
  try {
    const range = 'Waitlist!A2:G';
    const values = waitlists.length > 0 ? waitlists.map((u: any) => [
      u.first_name, u.last_name, u.email, u.grade, u.country, u.notify_launch ? 'Yes' : 'No', u.timestamp
    ]) : [];

    // First clear existing data from row 2 downwards
    const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}/values/${range}:clear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.accessToken}`,
      }
    });

    if (!clearResponse.ok) {
      const errText = await clearResponse.text();
      if (clearResponse.status === 401 || errText.includes('authError') || errText.includes('UNAUTHENTICATED')) {
        cfg.accessToken = null;
        writeConfig(cfg);
        return { success: false, error: 'Google account credentials have expired. Please disconnect and connect your Google account again.' };
      }
      return { success: false, error: 'Failed to clear sheet: ' + errText };
    }

    if (values.length > 0) {
      // Then append all data
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
          writeConfig(cfg);
          return { success: false, error: 'Google account credentials have expired. Please disconnect and connect your Google account again.' };
        }
        return { success: false, error: errText };
      }
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Get recent waitlist submissions (Admin authenticated)
app.get('/api/admin/waitlists', (req, res) => {
  const waitlists = readWaitlists();
  res.json({ waitlists });
});

// Force sync all data to Google Sheet
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
  const currentList = readWaitlists();
  const newList = currentList.filter((u: any) => u.id !== id);
  
  if (newList.length === currentList.length) {
    return res.status(404).json({ error: 'Record not found' });
  }
  
  writeWaitlists(newList);
  
  // Auto-sync
  await syncToGoogleSheet();
  
  res.json({ success: true, message: 'Record deleted successfully' });
});

// Public Waitlist Registration Submit Post route
app.post('/api/waitlist', async (req, res) => {
  try {
  const { first_name, last_name, email, grade, country, notify_launch } = req.body;
  
  if (!first_name || !last_name || !email || !grade || !country) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const timestamp = new Date().toLocaleString();
  const id = 'wait_' + Math.random().toString(36).substr(2, 9);
  const newUser = {
    id,
    first_name,
    last_name,
    email,
    grade,
    country,
    notify_launch: !!notify_launch,
    created_at: timestamp
  };

  // 1. Save to local data persistence
  const currentList = readWaitlists();
  currentList.unshift(newUser);
  writeWaitlists(currentList);

  const cfg = readConfig();
  let sheetSaved = false;
  let emailSent = false;
  let syncError = '';

  // 2. Synchronize to Google Sheets if spreadsheetId and accessToken exist
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
          values: [
            [first_name, last_name, email, grade, country, notify_launch ? 'Yes' : 'No', timestamp]
          ]
        })
      });

      if (appendResponse.ok) {
        sheetSaved = true;
      } else {
        const errText = await appendResponse.text();
        console.error('Failed to append to Google sheet:', errText);
        // If 401 or authError, token might have expired, but user signup still succeeded locally
        if (appendResponse.status === 401 || errText.includes('authError') || errText.includes('UNAUTHENTICATED')) {
          syncError = 'Admin Google credentials expired. Waitlist saved locally.';
          cfg.accessToken = null;
          writeConfig(cfg);
        } else {
          syncError = 'Failed to append to Google Sheets: ' + appendResponse.status;
        }
      }
    } catch (sheetErr: any) {
      console.error('Google sheet integration error:', sheetErr);
      syncError = sheetErr.message;
    }
  }

  // 3. Send automated Welcome Email via Gmail API send if active credentials exist
  if (cfg.accessToken) {
    try {
      const subject = 'Welcome to StudyWeb 🚀';
      const bodyText = `Hi ${first_name},<br><br>
You're officially on the StudyWeb waitlist, and you've secured <strong style="color: #4f46e5;">50% off</strong> your first month!<br><br>
We'll notify you as soon as early access becomes available.<br><br>
<b>From Confusion To Clarity.</b><br><br>
— Team StudyWeb`;

      // Structure MIME message
      const str = [
        `To: ${email}`,
        `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        bodyText
      ].join('\r\n');
      
      const raw = Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

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
      } else {
        const errTxt = await mailResponse.text();
        console.error('Failed to send mail via Gmail API:', errTxt);
        if (mailResponse.status === 401 || errTxt.includes('authError') || errTxt.includes('UNAUTHENTICATED')) {
          cfg.accessToken = null;
          writeConfig(cfg);
        }
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
    res.status(err instanceof Error ? 500 : 500).json({ error: 'Internal server error.' });
  }
});

// --------------------------------------------------------
// VITE OR STATIC FILE REVERSE PROXY MIDDLEWARE
// --------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
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
  }
}

startServer();

export default app;

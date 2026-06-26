
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'studyweb908@gmail.com').trim();
  const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'studyweb2026admin').trim();

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const checkEmail = email.trim().toLowerCase();
  const checkPassword = password.trim();

  if (checkEmail === ADMIN_EMAIL.toLowerCase() && checkPassword === ADMIN_PASSWORD) {
    return res.status(200).json({
      success: true,
      token: 'studyweb_admin_session_token_129841029',
      user: { email: ADMIN_EMAIL, role: 'ADMIN' }
    });
  } else {
    return res.status(401).json({ success: false, error: 'Incorrect email or password' });
  }
}

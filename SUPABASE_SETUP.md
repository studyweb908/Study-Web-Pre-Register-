# Supabase Setup Guide

This application has been updated to use Supabase for its primary database, resolving the issue with local JSON files disappearing on Vercel deployments.

To complete the setup, please follow these steps:

## 1. Add Environment Variables
Add your Supabase project credentials to the `.env` file (or Vercel Environment Variables):
- `SUPABASE_URL`: Your project URL (e.g., `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (found in Project Settings > API). Using the service role key ensures the server can bypass Row Level Security.

## 2. Create Tables in Supabase
Run the following SQL in your Supabase SQL Editor (found in the "SQL Editor" tab on the left sidebar) to create the required tables:

```sql
-- 1. Create users table for internal registrations
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Create waitlists table
CREATE TABLE IF NOT EXISTS waitlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  grade text NOT NULL,
  country text NOT NULL,
  notify_launch boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Create config table for Google Sheets integration
CREATE TABLE IF NOT EXISTS config (
  id integer PRIMARY KEY DEFAULT 1,
  "spreadsheetId" text,
  "accessToken" text,
  "googleEmail" text
);

-- Initialize the config record if it doesn't exist
INSERT INTO config (id, "spreadsheetId", "accessToken", "googleEmail")
VALUES (1, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
```

After adding the environment variables and running the SQL, your application will fully persist waitlist signups and Google configuration to Supabase!

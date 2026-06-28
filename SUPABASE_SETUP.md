# Supabase Setup Guide

This application has been updated to use Supabase for its primary database, resolving the issue with local JSON files disappearing on Vercel deployments.

To complete the setup, please follow these steps:

## 1. Add Environment Variables
Add your Supabase project credentials to the `.env` file (or Vercel Environment Variables):
- `SUPABASE_URL`: Your project URL (e.g., `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (found in Project Settings > API). Using the service role key ensures the server can bypass Row Level Security.

## 2. Create or Update Tables in Supabase
Run **either** of the following SQL options in your Supabase SQL Editor (found in the "SQL Editor" tab on the left sidebar in your Supabase dashboard).

### OPTION A: Fresh Start (Recommended & Cleanest)
*Use this option if you want to cleanly reset your database tables and ensure all required columns are created.*

```sql
-- 1. Drop existing tables if they exist
DROP TABLE IF EXISTS waitlists CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS config CASCADE;

-- 2. Create users table for internal registrations
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Create waitlists table
CREATE TABLE waitlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  grade text NOT NULL,
  country text NOT NULL,
  notify_launch boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 4. Create config table for Google Sheets integration
CREATE TABLE config (
  id integer PRIMARY KEY DEFAULT 1,
  "spreadsheetId" text,
  "accessToken" text,
  "googleEmail" text
);

-- 5. Initialize the config record if it doesn't exist
INSERT INTO config (id, "spreadsheetId", "accessToken", "googleEmail")
VALUES (1, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
```

---

### OPTION B: Preserve Existing Data
*Use this option if you already have waitlist signups in your database and want to safely add the missing columns (`grade`, `country`, `notify_launch`) without losing data.*

```sql
-- 1. Add missing columns to waitlists table
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS notify_launch boolean DEFAULT false;

-- 2. Populate existing records with default values to avoid NULLs
UPDATE waitlists SET grade = 'Other' WHERE grade IS NULL;
UPDATE waitlists SET country = 'Unknown' WHERE country IS NULL;
UPDATE waitlists SET notify_launch = false WHERE notify_launch IS NULL;

-- 3. Set NOT NULL constraints on the new columns
ALTER TABLE waitlists ALTER COLUMN grade SET NOT NULL;
ALTER TABLE waitlists ALTER COLUMN country SET NOT NULL;

-- 4. Ensure config table exists
CREATE TABLE IF NOT EXISTS config (
  id integer PRIMARY KEY DEFAULT 1,
  "spreadsheetId" text,
  "accessToken" text,
  "googleEmail" text
);

-- 5. Ensure config record is initialized
INSERT INTO config (id, "spreadsheetId", "accessToken", "googleEmail")
VALUES (1, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 6. Ensure users table exists
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
```

After adding the environment variables and running the SQL, your application will fully persist waitlist signups and Google configuration to Supabase!

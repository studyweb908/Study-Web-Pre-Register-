# Supabase Setup Guide

This application has been updated to use Supabase for its primary database, resolving the issue with local JSON files disappearing on Vercel deployments.

To complete the setup, please follow these steps:

## 1. Add Environment Variables
Add your Supabase project credentials to the `.env` file (or Vercel Environment Variables):
- `SUPABASE_URL`: Your project URL (e.g., `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (found in Project Settings > API). Using the service role key ensures the server can bypass Row Level Security.

## 2. Create Tables in Supabase
Run the following SQL in your Supabase SQL Editor to create the required tables:

```sql
-- Create waitlists table
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

-- Create users table for authentication
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  name text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Create config table for Google Sheets integration
CREATE TABLE config (
  id integer PRIMARY KEY DEFAULT 1,
  "spreadsheetId" text,
  "accessToken" text,
  "googleEmail" text
);
```

After adding the environment variables and running the SQL, your application will fully persist waitlist signups and Google configuration to Supabase!

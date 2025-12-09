-- Migration: create news table
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title TEXT,
  link TEXT UNIQUE,
  source TEXT,
  summary TEXT,
  published_at timestamptz,
  raw jsonb,
  inserted_at timestamptz DEFAULT now()
);

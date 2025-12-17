-- Initial migration: core tables for users, subscriptions, payments
-- NOTE: Run with psql or your migration tooling. This file is a starting point.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(32) NOT NULL,
  active BOOLEAN DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  provider VARCHAR(50),
  provider_ref VARCHAR(200),
  amount NUMERIC(10,2),
  currency VARCHAR(8),
  status VARCHAR(32),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- Initial migration: users, subscriptions, payments
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id VARCHAR(64) NOT NULL,
  name VARCHAR(200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(32) NOT NULL,
  active BOOLEAN DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  provider VARCHAR(50),
  provider_ref VARCHAR(200),
  amount NUMERIC(10,2),
  currency VARCHAR(8),
  status VARCHAR(32),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

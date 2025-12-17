// Drizzle ORM schema for Postgres (users, payments, subscriptions)
import { pgTable, serial, text, varchar, timestamp, integer, numeric, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegram_id: varchar('telegram_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 200 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at')
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  tier: varchar('tier', { length: 32 }).notNull(),
  active: boolean('active').default(true),
  started_at: timestamp('started_at').defaultNow(),
  ends_at: timestamp('ends_at')
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id'),
  provider: varchar('provider', { length: 50 }),
  provider_ref: varchar('provider_ref', { length: 200 }),
  amount: numeric('amount', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 8 }),
  status: varchar('status', { length: 32 }),
  created_at: timestamp('created_at').defaultNow()
});

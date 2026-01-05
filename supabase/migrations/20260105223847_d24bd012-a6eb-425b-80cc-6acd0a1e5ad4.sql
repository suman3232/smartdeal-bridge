-- Add platform_fee column to deals table
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0;
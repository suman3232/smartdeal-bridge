-- Add delivery_addresses column to kycs table
ALTER TABLE public.kycs 
ADD COLUMN IF NOT EXISTS delivery_addresses jsonb DEFAULT '[]'::jsonb;
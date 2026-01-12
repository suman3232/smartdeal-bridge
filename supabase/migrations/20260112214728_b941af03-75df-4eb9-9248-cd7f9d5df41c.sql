-- Add new KYC columns for full details
ALTER TABLE public.kycs 
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS account_holder_name text,
  ADD COLUMN IF NOT EXISTS selfie_url text;

-- Add unique constraint on PAN number (one PAN per account)
ALTER TABLE public.kycs 
  ADD CONSTRAINT kycs_pan_number_unique UNIQUE (pan_number);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kycs_user_id ON public.kycs(user_id);
CREATE INDEX IF NOT EXISTS idx_kycs_status ON public.kycs(status);
-- Add phase_passed column to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS phase_passed boolean DEFAULT false;
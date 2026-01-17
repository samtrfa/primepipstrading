-- Add drawdown tracking columns to accounts table
ALTER TABLE public.accounts
ADD COLUMN high_water_mark numeric DEFAULT NULL,
ADD COLUMN daily_start_balance numeric DEFAULT NULL,
ADD COLUMN daily_start_date date DEFAULT NULL,
ADD COLUMN max_drawdown_percent numeric DEFAULT 0,
ADD COLUMN daily_drawdown_percent numeric DEFAULT 0,
ADD COLUMN drawdown_violated boolean DEFAULT false,
ADD COLUMN violation_type text DEFAULT NULL;

-- Create a function to reset daily drawdown at the start of each trading day
CREATE OR REPLACE FUNCTION public.reset_daily_drawdown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if we're on a new trading day
  IF NEW.daily_start_date IS NULL OR NEW.daily_start_date < CURRENT_DATE THEN
    NEW.daily_start_date := CURRENT_DATE;
    NEW.daily_start_balance := COALESCE(NEW.current_balance, NEW.account_size);
    NEW.daily_drawdown_percent := 0;
  END IF;
  
  -- Update high water mark if current balance is higher
  IF NEW.high_water_mark IS NULL OR COALESCE(NEW.current_balance, NEW.account_size) > NEW.high_water_mark THEN
    NEW.high_water_mark := COALESCE(NEW.current_balance, NEW.account_size);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for drawdown tracking
CREATE TRIGGER track_account_drawdown
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_daily_drawdown();

-- Initialize existing accounts with high water mark and daily start balance
UPDATE public.accounts
SET 
  high_water_mark = COALESCE(current_balance, account_size),
  daily_start_balance = COALESCE(current_balance, account_size),
  daily_start_date = CURRENT_DATE
WHERE high_water_mark IS NULL;
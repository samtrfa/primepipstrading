-- Create enum for challenge types
CREATE TYPE public.challenge_type AS ENUM ('three_step', 'two_step', 'one_step', 'instant');

-- Create enum for account status
CREATE TYPE public.account_status AS ENUM ('pending_payment', 'active', 'failed', 'passed', 'funded');

-- Create accounts table
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_type challenge_type NOT NULL,
  account_size INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status account_status NOT NULL DEFAULT 'pending_payment',
  current_balance DECIMAL(12,2),
  profit_loss DECIMAL(12,2) DEFAULT 0,
  current_phase INTEGER DEFAULT 1,
  payment_address TEXT,
  payment_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own accounts" 
ON public.accounts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own accounts" 
ON public.accounts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts" 
ON public.accounts 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
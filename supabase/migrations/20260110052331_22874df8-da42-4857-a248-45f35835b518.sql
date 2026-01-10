-- Create assets table for tradeable instruments
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'forex',
  base_currency TEXT,
  quote_currency TEXT,
  pip_value NUMERIC DEFAULT 0.0001,
  lot_size INTEGER DEFAULT 100000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create positions table for open/closed trades
CREATE TABLE public.positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  position_type TEXT NOT NULL CHECK (position_type IN ('buy', 'sell')),
  lot_size NUMERIC NOT NULL DEFAULT 0.01,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  profit_loss NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trade history for order logs
CREATE TABLE public.trade_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('open', 'close', 'modify', 'sl_hit', 'tp_hit')),
  symbol TEXT NOT NULL,
  lot_size NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  profit_loss NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;

-- Assets are readable by all authenticated users
CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT USING (true);

-- Positions policies - users can only access positions for their own accounts
CREATE POLICY "Users can view their own positions" ON public.positions
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = positions.account_id AND accounts.user_id = auth.uid())
);

CREATE POLICY "Users can create positions for their accounts" ON public.positions
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = positions.account_id AND accounts.user_id = auth.uid())
);

CREATE POLICY "Users can update their own positions" ON public.positions
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = positions.account_id AND accounts.user_id = auth.uid())
);

-- Trade history policies
CREATE POLICY "Users can view their own trade history" ON public.trade_history
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = trade_history.account_id AND accounts.user_id = auth.uid())
);

CREATE POLICY "Users can create trade history for their accounts" ON public.trade_history
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = trade_history.account_id AND accounts.user_id = auth.uid())
);

-- Insert default forex pairs and crypto
INSERT INTO public.assets (symbol, name, asset_type, base_currency, quote_currency, pip_value) VALUES
('EURUSD', 'Euro / US Dollar', 'forex', 'EUR', 'USD', 0.0001),
('GBPUSD', 'British Pound / US Dollar', 'forex', 'GBP', 'USD', 0.0001),
('USDJPY', 'US Dollar / Japanese Yen', 'forex', 'USD', 'JPY', 0.01),
('AUDUSD', 'Australian Dollar / US Dollar', 'forex', 'AUD', 'USD', 0.0001),
('USDCAD', 'US Dollar / Canadian Dollar', 'forex', 'USD', 'CAD', 0.0001),
('USDCHF', 'US Dollar / Swiss Franc', 'forex', 'USD', 'CHF', 0.0001),
('NZDUSD', 'New Zealand Dollar / US Dollar', 'forex', 'NZD', 'USD', 0.0001),
('EURGBP', 'Euro / British Pound', 'forex', 'EUR', 'GBP', 0.0001),
('EURJPY', 'Euro / Japanese Yen', 'forex', 'EUR', 'JPY', 0.01),
('GBPJPY', 'British Pound / Japanese Yen', 'forex', 'GBP', 'JPY', 0.01),
('XAUUSD', 'Gold / US Dollar', 'commodity', 'XAU', 'USD', 0.01),
('XAGUSD', 'Silver / US Dollar', 'commodity', 'XAG', 'USD', 0.001),
('BTCUSD', 'Bitcoin / US Dollar', 'crypto', 'BTC', 'USD', 0.01),
('ETHUSD', 'Ethereum / US Dollar', 'crypto', 'ETH', 'USD', 0.01),
('US30', 'Dow Jones Industrial', 'index', 'US30', 'USD', 1),
('US100', 'NASDAQ 100', 'index', 'US100', 'USD', 1),
('US500', 'S&P 500', 'index', 'US500', 'USD', 0.1);
UPDATE public.assets SET is_active = false WHERE asset_type <> 'crypto';

INSERT INTO public.assets (symbol, name, asset_type, pip_value, quote_currency, lot_size, is_active)
VALUES
  ('BTCUSD','Bitcoin / US Dollar','crypto',0.01,'USD',100000,true),
  ('ETHUSD','Ethereum / US Dollar','crypto',0.01,'USD',100000,true),
  ('XRPUSD','XRP / US Dollar','crypto',0.0001,'USD',100000,true),
  ('SOLUSD','Solana / US Dollar','crypto',0.01,'USD',100000,true),
  ('ADAUSD','Cardano / US Dollar','crypto',0.0001,'USD',100000,true),
  ('DOGEUSD','Dogecoin / US Dollar','crypto',0.00001,'USD',100000,true),
  ('LTCUSD','Litecoin / US Dollar','crypto',0.01,'USD',100000,true),
  ('LINKUSD','Chainlink / US Dollar','crypto',0.001,'USD',100000,true),
  ('AVAXUSD','Avalanche / US Dollar','crypto',0.001,'USD',100000,true),
  ('DOTUSD','Polkadot / US Dollar','crypto',0.001,'USD',100000,true),
  ('BCHUSD','Bitcoin Cash / US Dollar','crypto',0.01,'USD',100000,true),
  ('UNIUSD','Uniswap / US Dollar','crypto',0.001,'USD',100000,true),
  ('AAVEUSD','Aave / US Dollar','crypto',0.01,'USD',100000,true),
  ('XLMUSD','Stellar / US Dollar','crypto',0.00001,'USD',100000,true),
  ('ATOMUSD','Cosmos / US Dollar','crypto',0.001,'USD',100000,true),
  ('NEARUSD','NEAR Protocol / US Dollar','crypto',0.001,'USD',100000,true),
  ('ALGOUSD','Algorand / US Dollar','crypto',0.0001,'USD',100000,true),
  ('ETCUSD','Ethereum Classic / US Dollar','crypto',0.01,'USD',100000,true),
  ('XTZUSD','Tezos / US Dollar','crypto',0.0001,'USD',100000,true),
  ('SANDUSD','The Sandbox / US Dollar','crypto',0.0001,'USD',100000,true)
ON CONFLICT (symbol) DO UPDATE SET name = EXCLUDED.name, asset_type = 'crypto', pip_value = EXCLUDED.pip_value, quote_currency = 'USD', lot_size = EXCLUDED.lot_size, is_active = true;
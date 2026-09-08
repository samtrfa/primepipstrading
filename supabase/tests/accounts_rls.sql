BEGIN;

SELECT plan(8);

CREATE TEMP TABLE account_rls_test_ids (
  owner_id UUID NOT NULL,
  other_user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  archived_account_id UUID NOT NULL
);

INSERT INTO account_rls_test_ids
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004'
);

INSERT INTO public.accounts (
  id, user_id, challenge_type, account_size, price, status, current_balance
)
SELECT account_id, owner_id, 'two_step', 10000, 99.00, 'active', 10000
FROM account_rls_test_ids
UNION ALL
SELECT archived_account_id, owner_id, 'two_step', 10000, 99.00, 'active', 10000
FROM account_rls_test_ids;

UPDATE public.accounts
SET archived_at = now()
WHERE id = (SELECT archived_account_id FROM account_rls_test_ids);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'accounts'
     AND policyname IN (
       'Users can create their own accounts',
       'Users can update their own accounts',
       'Users can update their own active accounts'
     )),
  0,
  'client INSERT and UPDATE policies are removed'
);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'accounts'
     AND policyname = 'Users can view their own active accounts'),
  1,
  'the active-account read policy remains'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.accounts', 'INSERT'),
  'authenticated cannot INSERT accounts'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.accounts', 'UPDATE'),
  'authenticated cannot UPDATE accounts'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT owner_id::text FROM account_rls_test_ids),
  true
);

SELECT is(
  (SELECT count(*)::integer FROM public.accounts),
  1,
  'a user can read their own active account'
);

SELECT is(
  (SELECT count(*)::integer
   FROM public.accounts
   WHERE id = (SELECT archived_account_id FROM account_rls_test_ids)),
  0,
  'archived accounts remain hidden from their owner'
);

SELECT throws_ok(
  $$INSERT INTO public.accounts (user_id, challenge_type, account_size, price)
    VALUES ('00000000-0000-0000-0000-000000000001', 'instant', 10000, 1.00)$$,
  '42501',
  NULL,
  'a client cannot create an account'
);

SELECT throws_ok(
  $$UPDATE public.accounts
    SET user_id = '00000000-0000-0000-0000-000000000002',
        status = 'funded',
        current_balance = 1,
        profit_loss = 999,
        current_phase = 3,
        price = 1,
        challenge_type = 'instant',
        payment_address = 'attacker',
        payment_tx_hash = 'attacker'
    WHERE id = '00000000-0000-0000-0000-000000000003'$$,
  '42501',
  NULL,
  'a client cannot change ownership or account state'
);

SELECT * FROM finish();
ROLLBACK;

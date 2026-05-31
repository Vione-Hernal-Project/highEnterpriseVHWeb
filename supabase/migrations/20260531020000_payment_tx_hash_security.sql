update public.payments
set tx_hash = lower(trim(tx_hash))
where tx_hash is not null
  and tx_hash ~* '^0x[0-9a-f]{64}$'
  and tx_hash <> lower(trim(tx_hash));

create unique index if not exists payments_evm_tx_hash_lower_unique_idx
on public.payments (lower(tx_hash))
where tx_hash is not null
  and tx_hash ~* '^0x[0-9a-f]{64}$';

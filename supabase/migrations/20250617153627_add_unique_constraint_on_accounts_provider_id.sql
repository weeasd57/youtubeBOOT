ALTER TABLE accounts
ADD CONSTRAINT unique_account_provider_pair UNIQUE (account_type, provider_account_id);

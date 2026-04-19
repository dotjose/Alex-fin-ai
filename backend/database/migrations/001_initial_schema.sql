-- Alex.ai core schema + pgvector (idempotent DDL; applied once via schema_migrations)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
    clerk_user_id VARCHAR(255) PRIMARY KEY,
    display_name VARCHAR(255),
    years_until_retirement INTEGER,
    target_retirement_income DECIMAL(12, 2),
    asset_class_targets JSONB,
    region_targets JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS instruments (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    instrument_type VARCHAR(50),
    current_price DECIMAL(12, 4),
    allocation_regions JSONB NOT NULL DEFAULT '{}'::jsonb,
    allocation_sectors JSONB NOT NULL DEFAULT '{}'::jsonb,
    allocation_asset_class JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id VARCHAR(255) NOT NULL REFERENCES users (clerk_user_id) ON DELETE CASCADE,
    account_name VARCHAR(255) NOT NULL,
    account_purpose TEXT,
    cash_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    cash_interest DECIMAL(5, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL REFERENCES instruments (symbol),
    quantity DECIMAL(20, 8) NOT NULL,
    as_of_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (account_id, symbol)
);

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id VARCHAR(255) NOT NULL REFERENCES users (clerk_user_id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    request_payload JSONB,
    report_payload JSONB,
    charts_payload JSONB,
    retirement_payload JSONB,
    summary_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_positions_account ON positions (account_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions (symbol);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS document_embeddings_user_idx ON document_embeddings (clerk_user_id);

CREATE OR REPLACE FUNCTION match_document_embeddings(
    filter_user text,
    query_embedding vector(1536),
    match_count int DEFAULT 5
)
RETURNS TABLE (content text, metadata jsonb, similarity float)
LANGUAGE sql
STABLE
AS $$
    SELECT de.content,
           de.metadata,
           (1 - (de.embedding <=> query_embedding))::float AS similarity
    FROM document_embeddings de
    WHERE de.clerk_user_id = filter_user
    ORDER BY de.embedding <=> query_embedding
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_instruments_updated_at ON instruments;
CREATE TRIGGER update_instruments_updated_at
    BEFORE UPDATE ON instruments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_positions_updated_at ON positions;
CREATE TRIGGER update_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

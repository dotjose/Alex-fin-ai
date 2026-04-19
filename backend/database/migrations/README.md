# SQL migrations

- **Runner:** `alex_database.migrations.run_pending_migrations` (invoked from FastAPI before routes load).
- **Tracking:** `schema_migrations` table records applied migration stems (e.g. `001_initial_schema`).
- **Connection:** `SUPABASE_DATABASE_URL` — Postgres URI from Supabase **Database** settings (not the REST `SUPABASE_URL`).

Files are applied in **lexical order**, each **once**, inside a transaction. Add new migrations as `002_*.sql`, `003_*.sql`, etc.

Do not edit applied migrations in place for production fixes; add a new forward migration.

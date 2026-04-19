# AlexFin.ai

**AlexFin.ai** is an AI financial intelligence platform: **Next.js** frontend (Clerk), **FastAPI** on AWS Lambda (**Mangum**), **Supabase** (Postgres + pgvector), **OpenRouter**, **SQS**, infrastructure in **Terraform**, releases only via **GitHub Actions**.

![Course Image](assets/alex.png)

## Repository layout

| Path | Purpose |
|------|---------|
| **`apps/api/`** | FastAPI app, Mangum handler, routes, strict env (`core/config.py`) |
| **`backend/`** | Agents (`planner`, `tagger`, `reporter`, …), `database`, `alex_llm`, tests |
| **`frontend/`** | Next.js UI (static `output: 'export'` for S3 + CloudFront) |
| **`terraform/`** | All AWS infra: SQS, image-based Lambdas, HTTP API, S3, CloudFront |
| **`.github/workflows/deploy.yml`** | **Only** supported deploy: test → image → Terraform → frontend build → S3 → invalidation |

Supplementary material lives under **`guides/`**; for production behavior, prefer **`terraform/`** and the workflow above.

---

## Run locally (development)

Local runs are for **development and debugging** only. They are **not** a deployment path.

### 1. Environment

Copy **`.env.example`** to **`.env`** at the **repository root**. The API loads this file (see `apps/api/core/config.py`).

Fill at least: **Clerk**, **Supabase**, **OpenRouter**, **Langfuse**, **Polygon**, and core URLs:

- **`NODE_ENV=development`**
- **`API_BASE_URL=http://localhost:8000`**
- **`FRONTEND_URL=http://localhost:3000`**
- **`SUPABASE_URL`** — `https://<project-ref>.supabase.co` (REST only; never `postgres://` here)
- **`SUPABASE_SERVICE_ROLE_KEY`** — server-only; never expose to the browser
- **`SUPABASE_DATABASE_URL`** — Postgres URI from Supabase → Database; used on API boot for **idempotent SQL migrations** (`backend/database/migrations/*.sql`, tracked in `schema_migrations`). A fresh project gets tables automatically—no manual SQL in the dashboard.

**`SQS_QUEUE_URL`** / **`S3_BUCKET_UI`**: leave empty for UI-only work. **`POST /api/analyze`** returns **503** until a queue URL is set (for example from `terraform output -raw sqs_queue_url` after you have a stack, pasted into `.env` for integration testing).

#### AWS credentials (local API + SQS)

If **`SQS_QUEUE_URL`** is non-empty, the API **fails fast at startup** unless boto3 can resolve credentials (same rules as the AWS CLI). You will not get a late **`NoCredentialsError`** on the first `send_message`.

Requirements:

- **`AWS_REGION`** — non-empty (default `us-east-1` in `.env.example` is fine). All SQS clients use this as `region_name`.
- **One of**: shared credentials from **`aws configure`**, or **`AWS_PROFILE`**, or **`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`** (optional **`AWS_SESSION_TOKEN`** for temporary keys).

In **`NODE_ENV=development`**, if only one of **`AWS_ACCESS_KEY_ID`** / **`AWS_SECRET_ACCESS_KEY`** is set, startup fails with a clear message (avoid half-configured env).

**Verify identity:**

```bash
aws sts get-caller-identity
```

On **Lambda**, the execution role supplies credentials; no access keys in environment are required.

### 2. API (FastAPI)

From the repo root, using **`uv`**:

```bash
cd apps/api
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend (Next.js)

Clerk needs the **publishable** key in the **frontend** app (the API validates JWTs with **`CLERK_JWT_ISSUER`** in repo-root **`.env`**). Copy **`frontend/.env.example`** to **`frontend/.env.local`** and set:

- **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** — publishable key (`pk_test_…` / `pk_live_…`) from [Clerk → API Keys](https://dashboard.clerk.com/last-active?path=api-keys).
- **`NEXT_PUBLIC_API_URL`** — e.g. `http://localhost:8000` so the browser calls your local FastAPI (see [Clerk allowed origins](https://dashboard.clerk.com) for `http://localhost:3000` in development).

Do **not** add **`CLERK_SECRET_KEY`** to the static frontend bundle for this repo; production CI only injects publishable keys into the Next build.

```bash
cp frontend/.env.example frontend/.env.local
# edit frontend/.env.local with real keys
```

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:3000**.

### 4. Quick checks

```bash
cd backend && uv sync && uv run pytest tests/ -q
cd frontend && npm run lint && npm run typecheck
```

### 5. HTTP API shape (frontend ↔ FastAPI)

All routes live under **`/api/*`** and expect **`Authorization: Bearer <Clerk session JWT>`** (except health).

| Endpoint | Response shape |
|----------|------------------|
| **`GET /api/user`**, **`PUT /api/user`** | `{ "user": { …db row… }, "created": boolean }` — `created` is only meaningful on first `GET` after signup. |
| **`GET /api/accounts`**, **`POST /api/accounts`**, **`PUT /api/accounts/{id}`** | Account objects: `id`, `clerk_user_id`, `account_name`, `account_purpose`, `cash_balance`, … (snake_case, matches Postgres). |
| **`GET /api/accounts/{id}/positions`** | `{ "positions": [ … ] }` — each position may include nested `instrument`. |
| **`POST /api/analyze`** | `{ "job_id": "<uuid>", "message": "…" }` |
| **`GET /api/jobs`**, **`GET /api/jobs/{id}`** | List: `{ "jobs": [ … ] }` — job rows use snake_case (`report_payload`, `error_message`, …). |
| **`GET /api/capabilities`** | **No auth.** `{ "analyze_enabled", "node_env", "mock_lambdas" }` — `analyze_enabled` is true when **`SQS_QUEUE_URL`** is set, or in development / **`MOCK_LAMBDAS`** / **`LOCAL_DEV`** paths that run the planner without a queue. |

Type hints for the client live in **`frontend/lib/api.ts`**; **`frontend/lib/capabilities.ts`** wraps `/api/capabilities`. Dashboard pages that use raw `fetch` follow the same shapes.

---

## Deploy (production)

**All production releases go through GitHub Actions.** There are no supported zip bundles, ad-hoc shell deploy scripts, or “deploy from laptop” flows in this repo.

1. Configure **repository secrets and variables** per **`.github/workflows/deploy.yml`**: static AWS keys (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`**, **`CLERK_SECRET_KEY`**, Supabase + OpenRouter secrets, and **variables** **`SUPABASE_URL`** and **`CLERK_JWT_ISSUER`**. Terraform creates the remote state bucket and ECR repo (no `TF_STATE_*` or `ECR_REPOSITORY`).
2. **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** is the only Clerk key used in the Next.js build; **`CLERK_SECRET_KEY`** is passed to Lambda via Terraform for Clerk server APIs when needed.
3. In the **Clerk dashboard**, allow your **CloudFront** URL (and `http://localhost:3000` for local dev) under authorized origins / redirect URLs so sign-in works after deploy.
4. Push to **`main`** or run **Actions → Deploy → Run workflow**.

The workflow installs dependencies, runs backend tests and frontend lint/typecheck, builds and pushes the **`apps/api/Dockerfile`** image to ECR, runs **Terraform** (two applies so Lambda CORS URLs match CloudFront), builds the static frontend with **`NEXT_PUBLIC_API_URL`** / **`NEXT_PUBLIC_APP_URL`** from Terraform output and the publishable Clerk key, syncs **`frontend/out/`** to S3, and invalidates CloudFront.

Infra details and outputs: **`terraform/README.md`**.

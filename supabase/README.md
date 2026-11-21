# Supabase schema setup

This directory contains the reproducible database setup for the Shukatsu OS MVP.

## Files

- `migrations/202606270001_mvp_schema_and_rls.sql`
  - Creates the MVP tables from the DB design document and Issue #19.
  - Enables row-level security for every user-owned table.
  - Adds policies so each authenticated user can only read and write their own data.
  - Keeps the current app compatible with `companies.user_id` while also adding `workspaces` and `companies.workspace_id`.
- `migrations/202610170001_es_document_versioning.sql`
  - Increments `es_documents.version` for every update.
  - Uses the existing `touch_es_documents_updated_at` trigger to keep the displayed final-update time current.
  - Keeps historical content snapshots out of the MVP; Issue #61 tracks submission-version history.
- `migrations/20261114000000_interview_log_access.sql`
  - Reuses the existing interview log schema, ownership policies, and update timestamp trigger.
  - Adds an index for company-specific interview history and limits writes to input columns.
  - Preserves existing JSON arrays, timestamps, nullable fields, and stored records.
  - Apply after the MVP migration, before using the interview log screens.
- `migrations/202611140001_es_document_authenticated_access.sql`
  - Repairs `42501 / permission denied for table es_documents` for authenticated users in projects without default table grants.
  - Grants SELECT/INSERT/UPDATE/DELETE on `es_documents` to `authenticated` and requires the existing ownership policy and RLS.
- `migrations/202611210001_company_deadline_atomic_rpc.sql`
  - Saves a company and its deadline task in one transaction. The functions use the signed-in user's permissions and the existing company, workspace, and task RLS policies.
  - Apply before enabling deadline saves in the company forms.

## MVP tables

The migration creates these tables:

- `users`
- `workspaces`
- `companies`
- `applications`
- `es_documents`
- `interview_logs`
- `tasks`
- `events`
- `pages`
- `page_blocks`
- `templates`

`users` is a public profile table keyed by `auth.users.id`. A trigger on `auth.users` creates the public profile and a default workspace when a new user signs up.

## Current app compatibility

The existing Next.js screens already read and write `companies.user_id`.

The schema keeps `companies.user_id` as a required column and adds `companies.workspace_id`. A database trigger fills `workspace_id` with the user's default workspace when existing app code inserts a company without a workspace value.

This means the current companies list, detail, edit, delete, and dashboard queries remain consistent with the new workspace-based schema.

## Local setup

1. Create `app/.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Apply the migrations.

   Option A: Supabase SQL editor

   - Open the Supabase project.
   - Go to SQL Editor.
   - Apply all files in `supabase/migrations/` in ascending filename order, including `20261114000000_interview_log_access.sql` for interview logs.
   - In particular, ES update status needs `202606270001_mvp_schema_and_rls.sql` (tables / `updated_at` / RLS), `202610170001_es_document_versioning.sql` (version increment), and `202611140001_es_document_authenticated_access.sql` (authenticated table privileges).
   - Run `supabase/checks/es_update_status.sql` in the target SQL Editor. All eight rows must be `true`. This read-only check does not create/update/delete application data or change privileges/RLS.
   - Then use a test account to create an ES and save it twice; confirm v1 → v2 → v3 and the persisted timestamps in the list/detail. Passing the catalog check alone is not an end-to-end acceptance check.

   Option B: Supabase CLI

   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```

3. Run the app:

   ```bash
   cd app
   npm install
   npm run dev
   ```

## Production setup

1. Apply the same ordered migrations to the production Supabase project using the team's normal deployment procedure. Run the read-only ES check there too. Do not weaken RLS or grant anonymous write access to make a test pass.
2. Set these Vercel environment variables for the production deployment:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-production-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
   ```

3. Confirm that Supabase Auth email settings and redirect URLs match the deployed app URL.

## RLS model

- `users`: access is limited to `auth.uid() = users.id`.
- `workspaces`: access is limited to the owning `user_id`.
- `companies`: access is limited to `companies.user_id = auth.uid()`.
- `applications`, `es_documents`, and `interview_logs`: access is inherited through the related company.
- `tasks`, `events`, `pages`, and `templates`: access is inherited through the related workspace.
- `page_blocks`: access is inherited through the parent page and workspace.

Use the authenticated Supabase client from the app. Do not use the service role key in browser or client-side code.

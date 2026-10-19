# Supabase setup — do this in order

## 1. Create the project
Go to supabase.com → New project. Free tier is fine to start. Note your
database password somewhere safe (you won't need it day-to-day, but you'll
want it if you ever connect a SQL client directly).

## 2. Run the schema
Dashboard → SQL Editor → paste the full contents of `0001_init_schema.sql` →
Run. Then do the same for `0002_auth_profile_trigger.sql`,
`0003_real_workflows.sql`, `0004_production_controls.sql`, and
`0005_branch_isolation.sql`, and `0006_test_master_controls.sql`.
Then run `0007_server_formula_results.sql` to enable authoritative formula
recalculation when laboratory results are saved.
Run `0008_report_template_reference.sql` to persist the uploaded report-format
reference used by Report Designer.

If either fails partway through, drop into SQL Editor and check which
statement errored — don't re-run the whole file blindly, since `create
table` on a table that already exists will error out.

## 3. Create Storage buckets for uploads and reports
Dashboard → Storage → New bucket → name it `uploads` → toggle **Public**
(logo/QR/footer images need to be viewable in report previews without an
auth token). All report assets are stored in Supabase Storage and served by
their public URLs.

The `0004_production_controls.sql` migration creates a separate private
`reports` bucket. Generated patient PDFs are stored there and shared through
seven-day signed URLs; do not make this bucket public.

## 4. Get your API keys
Dashboard → Settings → API. Copy:
- **Project URL**
- **anon public** key

Put both into `apps/desktop/.env` (copy `.env.example` first). Do **not**
use the `service_role` key anywhere in the frontend — that key bypasses
every RLS policy you just created.

## 5. Create your first admin account
Dashboard → Authentication → Users → Add user → enter an email + password
for yourself, and check "Auto Confirm User" so you don't need email
verification to test.

This creates the login, and the trigger from `0002` auto-creates a matching
`profiles` row — but it defaults to the lowest-privilege role
(`front_desk`). Promote yourself to admin by running this in SQL Editor:

```sql
update profiles set role = 'admin' where id =
  (select id from auth.users where email = 'you@yourlab.com');
```

From then on, create the rest of your staff logins the same way (Dashboard
→ Authentication → Users), and set each person's role/branch using SQL or
the administrative staff workflow when enabled.

## 6. Run the app
```
cd apps/desktop
bun install
bun dev
```
Sign in with the admin account from step 5.

## 7. Enable report sharing (WhatsApp + Email)
**WhatsApp** — works with zero extra setup. Clicking "Share via WhatsApp" on
a report opens WhatsApp with the report link pre-filled; the staff member
taps Send once. This requires the patient to have a phone number on file —
if they don't, the button is disabled with an explanation. True one-tap
*auto-send* (no manual tap at all) requires registering the lab's own phone
number with Meta's WhatsApp Business Cloud API — a real business
verification process with Meta, not something achievable purely through
code. Ask if you want that built once you've registered.

**Email** — fully automatic once set up (no manual step), but needs one more
account:
1. Create a free account at resend.com.
2. Verify a sending domain (Resend walks you through adding a couple of DNS
   records) — without this, email may land in spam or be rejected.
3. Get your Resend API key.
4. Deploy the Edge Function:
   ```
   supabase functions deploy send-report-email
   supabase secrets set RESEND_API_KEY=re_your_key_here
   supabase secrets set REPORT_EMAIL_FROM=reports@yourlab.com
   ```
The Email button only appears on a report when the patient has an email on
file — if they don't, it's hidden entirely rather than shown disabled.

## Production architecture
Authentication, masters, billing, results, phlebotomy, reports, report settings,
quality control, microbiology, finance, inventory, analyzer configuration, and
report assets use Supabase Auth, Postgres, Storage, and Edge Functions. The
frontend contains no local data store and no alternate data source.

`0003_real_workflows.sql` adds inventory movements, microbiology fields,
phlebotomy rejection history, tool settings, and the RLS policies required by
the production data-access layer. `0004_production_controls.sql` adds the
immutable audit and payment ledgers, atomic payment collection, QC targets,
and organism lookup. `0005_branch_isolation.sql` restricts operational orders,
results, and their child records to the signed-in user's branch unless they
are an administrator. `0006_test_master_controls.sql` adds specimen,
container, analyzer, critical-value, required-result, report-order, and tube
requirements to the Test Master and carries tube requirements into orders.

Analyzer serial/TCP ingestion requires a deployed device connector with access
to the laboratory instrument network. The browser does not generate synthetic
analyzer readings or claim that a hardware port is connected.

The barcode label still needs a real Code128/Code39 renderer before it should
be used with scanner hardware.


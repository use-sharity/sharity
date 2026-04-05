# Convex Daily Backup

Workflow file: [`convex-backup.yml`](./convex-backup.yml)

Runs `npx convex export` against the production Convex deployment every day at midnight Da Lat time (17:00 UTC) and uploads the result to Cloudflare R2 object storage.

---

## What it backs up

**Included:**
- All Convex table documents (`items`, `claims`, `lease_activity`, etc.)
- File storage (`imageStorageIds` from the `items` table) — via `--include-file-storage`

**Not included:**
- Convex functions and schema (those live in source code under `convex/`)
- Environment variables (copy from Convex dashboard → Settings → Environment Variables)
- Pending scheduled functions

---

## Prerequisites

### 1. Get an Admin Key from the Convex dashboard

1. Go to [dashboard.convex.dev](https://dashboard.convex.dev)
2. Select the **sharity** project → production deployment
3. Navigate to **Settings → Deploy Keys**
4. Create a new **Admin key** (not a production deploy key — those are for code deploys only)
5. Copy the key value; it looks like `bold-hyena-681|01c2...c09c`

### 2. Enable R2 and create a bucket

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**
2. Add billing info if prompted (R2 free tier: 10 GB storage, 1M Class A writes/month)
3. Click **Create bucket**, name it e.g. `sharity-backups`
   - Bucket names: lowercase letters, numbers, and hyphens only; 3–63 characters
4. Leave all settings at defaults (bucket is private by default)

### 3. Create an R2 API token

1. On the R2 overview page, click **Manage** next to **API Tokens**
2. Click **Create Account API token** (not User API token — Account tokens stay valid if your user is removed)
3. Set **Permission** to **Object Read & Write**, scoped to the `sharity-backups` bucket
4. Click **Create Account API Token**
5. Copy both values immediately — the **Secret Access Key is shown only once**:
   - **Access Key ID** (looks like a short alphanumeric string)
   - **Secret Access Key** (longer, base64-encoded)

### 4. Find your Cloudflare Account ID

Go to any page in the Cloudflare dashboard — the **Account ID** is shown in the right sidebar (or under **Workers & Pages → Overview**). It is a 32-character hex string.

### 5. Add secrets to GitHub

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret** and add all five:

| Secret name | Value |
|---|---|
| `CONVEX_DEPLOY_KEY` | Admin key from Convex dashboard (step 1) |
| `R2_ACCOUNT_ID` | Cloudflare Account ID (32-char hex, step 4) |
| `R2_ACCESS_KEY_ID` | R2 token Access Key ID (step 3) |
| `R2_SECRET_ACCESS_KEY` | R2 token Secret Access Key (step 3) |
| `R2_BUCKET_NAME` | e.g. `sharity-backups` (step 2) |

---

## Running manually

Go to **Actions → Convex Daily Backup → Run workflow** and click the green button. Useful for testing or taking an on-demand backup before a risky migration.

---

## Retrieving a backup

**Via Cloudflare dashboard:**
1. Go to R2 → `sharity-backups` bucket
2. Find `convex-backup-YYYY-MM-DD.zip` and click **Download**

**Via CLI** (requires AWS CLI installed locally and R2 credentials configured):
```bash
aws s3 cp s3://sharity-backups/convex-backup-YYYY-MM-DD.zip ./backup.zip \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  --region auto
```

Backups accumulate indefinitely in R2 — set up an [Object Lifecycle policy](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) in the Cloudflare dashboard if you want automatic deletion of old backups.

---

## Restoring from a backup

```bash
# Restore to dev deployment
npx convex import backup.zip

# Restore to production deployment
npx convex import --prod backup.zip
```

**Warning:** restore is destructive — it wipes existing data and replaces it with the backup. Take a fresh backup first:

```bash
npx convex export --include-file-storage --path pre-restore-backup.zip
```

See the [Convex restore docs](https://docs.convex.dev/database/backup-restore#restoring-from-backup) for full details.

---

## Keeping the workflow up to date

The workflow pins `convex@1.34.1` to match the project's `package.json`. When you upgrade convex, update the version in `convex-backup.yml`:

```yaml
run: npx convex@1.34.1 export --include-file-storage --path backup.zip
```

Action versions in use:

| Action | Version |
|---|---|
| `actions/setup-node` | `v6` (v6.3.0, Mar 2026) |

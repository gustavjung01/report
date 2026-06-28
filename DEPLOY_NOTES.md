# Deploy notes

```bat
cd "F:\\1_A_Disk_D\\Tool\\report"
git fetch origin main
git reset --hard origin/main
git push deploy main --force-with-lease
```

Checks:

- Open live app and refresh after PWA update.
- Admin Supabase must use public anon or publishable key only.
- Data tab: Load DB.
- AI tab: create summary.
- File output: download JSON CSV TXT or HTML.
- Supabase: check bucket report-exports and table exports.

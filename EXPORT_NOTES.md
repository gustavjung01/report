# File output notes

The file output panel is loaded from `file-out-module.js`.

It can download local files in these formats:

- JSON
- CSV
- TXT
- HTML

When Supabase is ready, it uploads the file to Storage bucket `report-exports` under `exports/` and writes one row to table `exports`.

Supported sources:

- all data
- orders
- ONA tests
- market reports
- AI summaries

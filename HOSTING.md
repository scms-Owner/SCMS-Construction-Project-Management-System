# SCMS hosting notes

The GitHub Actions workflow publishes the static frontend to GitHub Pages. Enable **Settings → Pages → Build and deployment → GitHub Actions** if needed.

**Important:** GitHub Pages serves static files only. It cannot run the `api/*.js` Node handlers or securely proxy Neon Auth cookies. Before production, deploy those handlers to a secure Node/serverless host and configure a same-site custom domain/reverse proxy, or explicitly adapt authentication for cross-origin cookies/CORS with CSRF protection. Do not point the frontend at a separate origin and assume same-origin cookies work.

Keep `DATABASE_URL`, Neon Auth secrets, and owner configuration in server-side environment variables only. The remaining UI integration and end-to-end tests for daily progress, bill approvals, payment caps, receivables, and audited profit/loss are still required. The financial summary must be treated as indicative cash margin, not certified profit.

A push to the default branch is configured to trigger the `Deploy SCMS frontend to GitHub Pages` workflow; use the Actions tab to verify its result.

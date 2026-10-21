# Tiki-Data: automatic Cloudflare Pages deployments

This repository deploys the **existing** Cloudflare Pages Direct Upload project `tiki-data` using GitHub Actions. It does not switch the Pages project to Git integration and does not alter the D1 database.

## One-time setup

1. **First reconcile the current production Worker with the GitHub source.** The latest UI may have been deployed manually as a ZIP without being committed to GitHub. Do not enable automatic deployment until the committed frontend and Worker reproduce the currently approved production version.
2. In Cloudflare, create a narrowly scoped API token with **Account → Cloudflare Pages → Edit** for the account hosting `tiki-data`.
3. In GitHub repository **Settings → Secrets and variables → Actions → Repository secrets**, create `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Never commit the token to Git.
4. In **Settings → Secrets and variables → Actions → Variables**, create `TIKI_AUTO_DEPLOY_ENABLED` with value `true` only after confirming step 1.
5. Ensure the GitHub **production** environment permits the workflow to deploy. You can optionally require approval in environment protection settings.
6. After the workflow is merged, use **Actions → Tiki-Data — Cloudflare Pages deployment → Run workflow** for a controlled first release.

## How it works

On each push to `main`, the workflow rebuilds embedded assets using `scripts/sync-worker-assets.py`, checks JavaScript syntax, runs Node and Python regression tests, and packages `dist/_worker.js`. The deployment job runs **only** when the `TIKI_AUTO_DEPLOY_ENABLED` repository variable is `true` and all tests pass. It downloads the **same tested artifact** and publishes to the existing `tiki-data` project with Wrangler.

If a test fails, a secret is missing, or the enable variable is not set, there is **no production deployment**. The workflow does not run database migrations or write to D1.

## Important

The earlier GitHub PR #73 for faster fixtures is separate and currently has a failing check. Do not assume that code has reached production. Reconcile the latest deployed Match Center and test it before enabling automatic deployments.

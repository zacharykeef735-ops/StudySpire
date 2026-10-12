# Study Summit v3.77 — GitHub Pages + Supabase Username Cloud

## What changed

- **Username + password** is the default Cloud login. No email or phone is requested for these *new* accounts.
- **Older email accounts** remain accessible through the small switch on the login screen, including existing Cloud Owner accounts. Do not delete your old account.
- Every account still has separate cloud study data; Owner/Admin/Moderator permissions and bans are checked by Supabase on the server, not the website alone.
- Personal study backups and Study Summit cloud exports can now be imported into a username account.
- The old browser-local `admin` demo is not the Cloud Owner, and its tools are hidden while Cloud mode is active.

## UPDATE THE EXISTING WEBSITE

This repository serves a static website through GitHub Pages. `index.html`, `cloud.js` and `cloud-config.js` must remain in the root of the repository. **Don't overwrite your working `cloud-config.js` or paste a service_role/secret key into GitHub.**

**FIRST: prepare Supabase to use the new accounts.**

1. Open your Study Summit project in [Supabase](https://supabase.com/dashboard).
2. Confirm that you originally ran `supabase.sql`. Don't rerun that original migration on an existing configured app unless needed.
3. Open **Authentication → Sign In / Providers → Anonymous Sign-Ins** and enable it. The exact menu wording may vary by dashboard version.
4. Open **SQL Editor → New query**, paste **all** of `username-login-migration.sql`, and click **Run**. This extends, rather than replaces, the existing schema.
5. Return to Study Summit. Click **Create account** with a **new username and strong password**. No email is requested.
6. To access your existing Cloud Owner account, click **Older email account** and use its original email/password. A new username account is a *new account*, not an automatic transfer of permissions or saved work.
7. If you want the new username account to become Owner, while retaining the old Owner account as an emergency fallback, run this **one-time SQL** in the SQL Editor after successfully creating your new username account, replacing the placeholder:

   ```sql
   update public.ss_profiles
      set role = 'owner'
    where username = lower('YOUR_NEW_USERNAME_HERE')
      and role = 'student';
   ```

   Confirm **one row** was updated. Only run this as the project administrator after verifying it's your own account. Your old Owner account keeps its privileges unless you choose to change it separately.

**Do not** put the contents of the username migration into `cloud-config.js`. The SQL is run in the Supabase SQL Editor only.

### Moving your existing notes to the new username account

- Sign into your *old* Cloud email account and choose **Cloud account → Export all study data** (if banned, the export options are on the ban screen).
- Sign out, then sign into your *new* username account.
- Choose **Import old backup**, select that exported JSON file, and confirm. Imported study sections replace matching study sections in the destination account; **keep another copy of your backup**.
- This imports study data, **not Owner/Admin permissions, passwords, bans, reports, or account identities**.

## Security and limitations

- Usernames/passwords are authenticated through **Supabase anonymous sessions + password-checking database RPCs**. Password hashes are stored in a private database schema and are not readable from the website. This is a custom design and **has not been live penetration-tested**; have it reviewed before inviting lots of users.
- A forgotten username-account password **cannot currently be reset**. Owner-assisted recovery was discussed but has **not** been implemented. Keep your password in a reputable password manager. Never give the Owner your current password.
- Account switching uses the **Sign out** button; do not simply share a logged-in browser with someone else.
- Unlike email-based accounts, there is no automatic email verification, password recovery, or notice delivery for username accounts.
- The earlier **browser-local** admin account is not a real cloud-wide administrator. It works only when Supabase Cloud mode is not active.
- If `username-login-migration.sql` or Anonymous Sign-Ins is not set up, username registration won't work; **Older email account** should still work as a fallback.
- This patch has JS syntax checks and simulated browser tests, but **live Supabase registration, auth session behavior, and cross-device access must be tested against the actual project** before declaring it production ready.
- Study content can still be accessed by signed-in accounts; don't store sensitive school, health, or financial records without appropriate privacy safeguards.
- Public GitHub Pages HTML is accessible to everyone, whether banned or not; bans restrict account features and cloud data, not viewing static page source.

## Deploy and troubleshooting

- GitHub Pages publishes from your configured branch (typically `main`) and root directory. `index.html` is the site's entry file.
- If you don't see the new login screen after deploying, check **Actions → Pages build and deployment** and hard-refresh your browser.
- **"Function not found" or RPC errors**: run `username-login-migration.sql` in Supabase; confirm there were no SQL errors.
- **"Anonymous sign-ins disabled"**: enable them under Supabase Authentication providers.
- **"Invalid login"**: double-check the username and password. Server rate limiting may temporarily lock repeated failures.
- **Owner option missing**: the new account is a Student until you explicitly promote it in Supabase as described above.
- **Old Owner can't sign in?** Use **Older email account**. Don't delete the old account until you verify the replacement.

Official docs: [GitHub Pages](https://docs.github.com/en/pages), [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

# Study Summit v3.75 — GitHub Pages + optional Supabase Cloud

**IMPORTANT:** The site is ready for GitHub Pages immediately. GitHub Pages alone hosts the static website, but DOES NOT create shared accounts or secure website-wide bans. To get cross-device accounts, role management and bans, finish the **Supabase** steps below. You cannot do that part entirely inside GitHub.

## A. Publish the website on GitHub (no coding needed)

1. Download `Study-Summit-v3.75-GitHub-Pages.zip` and **unzip it** on your computer. (GitHub does not automatically unpack an uploaded ZIP.)
2. Sign in at https://github.com and choose **New repository**. Name it `study-summit`, choose **Public**, and create it.
3. In that repository choose **Add file → Upload files**. Upload **all five files** from the unzipped folder at the ROOT level (not the folder itself): `index.html`, `cloud.js`, `cloud-config.js`, `supabase.sql`, `README.md`. Also upload `.nojekyll` if your file browser shows hidden files. Commit the upload.
4. Go to **Settings → Pages → Build and deployment → Deploy from a branch**. Select `main`, `/ (root)`, then **Save**.
5. Wait for GitHub to publish. Visit `https://YOUR_GITHUB_USERNAME.github.io/study-summit/`.
6. You'll see a **GitHub-only mode** banner until you configure Supabase. In this mode, accounts and bans are *local to each browser*.

> **Note:** To keep SQL out of the published web root, you may choose to upload only `index.html`, `cloud.js`, `cloud-config.js` and `.nojekyll`. Keep `supabase.sql` and README locally or upload to the repo for convenience. SQL does **not** contain passwords or secrets. All website files must sit together at repository ROOT.

## B. Enable real cross-device accounts and admin controls (extra service: Supabase)

1. Open https://supabase.com and create a project. Keep your database password somewhere private; never put it in GitHub.
2. In the Supabase dashboard open **SQL Editor → New query**. Open `supabase.sql`, paste **all its contents**, and click **Run**. This creates the account database, study-data sync, roles, bans, reports, and server-side Row Level Security rules.
3. In **Project Settings** find your **Project URL** and **publishable key** (or legacy `anon` public key). **DO NOT use a `service_role`, `sb_secret_`, database password or other secret key** in a website.
4. In your GitHub repository, open `cloud-config.js` → pencil **Edit**. Change only these two entries to the values from Supabase:

   ```js
   window.STUDY_SUMMIT_CLOUD = {
     url: 'https://YOUR_PROJECT.supabase.co',
     publishableKey: 'YOUR_PUBLIC_PUBLISHABLE_KEY'
   };
   ```

   Commit the change, then wait for GitHub Pages to redeploy.
5. In Supabase, open **Authentication → URL Configuration**. Set **Site URL** to `https://YOUR_GITHUB_USERNAME.github.io/study-summit/`, and add the same address to allowed redirect URLs if necessary. Confirmations will return people to the correct website.
6. Open your new site, choose **Create account**, and sign up using **your own** email, username and password. Confirm your email if Supabase requests it; then sign in.
7. To become the first Owner, go back to **Supabase → SQL Editor**, paste this SQL, **replace the email with your actual registered email**, then Run:

   ```sql
   update public.ss_profiles
      set role = 'owner'
    where id = (
      select id from auth.users
      where email = lower('YOUR_SIGNUP_EMAIL_HERE')
    );
   ```

   Check that Supabase reports **1 updated row**. Refresh Study Summit, sign out and sign in again if needed. Only this owner can assign other Admin/Moderator roles through **☁ Cloud staff**. Do **not** publish this owner-claim command as a public client function.

### What cloud mode supports

- Supabase email/password accounts shared across devices; confirmation may be required.
- Private flashcard, chats, tutor and planner storage syncing across browsers when signed into the same account; updates sync after a short delay. **Do not edit the same study content simultaneously on two devices.** Last successful save may overwrite earlier changes.
- Server-controlled **Owner**, **Admin**, **Moderator**, and **Student** roles. No user can give themselves a role through the browser.
- Owner can assign Admin and Moderator roles. Owner/Admin can ban or unban eligible accounts. Moderator can review reports. Actions go into a server audit history.
- Banned users can still log in to a limited screen and export their own **flashcards**, **chats** and **all study data**, but their cloud writes and cloud features are blocked.
- **Import old backup:** On the older Study Summit, use **Study Lab → Study Tools → Export my study backup**. In cloud mode, sign in and select **Import old backup**. This replaces matching study sections in the cloud account.

### Important limitations

- The older `admin` login is a local demo account, **not** the owner of your new online site. The online owner is claimed using the SQL command above.
- **Legacy Find Friends, direct messaging, and shared decks are still local-only and are disabled in Cloud mode.** They're **not** cross-device chat services. Report submissions and staff report reviews are available in Cloud mode.
- The app's browser AI still needs a compatible browser/GPU and an internet connection for the first model download. Supabase does not run AI inference.
- Online banning blocks cloud sign-in privileges and cloud data writes, but no static website can prevent somebody from loading public HTML in their own browser as a guest. This is normal for GitHub Pages.
- Data sync covers study content and selected account-scoped study settings, not all legacy/local storage and not a complete multi-device conversion of every feature. Keep regular personal backups.
- Clearing browser storage can remove **unsynced** changes. If you reinstall or use another device, your cloud account data remains in Supabase.
- The system has been syntax/smoke tested locally with mocked cloud responses; **live Supabase registration, email confirmations, bans and syncing must be tested against your own Supabase project after setup**.
- If classmates or other students will sign up, review the privacy and consent rules for your school and location first. Do not upload anyone's school records or personal information without permission.
- Only the project's publishable/anon key belongs in GitHub. Never commit any secret, token, or database password.

### Troubleshooting

- **I only see "GitHub-only mode"**: edit `cloud-config.js`, commit, and hard-refresh the GitHub Pages site.
- **The site says it cannot reach the database**: confirm you ran all of `supabase.sql`, that the Supabase project isn't paused, and that the URL and public key are correct.
- **My account won't sign in**: finish the email confirmation step, then sign in again.
- **There is no Cloud staff button**: finish step B7, then refresh the site. Only server-assigned staff see it.
- **Can't find old flashcards**: export them first using the old Study Lab backup feature, then choose **Import old backup** in Cloud mode.
- **My changes didn't appear on another device**: wait 5 seconds after editing before closing the tab, then reload on the other device.

Official guides: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Supabase JS](https://supabase.com/docs/reference/javascript/installing), [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

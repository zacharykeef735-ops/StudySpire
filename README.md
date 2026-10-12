# StudySummit 📚

**A browser-based study workspace with personal study tools, optional Supabase cloud accounts, role-based moderation, and an experimental on-device AI assistant.**

StudySummit is a static web application: the main interface lives in `index.html`, with account and cloud features in `cloud.js`. It can be hosted using GitHub Pages without running a custom web server. Supabase provides cloud authentication, study-data synchronization, moderation, and password recovery.

> **Project status: beta.** The features described below are present in the repository and the database migrations have been applied to the connected project, but end-to-end account recovery, role authorization, cross-device sync, and AI downloads still need testing in real browsers before production use.

## Contents

- [What StudySummit does](#what-studysummit-does)
- [How it works](#how-it-works)
- [Accounts and cloud synchronization](#accounts-and-cloud-synchronization)
- [Roles and dashboards](#roles-and-dashboards)
- [Password recovery](#password-recovery)
- [Browser AI](#browser-ai)
- [Installation and deployment](#installation-and-deployment)
- [Supabase setup and migrations](#supabase-setup-and-migrations)
- [Repository files](#repository-files)
- [Security and limitations](#security-and-limitations)
- [Troubleshooting](#troubleshooting)

## What StudySummit does

StudySummit combines study and productivity features in a dark-themed browser interface. The application includes study workspace features such as notes, flashcards, study planning and tasks, saved study content, personalization, and an AI study assistant. Available features can vary by page and browser capabilities.

You can use browser-local study features without creating a cloud account. A StudySummit cloud account adds username/password sign-in, personal cloud study storage, and access to the appropriate dashboard for a user's role.

**Two distinct kinds of accounts exist:**

- **Cloud accounts:** Supabase-backed identities. New accounts use a username and password without an email address. Each account has its own study data and server-assigned permissions.
- **Older email accounts:** Existing Supabase email/password accounts remain available through the **Older email account** sign-in option.
  
An older browser-local demo administrator is **not** the same as a Supabase Cloud Owner.

## How it works

```text
Browser (index.html)
  ├── Study tools and browser-local data (localStorage)
  ├── Browser AI (optional WebGPU + downloaded model)
  └── cloud.js (optional cloud bridge)
        ├── cloud-config.js (Supabase URL + public publishable key)
        └── Supabase
              ├── Authentication / anonymous sessions
              ├── Private username credentials and session mappings
              ├── User profiles and role checks
              ├── Per-account study data
              ├── Reports, bans and moderation audit
              └── Owner-approved password recovery
```

**Local study storage:** StudySummit saves supported study sections in the browser's `localStorage`. Signed-in cloud accounts use account-specific local keys to avoid mixing saved work between accounts.

**Cloud synchronization:** `cloud.js` reads supported study data, synchronizes it with `public.ss_study_data`, and restores it for the signed-in profile. Cloud data is scoped by the account's canonical profile ID. Browser storage is not a substitute for a backup.

**Permissions:** Supabase PostgreSQL functions and row-level security (RLS) enforce account and staff privileges on the server. The browser shows different dashboard controls by role, but hiding controls is *not* the security boundary.

## Accounts and cloud synchronization

### Create a new username account

1. Open the StudySummit website and choose **Cloud account**.
2. Select **Username + password**.
3. Enter an available username (3–32 lowercase letters, digits, underscores or hyphens) and a password of at least 10 characters (maximum 72 bytes).
4. Click **Create account**.
5. After registration, StudySummit loads the new account's personal study workspace.

No email or phone number is required for these username accounts. During beta, `admin` is an allowed username; **having that username does not give administrative permissions**. The server assigns every new account the **Student** role until an Owner promotes it.

### Sign in, sign out, and use multiple accounts

Use **Username + password → Sign in** to open an existing account. To create another username account in the same browser, first **Sign out**, then register the new account. The account menu provides **Create another account** after signing out. Sign out before switching between accounts; the app does **not** currently offer simultaneous signed-in cloud accounts or one-click multi-account switching.

Older email-based users can select **Older email account** and use their existing credentials. Creating a new username account does not automatically merge it with an older email account.

### Move study content between accounts

1. Sign into the source account and **Export all study data**.
2. Keep a copy of the exported JSON backup.
3. Sign out and sign into the destination account.
4. Use **Import old backup** to import the JSON data.
5. Review the imported study sections before deleting any original copy.

Importing study data does **not** transfer roles, passwords, bans, reports, or account identity. Matching study sections in the destination account may be replaced.

## Roles and dashboards

StudySummit has four levels, in descending order:

**👑 Owner → 🛡 Admin → ⚑ Moderator → 🎓 Student**

| Capability | Owner | Admin | Moderator | Student |
| --- | :---: | :---: | :---: | :---: |
| Personal study features | Yes | Yes | Yes | Yes |
| Review reports | Yes | Yes | Yes | No |
| Ban/unban Students | Yes | Yes | No | No |
| Ban/unban Moderators | Yes | Yes | No | No |
| View manageable account lists | Yes | Yes | No | No |
| View relevant moderation history | Yes | Yes | No | No |
| Assign or change roles | Yes | No | No | No |
| Promote another account to Owner | Yes | No | No | No |
| Issue or deny password reset codes | Yes | No | No | No |

### Owner dashboard

The **Owner Dashboard** includes account management, role assignment (including multiple Owners), reports, audit history, and password recovery requests. An Owner can promote a registered account to Owner. Owners cannot demote themselves through the role-change control, and the server prevents removing the last Owner.

To grant an account a role:

1. Sign in as an Owner.
2. Open **Owner Dashboard → Accounts & roles**.
3. Select an existing username account.
4. Choose **Student**, **Moderator**, **Admin**, or **Owner**.
5. Confirm the change, especially when granting or removing Owner access.

**Do not assign Owner access based on the account's username alone.** Owner permissions include the ability to manage other Owners.

### Admin dashboard

The **Admin Dashboard** exposes account moderation for Students and Moderators, reports, and relevant action history. Admins cannot assign roles, manage Owners, or approve password recovery.

### Moderator dashboard

The **Moderator Dashboard** focuses on the report queue and review actions. Moderators cannot ban users, assign roles, view the global account list, or issue recovery codes.

### Student experience

Students use the normal study workspace without staff moderation controls.

## Password recovery

**Username accounts use Owner-assisted password recovery, not email reset links.**

### For someone who forgot their password

1. Sign out of any active StudySummit account.
2. On the sign-in screen, choose **Forgot password? Owner-assisted reset**.
3. Enter the username and click **Request reset**.
4. Contact an Owner so they can independently verify that you own the account.
5. After approval, receive a **one-time recovery code** from the Owner.
6. Return to the recovery form, enter your username, recovery code, and new password.
7. Click **Set new password**, then sign in with the new password.

The request screen intentionally does not reveal whether a username exists.

### For an Owner handling a request

1. Sign into an Owner account and open **Owner Dashboard → Password recovery**.
2. Review the pending request.
3. **Verify the requester's identity through a trusted independent channel.** A username alone is not proof of ownership.
4. Click **Issue one-time code**, or **Deny request** if verification fails.
5. Copy the generated code and privately share it with the verified account holder. It is displayed only once.
6. The account holder—not the Owner—chooses and enters the new password.

**Recovery safeguards:** Codes are random, stored as hashes, expire after one hour, and allow at most five incorrect attempts. Requests are throttled. Successful recovery invalidates existing username-session mappings and is logged in the moderation audit.

**Limitations:** Identity verification is currently manual; there is no automated email or phone verification. Never request, collect, or share a user's password. The recovery workflow needs full end-to-end testing before production use.

## Browser AI

StudySummit includes an optional browser-based AI assistant using `@mlc-ai/web-llm`. It downloads an AI model into the browser and attempts to run inference on the user's device using supported browser/GPU capabilities.

**To use it:**

1. Open the AI feature in StudySummit.
2. Select or load an available model.
3. Allow time for the initial model download; this may be large.
4. Watch the progress/status messages and wait for the model to initialize.
5. Ask a question once the model is ready.

The loader uses backup module sources and automatically retries certain first-download or model-initialization failures. Permanent errors (such as unsupported GPU capabilities or insufficient device memory) may require changing browsers or hardware. The AI is **experimental**, and real-device compatibility is not guaranteed.

Browser AI model loading is separate from Supabase username authentication; cloud sign-in is not what downloads the model.

## Installation and deployment

### Requirements

- A modern browser; browser AI additionally needs supported WebGPU/device resources.
- A static web host such as GitHub Pages.
- A Supabase project for cloud accounts, synchronization, and staff tools.
- Supabase Anonymous Sign-Ins enabled for username accounts.

### Run the website

1. Clone or download this repository.
2. Host its root directory using a static web server or GitHub Pages.
3. Open `index.html` through the hosted URL.
4. For cloud features, configure Supabase as described below.

The site is largely static and does not require a Node.js build step for the root HTML/JS. Avoid using `file://` for normal testing because browser module loading and other APIs can behave differently from an HTTP(S) origin.

### Deploy with GitHub Pages

1. Open your repository on GitHub.
2. Go to **Settings → Pages**.
3. Select the appropriate deployment source and publish from the configured branch (commonly `main`) and root folder.
4. Save, then check **Actions** for deployment results.
5. Open the published HTTPS URL and hard-refresh if the previous version remains cached.

Keep `index.html`, `cloud.js`, and `cloud-config.js` together in the repository root.

## Supabase setup and migrations

> **For a new Supabase project.** The existing StudySummit project has already had the newer migrations applied. **Do not blindly rerun the original schema on an existing database**: older SQL files contain earlier function definitions that can override later security changes.

1. Create a Supabase project.
2. In **Authentication**, enable **Anonymous Sign-Ins** (needed for username/password accounts built on anonymous Supabase sessions).
3. Locate the project's URL and **publishable/anon key** in Supabase settings.
4. Configure `cloud-config.js`:

   ```js
   window.STUDY_SUMMIT_CLOUD = {
     url: 'https://YOUR_PROJECT_REF.supabase.co',
     publishableKey: 'YOUR_PUBLIC_PUBLISHABLE_KEY'
   };
   ```

5. In **Supabase SQL Editor**, run these files **in order** for a *fresh* project:
   1. `supabase.sql` — base profiles, study data, reports, RLS, moderation.
   2. `username-login-migration.sql` — username credentials, anonymous-session mapping, username login.
   3. `role-permissions-recovery-migration.sql` — role-scoped dashboards and Owner-assisted password recovery.
6. Verify the SQL statements succeeded and that username registration/login work.
7. Create an initial Owner through a **trusted project-administrator-only database operation** after verifying the intended account. Never let public signup or client-side JavaScript grant Owner privileges.
8. Deploy the static website and test role permissions with separate accounts.

**Migration ordering matters:** The later files redefine selected functions from the base schema. Applying an old SQL file *after* a newer one can unintentionally undo fixes or weaken authorization checks.

**Key safety rule:** `cloud-config.js` may contain the **public publishable/anon key**, but **never** a Supabase secret, `service_role` key, or database password. Those must not be committed to a public repository or placed in browser JavaScript.

## Repository files

| File | Purpose |
| --- | --- |
| `index.html` | Main StudySummit interface, browser study features, and browser AI. |
| `cloud.js` | Supabase client bridge, username sign-in, cloud sync, staff dashboards, and recovery UI. |
| `cloud-config.js` | Public Supabase project URL and publishable key configuration. |
| `supabase.sql` | Original/base Supabase schema, reports, profiles, policies, and moderation functions. |
| `username-login-migration.sql` | Username credentials and custom login RPCs. |
| `role-permissions-recovery-migration.sql` | Newer role restrictions and Owner-reviewed password recovery RPCs. |
| `README.md` | Project overview, user instructions, setup, architecture, and troubleshooting. |

## Security and limitations

- **Beta software:** JavaScript syntax and some backend function checks have been performed, but no comprehensive penetration test or real-world compatibility test is claimed.
- **Server authorization:** Role and ban enforcement belongs in Supabase functions/RLS, not solely in hidden browser buttons.
- **Password storage:** Username passwords are hashed in a private Supabase schema. The browser should never receive password hashes.
- **Custom authentication:** Username accounts use Supabase anonymous sessions and database RPCs, rather than Supabase's standard email/password identity model. Have this design independently reviewed before a large public launch.
- **Role changes:** Only authenticated active Owners should be able to grant Owner privileges; an account named `admin` is not automatically an Admin.
- **Recovery:** Owners verify requesters manually. Recovery codes are temporary and must be delivered privately.
- **Data:** Browser storage may be cleared, and sync may fail. Export backups of important study data.
- **Bans:** A ban restricts cloud account operations; it cannot prevent someone from downloading publicly hosted HTML/JavaScript.
- **Privacy:** Do not store sensitive student records or regulated personal information without appropriate privacy and security review.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| **Create account** fails | Anonymous Sign-Ins enabled; username valid and unused; password length; username migration applied; sign out of any current account. |
| **Wrong password** | Confirm username and password. Repeated failures can trigger a temporary login lockout. Use Owner-assisted recovery if needed. |
| **Account has no Owner/Admin dashboard** | Confirm its server-side role; newly registered accounts start as Students. Sign out and back in after promotion. |
| **Role change denied** | Only an active Owner can assign roles; the last Owner cannot be removed. |
| **Recovery request not visible** | Confirm the request was made while signed out, an Owner is logged in, and the newest recovery migration is installed. |
| **Recovery code rejected** | Check username and code, expiry (one hour), five-attempt limit, and whether the code has already been used. |
| **Cloud sync fails** | Check the Supabase URL/key, network connection, active session, SQL policies, and browser console. Export a backup before troubleshooting. |
| **AI stuck or download fails** | Check WebGPU support, device memory, connection, browser console, and available model. Temporary failures may retry automatically. |
| **Website shows old version** | Check GitHub Pages deployment and perform a hard refresh to clear cached assets. |
| **Database RPC/function missing** | Check the migration order and Supabase SQL Editor errors. Do not reapply older migrations over newer ones without reviewing them. |

## Useful documentation

- [GitHub Pages](https://docs.github.com/en/pages)
- [Supabase documentation](https://supabase.com/docs)
- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [WebLLM](https://github.com/mlc-ai/web-llm)

---

**StudySummit is under active development.** If something breaks, record the browser, steps to reproduce, any visible error, and relevant console output—without sharing passwords, recovery codes, or secret keys.

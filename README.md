# StudySummit 📚

**A browser-based study workspace with personal study tools, optional Supabase cloud accounts, role-based moderation, and an experimental on-device AI assistant.**

StudySummit is a static web application: the main interface lives in `index.html`, with account and cloud features in `cloud.js`. It can be hosted using GitHub Pages without running a custom web server. Supabase provides cloud authentication, study-data synchronization, moderation, and password recovery.

> **Project status: beta.** The features described below are present in the repository and the database migrations have been applied to the connected project, but end-to-end account recovery, role authorization, cross-device sync, and AI downloads still need testing in real browsers before production use.

## Contents

- [What StudySummit does](#what-studysummit-does)
- [Progress, focus and quick actions](#progress-focus-and-quick-actions)
- [How it works](#how-it-works)
- [Accounts and cloud synchronization](#accounts-and-cloud-synchronization)
- [Cloud friends and messaging](#cloud-friends-and-messaging)
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

## Progress, focus and quick actions

StudySummit's compact Study Hub adds a dashboard built around the study content you already have:

- **Progress & Focus:** flashcard counts, finished tasks, completed focus sessions, personal study streaks, daily goals and a seven-day activity chart.
- **Upcoming assignments:** reads assignments from the existing Study Lab agenda.
- **Quick focus timer:** 15-, 25-, or 45-minute sessions; a session counts only when it finishes. It pauses when you pause it and will correctly finish when you return to a backgrounded tab.
- **Study suggestions:** a simple local recommendation based on upcoming assignments or cards to review — no extra AI download.
- **Compact sidebar:** the existing collapse control still works and can also be toggled with **Ctrl/⌘ + B** on desktop.
- **Quick actions:** press **Ctrl/⌘ + K** (or **/** when not typing) to search features such as the progress dashboard, AI settings, account menu, and saved work.
- **Diagnostics:** open **Health** in the top bar to check WebGPU availability, shader support, approximate browser storage usage, cloud connection, and the current AI loading message. Use **Copy results** when reporting an issue.

Daily activity is calculated from **new changes** to the Study Suite (flashcard reviews, completed tasks and completed focus sessions) plus the new Quick Focus timer. Older data still contributes to lifetime counts, but past daily totals are not invented. Progress is saved using account-scoped storage under `studydock-study-progress-v1` and included in the supported cloud study-data sync. Browser-only accounts remain local.

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

Use **Username + password → Sign in** to open an existing account. The account menu offers **⇄ Switch account** and **＋ Add account**; these explicitly sign out of the current account and return to the appropriate screen.

StudySummit remembers up to eight **usernames only** on this browser. Choose a remembered username to fill the sign-in field, then enter its password. **Passwords and active sessions are not stored by this account switcher.** StudySummit does not support being signed into multiple cloud accounts simultaneously in one browser tab.

### Change your own password

While signed into a **username account**, open **Manage account → Change my password**. Enter the current password, a different new password (at least ten characters, 72 bytes maximum), and confirmation. The password change is checked securely on the server; incorrect attempts are rate-limited, and other devices must sign in again after a successful change.

Older **email accounts** continue to use Supabase's normal email/password features. The username-password change panel is intended for username accounts only.

Older email-based users can select **Older email account** and use their existing credentials. Creating a new username account does not automatically merge it with an older email account.

### Move study content between accounts

1. Sign into the source account and **Export all study data**.
2. Keep a copy of the exported JSON backup.
3. Sign out and sign into the destination account.
4. Use **Import old backup** to import the JSON data.
5. Review the imported study sections before deleting any original copy.

Importing study data does **not** transfer roles, passwords, bans, reports, or account identity. Matching study sections in the destination account may be replaced.

## Cloud friends and messaging

The **Messages & friends** page now supports private conversations between signed-in StudySummit Cloud accounts on different devices. It keeps the earlier **local-device demo** only if Cloud is not configured; local-demo contacts and messages are not automatically migrated to Cloud.

### Add a friend and start a conversation

1. Sign in to your Cloud account.
2. Open **Messages & friends** in the sidebar or Study Suite tabs.
3. Enter the person's **exact StudySummit username** (not their email) and select **Search**.
4. Click **Send friend request**.
5. The other person signs in, opens the page, and clicks **Accept** (or **Decline**).
6. Select the accepted friend under **Chat with**, write a message and click **Send message**. You can also press **Ctrl/⌘ + Enter** from the message box.

Messages are saved in Supabase and load on other devices. The page checks for new conversations/messages while open (approximately every ten seconds) and also provides a **Refresh** button. This is polling, not a push-notification system.

### Share flashcards

Choose an accepted friend and click **Share my flashcards**. StudySummit sends a copy of up to **25 flashcards** from your library. The recipient can add the deck from **Flashcards shared with you**. Importing **adds** cards to their own collection instead of erasing existing flashcards.

### Safety and privacy

- Friend requests require **recipient approval**. Decline or cancel requests at any time.
- Use **Remove** to end a friendship or **Block** to prevent future invitations/messages. Unblocking does not restore friendship automatically.
- **Report** a received message if it violates the rules. The report sends the selected message text and your reason to staff for review; unrelated conversations are not exposed in the staff dashboard.
- Messages are limited to **2,000 characters**, with per-account spam limits and bounded history loaded in the UI.
- Conversation content is stored privately on StudySummit's Supabase project. **Messaging is not end-to-end encrypted**, and users should avoid sharing sensitive personal information.
- Deleted friendships and blocking stop further conversation access; the system does **not currently** provide message deletion, editing, read receipts, attachments, or push notifications.
- Server functions require an active, unbanned Cloud account and verify friendship and blocks for each action. The underlying five social tables have RLS enabled and are inaccessible directly to browser API roles.

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
5. After approval, receive a **6-digit one-time recovery code** from the Owner.
6. Return to the recovery form, enter your username, recovery code, and new password.
7. Click **Set new password**, then sign in with the new password.

The request screen intentionally does not reveal whether a username exists.

### For an Owner handling a request

1. Sign into an Owner account and open **Owner Dashboard → Password recovery**.
2. Review the pending request.
3. **Verify the requester's identity through a trusted independent channel.** A username alone is not proof of ownership.
4. Click **Issue one-time code**, or **Deny request** if verification fails.
5. Copy the generated **6-digit code** and privately share it with the verified account holder. It is displayed only once.
6. The account holder—not the Owner—chooses and enters the new password.

**Recovery safeguards:** Codes contain **6 numeric digits** (including possible leading zeroes), are generated with cryptographically secure randomness, stored as hashes, expire after **15 minutes**, and allow at most **five incorrect attempts**. Requests are throttled. Successful recovery invalidates existing username-session mappings and is logged in the moderation audit.

**Limitations:** Identity verification is currently manual; there is no automated email or phone verification. Never request, collect, or share a user's password. The recovery workflow needs full end-to-end testing before production use.

## Browser AI

StudySummit includes an optional browser-based AI assistant using `@mlc-ai/web-llm`. It downloads an AI model into the browser and attempts to run inference on the user's device using supported browser/GPU capabilities.

**To use it:**

1. Open the AI feature in StudySummit.
2. Select or load an available model.
3. Allow time for the initial model download; this may be large.
4. Watch the progress/status messages and wait for the model to initialize.
5. Ask a question once the model is ready.

The loader pins **WebLLM 0.2.85** and uses backup CDN sources. Before loading, it checks the model's WebGPU feature and buffer-size requirements, offers a compatible alternative if needed, and displays the model's **estimated GPU memory requirement** from WebLLM (which is *not* the download size). It also remembers the last model successfully initialized on this browser. The supported built-in options include **SmolLM2 360M**, **Llama 3.2 1B** (default), **SmolLM2 1.7B**, and **Llama 3.2 3B**. Earlier Qwen 2.5 selections were removed because they are not present in this WebLLM version's built-in model list. The loader falls back to a compatible supported model if a saved choice is no longer available.

Temporary library/download errors may retry automatically; GPU device or memory failures are not retried in a loop. If the download stays at 0% for over four minutes, StudySummit stops waiting and asks you to **refresh the page before trying again**, to avoid overlapping GPU downloads. If it reports that WebGPU is unavailable, enabling browser graphics acceleration or using another supported browser/device may be necessary.

The AI is **experimental** and a full real-device model download has not yet been verified.

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

Keep `index.html`, `suite.js`, `enhancements.js`, `enhancements.css`, `cloud.js`, and `cloud-config.js` together in the repository root.

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
   4. `six-digit-recovery-codes-migration.sql` — updates recovery functions to use 6-digit codes and invalidates any previously issued long codes.
   5. `self-service-password-change-migration.sql` — allows signed-in username users to change their own password after providing the current password.
   6. `cloud-messaging-migration.sql` — private friend requests, accepted friendships, private messages, blocking, reports, and shared flashcard decks.
6. Verify the SQL statements succeeded and that username registration/login work.
7. Create an initial Owner through a **trusted project-administrator-only database operation** after verifying the intended account. Never let public signup or client-side JavaScript grant Owner privileges.
8. Deploy the static website and test role permissions with separate accounts.

**Migration ordering matters:** The later files redefine selected functions from the base schema. Upgrading from the previous 32-character code format invalidates outstanding codes; Owners must reissue them. Applying an old SQL file *after* a newer one can unintentionally undo fixes or weaken authorization checks.

**Key safety rule:** `cloud-config.js` may contain the **public publishable/anon key**, but **never** a Supabase secret, `service_role` key, or database password. Those must not be committed to a public repository or placed in browser JavaScript.

## Repository files

| File | Purpose |
| --- | --- |
| `index.html` | Main StudySummit interface, foundational study tools, and browser AI. |
| `suite.js` | Extracted ~65 KB study suite logic, separately cached by the browser. |
| `enhancements.js` | Study progress, focus timer, quick actions, AI settings cleanup, and health diagnostics. |
| `enhancements.css` | Responsive Study Hub, command search and AI settings styles. |
| `messaging.js` | Live Cloud messaging UI: exact-username friend search, requests, chats, blocking/reporting and shared decks. |
| `messaging.css` | Responsive styling for private Cloud conversations and friends. |
| `cloud.js` | Supabase client bridge, username sign-in, cloud sync, staff dashboards, and recovery UI. |
| `cloud-config.js` | Public Supabase project URL and publishable key configuration. |
| `supabase.sql` | Original/base Supabase schema, reports, profiles, policies, and moderation functions. |
| `username-login-migration.sql` | Username credentials and custom login RPCs. |
| `role-permissions-recovery-migration.sql` | Role restrictions and Owner-reviewed password recovery RPCs, now using 6-digit codes. |
| `six-digit-recovery-codes-migration.sql` | Incremental update to shorter codes for existing installations. |
| `self-service-password-change-migration.sql` | Server-verified password change for signed-in username accounts. |
| `cloud-messaging-migration.sql` | Private social database tables and strictly validated public messaging RPCs. |
| `README.md` | Project overview, user instructions, setup, architecture, and troubleshooting. |
| `tests/browser-ai-smoke.test.cjs` | Browser AI startup and model-selection regression checks. |
| `tests/studysummit-upgrades.test.cjs` | Independent-script, password security, account isolation and progress/health regression checks. |
| `.github/workflows/browser-ai-smoke.yml` | Runs these regression tests on pull requests and main. |

## Security and limitations

- **Beta software:** JavaScript syntax and some backend function checks have been performed, but no comprehensive penetration test or real-world compatibility test is claimed.
- **Server authorization:** Role and ban enforcement belongs in Supabase functions/RLS, not solely in hidden browser buttons.
- **Password storage:** Username passwords are hashed in a private Supabase schema. The browser should never receive password hashes.
- **Custom authentication:** Username accounts use Supabase anonymous sessions and database RPCs, rather than Supabase's standard email/password identity model. Have this design independently reviewed before a large public launch.
- **Messaging:** Social database tables are private; RPCs require canonical authenticated profiles and active accounts. A sender must be an accepted friend, and blocks are checked on the server. Reported messages are visible to authorized moderators for review.
- **Role changes:** Only authenticated active Owners should be able to grant Owner privileges; an account named `admin` is not automatically an Admin.
- **Recovery:** Owners verify requesters manually. Recovery codes are temporary and must be delivered privately.
- **Data:** Browser storage may be cleared, and sync may fail. Export backups of important study data. New focus sessions and daily study progress are tracked by account, not as a public leaderboard.
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
| **Recovery code rejected** | Check username and all six digits, expiry (15 minutes), five-attempt limit, and whether the code has already been used. |
| **Cloud sync fails** | Open **Health** for last cloud sync status, check the Supabase URL/key and connection, and export a backup before troubleshooting. |
| **Password change fails** | Use a signed-in username account, enter the correct current password, and check the new password constraints. Repeated wrong passwords can cause a temporary lockout. |
| **Progress seems empty** | Daily activity begins tracking new reviews/tasks/focus work after upgrading. Older study data still counts toward lifetime metrics but cannot reconstruct historical daily activity. |
| **Messages don't load** | Verify both people signed into Cloud accounts, reload the page after deployment, check `cloud-messaging-migration.sql`, and use the Refresh button. A request must be accepted first. |
| **Cannot send a friend request** | Check the exact username, whether a request already exists, whether either person blocked the other, and any cooldown or daily request limit. |
| **Cannot send a message** | Both accounts must be active friends and unblocked. Check the 2,000-character limit and temporary rate limits. |
| **Deck import doesn't work** | Check that the recipient's flashcard library has room; imported cards are appended, not overwritten. |
| **AI stuck or download fails** | Use **SmolLM2 360M** as the smallest option; check WebGPU support, hardware acceleration, device memory, network access to Hugging Face, and browser console. For a 0% stall that times out, reload the page before retrying. The console retains the original error. |
| **Website shows old version** | Check GitHub Pages deployment and perform a hard refresh to clear cached assets. |
| **Database RPC/function missing** | Check the migration order and Supabase SQL Editor errors. Do not reapply older migrations over newer ones without reviewing them. |

## Developer regression checks

The codebase includes dependency-free smoke tests for missing DOM elements, corrupted saved history, supported model IDs, account safety, and study progress calculations. Run them with Node.js 22 or newer:

```sh
node --test tests/*.test.cjs
```

The GitHub workflow runs these tests on pull requests and updates to `main`. These tests do **not** replace an actual WebGPU download on a physical GPU.

## Useful documentation

- [GitHub Pages](https://docs.github.com/en/pages)
- [Supabase documentation](https://supabase.com/docs)
- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [WebLLM](https://github.com/mlc-ai/web-llm)

---

**StudySummit is under active development.** If something breaks, record the browser, steps to reproduce, any visible error, and relevant console output—without sharing passwords, recovery codes, or secret keys.

# First owner and user accounts

ORB signs users in with a login and password stored in PostgreSQL (`UserCredential`, scrypt hashes).
Every access change is written to the append-only `AccessAuditEvent` table.

## 1. Apply migrations

Run the normal migration step. `202611190001_user_credentials` adds `UserCredential` and `AccessAuditEvent`.

## 2. Create the first owner administrator

Run this once from a checkout that can reach the database, using the migrator connection string:

```sh
export DATABASE_URL='postgresql://orb_migrator:…@db-host:5432/orb?sslmode=require'
read -s ORB_OWNER_PASSWORD && export ORB_OWNER_PASSWORD   # type the password; it is not echoed
pnpm access:create-owner -- \
  --login owner@company.com --name-en "Owner Name" --name-ar "اسم المالك" \
  --tenant-slug company --tenant-name "Company Name" --locale ar
unset ORB_OWNER_PASSWORD
```

- Creates the tenant if the slug does not exist yet.
- Refuses to run if that tenant already has an active owner (pass `--additional` to add a second owner deliberately).
- Passwords need at least 10 characters with letters and digits.

## 3. Owner MFA switch

MFA enrolment is not built yet. The app must run with `ORB_OWNER_MFA_REQUIRED=0` (the default in
`.env.example` and `compose.acceptance.yml`). Any other value refuses owner sessions that have not completed MFA.

## 4. Everyone else

Sign in as the owner and open **Admin → Users and access** (`/admin/users`):

- **Create user**: login, Arabic and English names, language, one or more roles, and a temporary password.
  The user must choose a new password at first sign-in.
- **Roles**: Owner administrator, Operations, Finance. Changing roles ends the user's sessions.
- **Suspend**: ends all of the user's sessions and blocks sign-in.
- **Reset password**: sets a new temporary password and ends all sessions.
- **Sessions**: see and end a user's active sessions.

Safeguards: the last active owner cannot be suspended or lose the owner role, and you cannot suspend yourself.

## Sign-in protection

- Wrong login and wrong password return the same error.
- Five wrong passwords lock the account for 15 minutes.
- Sessions last 12 hours. Sign-out revokes the session on the server.
- Every mutation requires the same-origin `Origin` header and the CSRF token from the `__Host-orb_csrf` cookie.

# MiniLedger

Track the money you lend to friends, and get it back.

MiniLedger is a small full-stack app: a React Native (Expo) mobile client and a
Node/Express/PostgreSQL API. You sign in with a phone number and a development
OTP, add loans, see what is pending and what is overdue, and mark loans as
repaid.

| | |
|---|---|
| Mobile | React Native 0.86 via Expo SDK 57, TypeScript, Expo Router, Fetch + AsyncStorage |
| Backend | Node 20+, Express 5, TypeScript, PostgreSQL, `pg`, JWT, Zod |
| Tests | Jest + Supertest (55 endpoint/unit tests) |

---

## Features

- **Phone login with a mock OTP.** A 6-digit code is generated on the server and
  printed to the backend terminal. It expires after 5 minutes, allows 5 wrong
  attempts, and is invalidated after a successful sign-in. Requesting codes is
  rate limited (5 per 15 minutes per number).
- **Session persistence.** The JWT is stored in AsyncStorage, restored on cold
  start and re-validated against `/auth/me`. Logging out revokes the token
  server-side.
- **Dashboard.** Total lent, total repaid, overdue amount, pending count, and the
  three most urgent loans.
- **Loan list.** All / Pending / Repaid filters, overdue highlighting, and a
  "Mark as repaid" action with an optimistic-friendly reload.
- **Add loan.** Name, amount and due date, with date shortcuts (today, +1 week,
  +1 month), client-side validation and server field errors mapped back to the
  inputs.
- **Money as decimal strings.** Amounts are `NUMERIC(12,2)` in PostgreSQL and
  strings in JSON — never JavaScript floats.
- **User isolation.** Every loan query is scoped by `user_id`; another user's
  loan returns `404`, not `403`.

> **The OTP flow is a development mock.** No SMS is sent. It is deliberately
> weak and must be replaced with a real provider before any production use.

---

## Repository layout

```
MiniLedger/
├─ server/                 Express + PostgreSQL API
│  ├─ src/
│  │  ├─ config/           env parsing, pg pool
│  │  ├─ middleware/       validate, requireAuth, error handler
│  │  ├─ modules/          auth, loans, summary (routes/controller/service/repo)
│  │  ├─ schemas/          Zod request schemas
│  │  ├─ utils/            money, dates, clock, AppError, asyncHandler, http
│  │  ├─ app.ts            express app (exported for Supertest)
│  │  └─ server.ts         http listener
│  ├─ sql/001_init.sql     idempotent schema (tables, checks, indexes, triggers)
│  ├─ scripts/             migrate, seed, reset
│  └─ tests/               Jest + Supertest suites
└─ mobile/                 Expo app
   └─ src/
      ├─ app/              Expo Router routes (tabs, login, add-loan modal)
      ├─ components/       Screen, Card, Button, TextField, LoanCard, …
      ├─ hooks/            useAuth (session), useLedger (summary + loans)
      ├─ services/         fetch wrapper + auth/loans/summary clients
      ├─ constants/        API config and design tokens
      └─ utils/            INR/date formatting
```

---

## Quick start

### 1. Prerequisites

- Node.js 20 or newer
- PostgreSQL 14+ running locally
- The **Expo Go** app on your phone (SDK 57)

### 2. Create the database

Run these once in `psql` as a superuser (`postgres`):

```sql
CREATE ROLE miniledger WITH LOGIN PASSWORD 'miniledger_dev_pw';
CREATE DATABASE miniledger OWNER miniledger;
CREATE DATABASE miniledger_test OWNER miniledger;
```

`pgcrypto` is enabled by the migration, so the role needs permission to create
extensions in its own databases (the owner role above is enough).

### 3. Start the backend

```bash
cd server
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
npm run db:migrate        # applies sql/*.sql, safe to re-run
npm run dev               # http://localhost:4000
```

Optional demo data:

```bash
npm run db:seed           # demo number: +91 98765 43210
```

The API prints its LAN addresses on startup. It binds `0.0.0.0` so the phone can
reach it:

```
[MiniLedger] API is running
  Local:   http://localhost:4000
  Network: http://192.168.1.30:4000   <- use this in the mobile app
```

### 4. Point the app at your machine

`mobile/src/constants/config.ts` already defaults to **`192.168.1.30:4000`**,
the Wi-Fi address of the development laptop this project was built on. If your
machine has a different address:

```bash
ipconfig                     # Windows: look for "IPv4 Address" on the Wi-Fi adapter
```

Either edit `LAN_HOST` in `mobile/src/constants/config.ts` or create
`mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://<YOUR-LAN-IP>:4000/api/v1
```

Do **not** use `localhost` here — on a phone that means the phone itself.

### 5. Run the mobile app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android: inside Expo Go; iOS: with the Camera
app). The phone and the laptop must be on the same Wi-Fi network, and the
backend must be running. If the app cannot reach the API it shows the exact base
URL it tried at the bottom of the login screen.

### 6. Sign in

1. Enter a 10-digit Indian mobile number (any number starting with 6–9).
2. Tap **Send OTP**.
3. Read the code printed in the backend terminal:

   ```
   [MiniLedger] MOCK OTP for +919876543210 -> 123456  (valid for 300s)
   ```

4. Enter it (or tap the code on the "Development build" card when
   `EXPOSE_OTP_IN_RESPONSE=true`) and tap **Verify & sign in**.

---

## Configuration

All backend settings live in `server/.env` (see `server/.env.example`).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `4000` / `0.0.0.0` | Listener; `0.0.0.0` exposes it to the LAN |
| `DATABASE_URL` | local `miniledger` DB | Application database |
| `TEST_DATABASE_URL` | local `miniledger_test` DB | Used only by Jest |
| `JWT_SECRET` | dev-only default | Signing key; **must** be set in production |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `APP_TIMEZONE` | `Asia/Kolkata` | Defines "today" for the overdue rule |
| `OTP_TTL_SECONDS` | `300` | OTP validity (5 minutes) |
| `OTP_MAX_VERIFY_ATTEMPTS` | `5` | Wrong guesses before the challenge is burnt |
| `OTP_MAX_REQUESTS_PER_WINDOW` | `5` | Max OTP requests per number per window |
| `OTP_REQUEST_WINDOW_SECONDS` | `900` | Rate-limit window |
| `LOG_OTP_TO_CONSOLE` | `true` | Prints the mock OTP to the terminal |
| `EXPOSE_OTP_IN_RESPONSE` | `false` | Also returns `devOtp` in the API response |
| `CORS_ORIGIN` | `*` | Allowed origins (native clients send none) |
| `ENABLE_REQUEST_LOGGING` | `true` | HTTP request log |

The server refuses to boot in `NODE_ENV=production` while the development
defaults for `DATABASE_URL`/`JWT_SECRET` are in use, and warns if OTP logging is
left on.

---

## API reference

Base URL: `/api/v1`. Every response uses an envelope:

```jsonc
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ { "field": "amount", "message": "…" } ] } }
```

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/request-otp` | – | Create a 6-digit OTP for a phone number |
| POST | `/auth/verify-otp` | – | Consume the OTP, create/find the user, return a JWT |
| GET | `/auth/me` | Bearer | Current user (`id`, `phoneNumber`, `createdAt`) |
| POST | `/auth/logout` | Bearer | Revokes the token used for the request |
| GET | `/loans` | Bearer | List loans. Query: `status=all\|pending\|repaid`, `limit` (1–100, default 50), `offset` |
| POST | `/loans` | Bearer | Create a loan → `201` |
| GET | `/loans/:id` | Bearer | One loan |
| PATCH | `/loans/:id/repay` | Bearer | Mark a pending loan repaid |
| GET | `/summary` | Bearer | Aggregates for the signed-in user |

Loan object (`LoanView`):

```json
{
  "id": "0f0b1c1e-…",
  "friendName": "Aarav Mehta",
  "amount": "1500.75",
  "dueDate": "2026-10-16",
  "status": "pending",
  "repaidAt": null,
  "isOverdue": true,
  "daysOverdue": 5,
  "createdAt": "2026-10-12T08:11:20.000Z",
  "updatedAt": "2026-10-12T08:11:20.000Z"
}
```

Summary object:

```json
{
  "totalLent": "3501.50",
  "totalRepaid": "1500.75",
  "overdueAmount": "0.00",
  "pendingAmount": "2000.75",
  "currency": "INR",
  "loanCount": 3,
  "pendingCount": 2,
  "repaidCount": 1,
  "overdueCount": 0,
  "asOfDate": "2026-10-21"
}
```

`totalLent` covers every loan ever created; `pendingAmount` and `overdueAmount`
only cover unpaid loans.

### Example request flow

```bash
# 1. ask for a code (watch the server terminal)
curl -X POST http://localhost:4000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"9876543210"}'

# 2. exchange the code for a token
curl -X POST http://localhost:4000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"9876543210","otp":"123456"}'

# 3. use the token
curl http://localhost:4000/api/v1/summary \
  -H "Authorization: Bearer <token>"

curl -X POST http://localhost:4000/api/v1/loans \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"friendName":"Aarav Mehta","amount":"1500.75","dueDate":"2026-11-01"}'
```

### Error codes

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod failure; `details[]` has per-field messages |
| `INVALID_JSON` | 400 | Malformed request body |
| `OTP_NOT_FOUND` | 400 | No active challenge for that number |
| `OTP_EXPIRED` | 400 | Challenge older than `OTP_TTL_SECONDS` |
| `OTP_ATTEMPTS_EXCEEDED` | 400 | Too many wrong guesses |
| `INVALID_OTP` | 400 | Wrong code |
| `OTP_REQUEST_LIMIT` | 429 | Rate limit reached |
| `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_REVOKED` | 401 | Missing, invalid or revoked token |
| `LOAN_NOT_FOUND` | 404 | Unknown loan, or one owned by another user |
| `LOAN_ALREADY_REPAID` | 409 | Duplicate repay attempt |
| `ROUTE_NOT_FOUND` | 404 | Unknown endpoint |
| `INTERNAL_SERVER_ERROR` | 500 | Generic — no stack traces or SQL are returned |

---

## Money, dates and the overdue rule

- Amounts are stored as `NUMERIC(12,2)` with `CHECK (amount > 0)` and a maximum
  of `9999999999.99`. The pg type parser is configured to return `NUMERIC` as a
  **string**, so values never pass through a float.
- The API accepts amounts as strings (`"1500.50"`) or numbers (converted to a
  decimal string), validates at most 2 decimals, and always responds with 2
  decimals.
- `due_date` is a calendar `DATE` (no time, no zone). The mobile app sends and
  displays `YYYY-MM-DD`.
- **Overdue** means `status = 'pending' AND due_date < today`. A loan due *today*
  is not overdue.
- "Today" is resolved in `APP_TIMEZONE` and passed into SQL as a parameter, so
  the rule is identical in production, in tests (forced to `UTC`) and on-device.
- Summary aggregation runs entirely inside PostgreSQL on `numeric` values
  (`SUM(...) FILTER (...)`), so totals are exact.

## Authentication and logout

- `POST /auth/verify-otp` returns a JWT signed with `JWT_SECRET` (issuer
  `miniledger`, audience `miniledger-mobile`, 7-day expiry) plus the user.
- The token is sent as `Authorization: Bearer <token>`; the mobile app keeps it
  in AsyncStorage so a cold start stays signed in.
- **Logout strategy: stateless JWT with a token version.** Each JWT carries a
  `ver` claim. `POST /auth/logout` increments `users.token_version`, so every
  token issued before that moment is rejected with `401 TOKEN_REVOKED`. This
  keeps reads stateless while still allowing real sign-out — no token blacklist
  table or server-side session store is needed. The trade-off is one extra user
  lookup per authenticated request and that logging out signs out *all* devices
  for that account.

## Security notes

- Every loan/summary query is scoped by the authenticated `user_id`.
- OTP codes are stored as bcrypt hashes; the plain code only ever exists in
  memory and (in development) in the server log.
- No database credentials, JWT secret, SQL or stack trace is returned to
  clients; unexpected errors become a generic 500.
- `helmet` sets sensible headers; request bodies are size-limited; parameterised
  SQL is used everywhere.
- Known gaps for production: the OTP itself is mocked, there is no refresh-token
  rotation, and rate limits are held in the database (not Redis).

---

## Tests and checks

```bash
# backend
cd server
npm test              # 4 suites, 55 tests (Jest + Supertest, real PostgreSQL)
npm run typecheck     # tsc --noEmit

# mobile
cd mobile
npm run typecheck     # tsc --noEmit
npx expo-doctor       # dependency/config health
```

The test suite runs against `miniledger_test`, truncates the tables in
`beforeAll`, and runs serially (`--runInBand`). Overdue boundaries are tested
explicitly (yesterday, today, tomorrow) with `APP_TIMEZONE=UTC`.

Coverage includes: OTP expiry/attempts/replay, token revocation, validation
errors, cross-user access, duplicate repayment, decimal-exact aggregation,
pagination/status filters and unknown routes.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| App says it cannot reach the server | Confirm `npm run dev` is running, the phone is on the same Wi-Fi, and `mobile/src/constants/config.ts` (or `EXPO_PUBLIC_API_URL`) uses the laptop's current LAN IP. |
| Works on the laptop, not on the phone | Allow Node.js through the Windows Firewall for private networks, or run `netsh advfirewall firewall add rule name="MiniLedger API" dir=in action=allow protocol=TCP localport=4000`. |
| `password authentication failed for user "miniledger"` | Recreate the role/password from step 2, or update `DATABASE_URL`. |
| `database "miniledger_test" does not exist` | Create it (step 2); tests never touch the dev database. |
| Login says the OTP expired | Codes live for 5 minutes; tap **Resend code** (30 s cooldown). |
| `EADDRINUSE :4000` | Another server is running; stop it or change `PORT` (and the mobile URL). |
| Expo Go says the SDK is unsupported | Use the latest Expo Go; this project targets SDK 57. |

---

## Known limitations

- The OTP flow is a mock, by design.
- No real-time sync: the app refetches when a screen gains focus or on pull-to-
  refresh.
- Loans can only be created or marked repaid — no edit/delete yet.
- Single currency (INR) and Indian phone numbers.
- The app icon/splash are still the Expo template assets.

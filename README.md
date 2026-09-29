# BT Booking v5

Online booking system for **BT Automazgātava** (car wash).

## Stack

| Layer | Tech |
|-------|------|
| App | Next.js 15 (App Router) |
| Hosting | Vercel |
| Database | Neon (PostgreSQL) |
| ORM | Prisma |
| i18n | next-intl (planned) |

## Status

- [x] GitHub repo
- [x] Vercel project linked
- [x] Neon via Vercel integration
- [x] Next.js + Prisma scaffold
- [ ] Migrations + seed data
- [ ] Booking flow (date → time → car → service)
- [ ] Auth
- [ ] Admin panel

## Local development

```bash
npm install

# Copy env from Vercel / Neon dashboard
cp .env.example .env
# fill DATABASE_URL and DATABASE_URL_UNPOOLED

npx prisma db push   # or: npm run db:migrate
npm run dev
```

## Environment variables (Vercel / Neon integration)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Pooled connection (runtime) |
| `DATABASE_URL_UNPOOLED` | Direct connection (migrations) |

Also available from integration: `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, etc.

## Scripts

- `npm run dev` — local server
- `npm run build` — production build (runs `prisma generate`)
- `npm run db:push` — push schema to Neon without migration files
- `npm run db:migrate` — create/apply migrations
- `npm run db:studio` — Prisma Studio UI

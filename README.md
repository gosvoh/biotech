# Biotech

Website for the Biotech faculty. Built with the Next.js App Router and a small
Prisma/SQLite backend, with authentication handled by NextAuth.

## Stack

- **Next.js 16** (App Router) and **React 19**
- **Prisma** ORM with a **SQLite** database
- **NextAuth v5** for authentication
- **Ant Design 6**, **shadcn/ui** and **Radix** primitives for the UI
- **Tailwind CSS 3** for styling
- **Bun** as the runtime and package manager
- **Vitest** for unit tests

## Prerequisites

- [Bun](https://bun.sh) (the project's runtime and package manager)

## Setup

Install dependencies:

```bash
bun install
```

Create a `.env` file based on the documented variables in
[`.env.example`](./.env.example) (database connection, mail/SMTP settings,
NextAuth, etc.).

Generate the Prisma client and apply migrations to your local database:

```bash
bun run db:generate
bun run db:migrate
```

## Common commands

| Command               | Description                                       |
| --------------------- | ------------------------------------------------- |
| `bun dev`             | Start the development server (Turbopack)          |
| `bun run build`       | Create a production build                         |
| `bun run db:migrate`  | Create/apply migrations in development            |
| `bun run db:generate` | Generate the Prisma client                        |
| `bun test`            | Run the unit tests (Vitest)                       |
| `bun lint`            | Run ESLint                                        |

## Deployment / Docker

The provided `Dockerfile` produces a standalone Next.js image using the
`oven/bun` base image. At **build time** it applies migrations and generates the
Prisma client so the cached/static pages can be prerendered (`bun run db:deploy`,
`bun run db:generate`, `bun run build`).

At **container start**, `docker-entrypoint.sh` runs `prisma migrate deploy`
against the mounted database volume before launching the server, so pending
migrations are applied to the persistent database on every deploy (not just at
build time). The SQLite database and uploads directory are exposed as volumes
(`/app/database` and `/app/uploads`) so data persists across container restarts.

CI (`.github/workflows/push.yml`) lints, typechecks, validates the Prisma
schema and runs the tests on every push and pull request, then builds and
pushes the Docker image on pushes to `master`.

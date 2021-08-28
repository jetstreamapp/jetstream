# Prisma Overview

Notes and overview of how to use prisma

https://www.prisma.io/docs/concepts

## Overall Workflow

1. Update prisma model
2. push changes to local dev DB
3. once ready and satisfied, create a dev migration
4. On deploy, prod db will be migrated

## Working with new DB changes in dev

Apply changes to DB directly (do this during prototyping)
`npx prisma db push`

Pull changed made manually to DB to prisma schema
`npx prisma db pull`

Create a migration without applying (only works if no drift, otherwise it is applied)
`npx prisma migrate dev --create-only`

Create a migration for dev
`npx prisma migrate dev --name added_foo`

Apply migration to dev, OR create a migration if there is drift (I think)
`npx prisma migrate dev`

Apply migrations to production
`npx prisma migrate deploy`

Mark a migration as already applied in production
`npx prisma migrate resolve --applied 20210823020932_init`

This resets the database and seeds everything automatically
`npx prisma migrate reset`

This seeds a database without resetting
`npx prisma db seed --preview-feature`

Create client (this adds code to node_modules/prisma)
`npx prisma generate`

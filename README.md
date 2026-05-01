# Padlet

A simple Padlet clone — collaborative boards for posting notes, images, and links. Built with Next.js, Tailwind, Prisma, and SQLite. Runs entirely on localhost.

## Features

- Create boards with custom title, description, background color, and layout (Grid / Wall / Stream)
- Add posts with title, body, color, image URL, link URL, and author
- Edit and delete posts in place
- Three layouts: Grid, Wall (masonry), Stream (single column)
- All data persists locally in a SQLite file

## Getting started

```bash
npm install
npx prisma db push     # creates prisma/dev.db
npm run dev            # starts http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project structure

```
src/
  app/                  # Next.js App Router pages + API routes
    page.tsx            # Home — list of boards
    boards/[id]/        # Board view
    api/boards/         # Board CRUD
    api/posts/          # Post CRUD
  components/           # React components
  lib/prisma.ts         # Prisma client singleton
prisma/
  schema.prisma         # DB schema (Board, Post)
  dev.db                # SQLite file (created on first run)
```

## Stack

- Next.js 14 (App Router) + React 18
- TypeScript
- Tailwind CSS
- Prisma + SQLite
- lucide-react icons

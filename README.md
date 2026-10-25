# Pawfolio

A family app for managing your dog: vaccines and reminders, food, insurance and claims, vet visits and costs. Hebrew, mobile-first PWA.

Stack: Next.js + Tailwind, Supabase (Postgres + RLS, Auth, Storage), Vercel.

## Local development

```bash
npm install
npx supabase start          # needs Docker; applies supabase/migrations
cp .env.example .env.local  # fill in the keys printed by `supabase start`
npm run dev                 # http://localhost:3000
node scripts/test-rls.mjs   # security check: families never see each other's data
```

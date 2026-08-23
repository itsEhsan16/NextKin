# NextKin

NextKin Apply helps job seekers tailor resumes to specific roles, discover matching jobs, and track
applications. This repository is the pnpm monorepo for the product; the mobile app is the first
workspace, with the web app and shared packages planned next.

- **Product spec (binding):** `doc/NextKin-Apply-V2-Project-Specification.md`
- **Mobile implementation plan:** `doc/NextKin-Mobile-UI-Implementation-Plan.md`
- **Mobile app:** `apps/mobile` - Expo SDK 57 / React Native, see `apps/mobile/README.md`
- **Agent conventions:** `CLAUDE.md`

Quick start: install Node 22 and pnpm, then `pnpm install` and `pnpm mobile` to start the Expo
dev server and scan the QR code with Expo Go on your phone.

Quality gate for every change: `pnpm typecheck && pnpm lint && pnpm test`.

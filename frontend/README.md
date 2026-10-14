# Paper & Petal storefront and management

Next.js App Router / strict TypeScript / React / Tailwind with feature-based architecture. Run `npm ci` and `npm run dev` from this directory. Preserve an existing `.env`; set `API_INTERNAL_URL` to the running FastAPI service and `APP_ORIGIN` to the exact public frontend origin.

Open http://localhost:3000 for the storefront. `/login` and `/register` use the original session system. `/account` is customer-facing; `/admin` and `/inventory` require backend-enforced permissions. Fonts and sample imagery are local.

See [../README.md](../README.md) for full setup, role promotion, test/browser commands and external integration requirements. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build -- --webpack` for local validation.

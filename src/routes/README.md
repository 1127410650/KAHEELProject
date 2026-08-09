# Routes

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory
defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or
`app/layout.tsx` — those are Next.js / Remix conventions. The only root layout
is `src/routes/__root.tsx`.

## Conventions

| File | URL |
| --- | --- |
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `users/index.tsx` | `/users` |
| `users/$id.tsx` | `/users/:id` (dynamic — bare `$`, no curly braces) |
| `posts/{-$category}.tsx` | `/posts/:category?` (optional segment) |
| `files/$.tsx` | `/files/*` (splat — read via `_splat` param, never `*`) |
| `_layout.tsx` | layout route (renders children via `<Outlet />`) |
| `__root.tsx` | app shell — wraps every page; preserve `<Outlet />` |

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.

## The four areas

A URL says which area it belongs to, and each area has exactly one parent layout
that carries its guard. Adding a page means putting it in the right area — not
inventing a fifth prefix.

| Area | Prefix | Who | Layout / guard |
| --- | --- | --- | --- |
| Public marketplace | `/`, `/search`, `/ads/*`, `/categories/*`, `/stores/*`, `/businesses/*`, `/profiles/*`, `/services/*`, `/guides/*`, static pages | anyone, indexable | `MarketShell` |
| Entry & transition | `/auth`, `/register`, `/forgot-password`, `/reset-password`, `/invite/$token`, `/choose-account`, `/join`, `/market-setup`, `/go` | signing in or picking an account | bare, `noindex` |
| Account | `/my/*` | signed in, with an active account | `my/route.tsx` |
| Business | `/business/*` | active account of kind `business` | `business/route.tsx` |
| Back office | `/admin/*` | platform staff, by permission | `admin/route.tsx` + `AdminShell` |

`/go` is the single "where do I belong?" resolver: it reads the caller and sends
a platform admin to the console, a work account to `/business`, and everyone
else to their personal pages. It replaced the old `/me` and `/audit` shells, and
it is the only destination that must never become a server 301 — a cacheable
redirect would pin one identity's landing page for every visitor.

## Two rules that are easy to break

**1. Register the route in `src/lib/routes-map.ts`.** That file is the single
source of truth for who may see a path, which layer it renders in, and where a
retired URL now points. A route file with no rule gets no visibility rule and
appears in no navigation. It grants nothing on its own: the database (RLS,
`has_perm`, `mkt_account_context`) is still the only thing that authorises data.

**2. Never silently rename or delete a public URL.** Add a `legacy` rule with a
`legacy_redirect` first. `src/server.ts` turns those into real 301s before the
app renders, so an indexed or shared link keeps working and keeps its search
ranking; every hit is logged as `[legacy-route] old -> new`, which is how we
decide when an old URL has gone quiet enough to retire. A client-side redirect
is invisible to crawlers and loses the ranking — it is not a substitute.

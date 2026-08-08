# Gohail unified provider network

## Canonical model

Gohail uses one authentication identity and an explicit active account. A
personal account owns one personal storefront; a tenant account owns one
tenant storefront shared by its authorised members. A member never receives a
second copy of the tenant store, and changing the active account never broadens
database access.

Provider professions are data, not separate authentication systems. The
`mkt_provider_categories` capability map enables the relevant catalog, order,
booking, delivery, quote, relationship and integration workflows for doctors,
clinics, barbers, salons, fuel stations, carriers, couriers, warehouses,
suppliers, factories and other provider categories.

## Commerce and booking flow

`mkt_storefronts`, `mkt_store_items` and `mkt_service_*` are the canonical
commerce and appointment model.

1. An ad is attached to its account's storefront.
2. A catalog item may reference that attached ad through `source_listing_id`.
3. A database trigger rejects links across storefronts.
4. A published product ad opens its store.
5. A published service ad with active booking settings opens
   `/services/$slug/$itemId/book` directly.

The old `/appointments` entry redirects to `/services`; the empty `appt_*`
tables remain untouched for compatibility and can be retired in a separate,
explicit data migration.

## Provider relationships

`mkt_provider_relations` stores requests between two storefronts. Supported
relationships include delivery, supply, subcontracting, service, referral and
integration partnerships. Both parties must explicitly act on a request.

A provider relationship is only a scoped commercial agreement. It never grants
tenant membership, catalog access, order access, booking access or permissions
inside the other provider's account. Those boundaries remain enforced by the
existing account context, row-level security and guarded RPC functions.

## External integrations

`mkt_integration_catalog` defines supported connector kinds.
`mkt_external_integrations` stores connector metadata and non-secret public
configuration. `mkt_integration_events` provides idempotent inbound/outbound
event state for server workers.

Browser APIs reject configuration keys that look like credentials. Passwords,
API keys, signing secrets and refresh tokens must be written by a trusted
server or Edge Function to Supabase Vault/server secrets. Only an opaque
reference and credential state belong in the integration row, and the browser
listing RPC does not return that reference.

## Classification migration

Migration `20260808022602_unified_provider_accounts_network.sql` performs an
in-place mapping without changing tenant ids, memberships, listings or public
slugs:

- tenant type `establishment` becomes `store`;
- legal entity type `establishment` becomes `sole_proprietorship`;
- `create_workspace` accepts the canonical `store` type;
- business creation captures a provider category and bootstraps its storefront;
- one tenant-level storefront is enforced regardless of which authorised member
  first created it.

All new public-schema tables declare explicit Data API grants and enable RLS.
Sensitive relationship and integration rows are exposed only through
account-scoped RPC projections; only the public provider taxonomy and safe
directory fields are available outside an account.

## Deployment order

1. Run the canonical repository and infrastructure guard.
2. Apply the migration to the canonical Supabase project.
3. Regenerate Supabase TypeScript types after the migration.
4. Run TypeScript, ESLint and the production build.
5. Smoke-test one seller, one appointment provider and one carrier account,
   including a cross-provider request and an ad-to-booking link.
6. Review Supabase security and performance advisors before release.

The implementation reuses the existing components, tokens and page shells; it
does not introduce a new visual design system.

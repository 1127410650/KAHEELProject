-- 1) Post-login-only SECURITY DEFINER functions: revoke anon + PUBLIC (keep authenticated)
revoke execute on function public.invitation_accept(text) from anon, public;
revoke execute on function public.invitation_accept_by_id(uuid) from anon, public;
revoke execute on function public.invitation_create(text, text, text, text[], uuid[], text, text, text, date, date) from anon, public;
revoke execute on function public.invitation_revoke(uuid, text) from anon, public;
revoke execute on function public.create_workspace(text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, boolean) from anon, public;
revoke execute on function public.my_workspace_state() from anon, public;
revoke execute on function public.tenant_members_list() from anon, public;
revoke execute on function public.membership_set_access(uuid, text, text[], uuid[], date, date) from anon, public;
revoke execute on function public.membership_set_status(uuid, text, text) from anon, public;
revoke execute on function public.document_analysis_apply(uuid, text[]) from anon, public;
revoke execute on function public.document_analysis_raw_text(uuid) from anon, public;
revoke execute on function public.document_analysis_review_field(uuid, text, text) from anon, public;
revoke execute on function public.document_analysis_resolve_conflict(uuid, text, text) from anon, public;

-- 2) RLS helper predicates: needed by authenticated during policy evaluation, never by anon
revoke execute on function public.has_role_in_tenant(uuid, uuid, app_role) from anon, public;
revoke execute on function public.has_permission_in_tenant(uuid, uuid, text) from anon, public;
revoke execute on function public.is_active_member(uuid, uuid) from anon, public;
revoke execute on function public.can_view_property_document(uuid) from anon, public;
revoke execute on function public.can_view_property_documents(uuid) from anon, public;
revoke execute on function public.can_view_property_services(uuid) from anon, public;
revoke execute on function public.mask_id_number(text) from anon, public;
revoke execute on function public.normalize_product_name(text) from anon, public;

-- 3) Internal-only: server/trigger use, no client calls at all
revoke execute on function public.rate_limit_hit(text, text, integer, interval) from anon, authenticated, public;
revoke execute on function public.freeze_tenant_id() from anon, authenticated, public;
revoke execute on function public.guard_membership_changes() from anon, authenticated, public;
revoke execute on function public.require_tenant_membership() from anon, authenticated, public;
revoke execute on function public.revoke_grants_on_membership_end() from anon, authenticated, public;
revoke execute on function public.property_owners_share_guard() from anon, authenticated, public;
revoke execute on function public.property_service_result_guard() from anon, authenticated, public;
revoke execute on function public.property_touch() from anon, authenticated, public;
revoke execute on function public.touch_analysis_updated_at() from anon, authenticated, public;
revoke execute on function public.touch_tenant_updated_at() from anon, authenticated, public;

-- 4) Intentionally public (documented): invitation preview before sign-in
grant execute on function public.invitation_preview(text) to anon, authenticated;
comment on function public.invitation_preview(text) is 'PUBLIC BY DESIGN: invite preview before sign-in. Rate limited, masks email, returns minimal fields, no tenant_id/user_id trusted from client.';
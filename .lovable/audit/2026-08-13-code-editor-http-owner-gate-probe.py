"""Direct HTTP probe of code-editor server functions with REAL non-owner sessions.

Creates 3 ephemeral auth users (deleted at the end), signs each in through the
Supabase Auth API to obtain a genuine access token, then calls the 4 code-editor
server functions over plain HTTP (no UI, no preview gate).
"""
import base64
import json
import os
import urllib.error
import urllib.request

URL = os.environ["SUPABASE_URL"].rstrip("/")
SECRET = os.environ.get("SUPABASE_SECRET_KEY") or os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PUB = os.environ["SUPABASE_PUBLISHABLE_KEY"]
APP = "http://localhost:8080"
PASSWORD = "Probe#2026_kaheel_Gate!x9"


def req(url, data=None, headers=None, method="GET"):
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def admin_headers():
    return {"apikey": SECRET, "Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"}


def fn_id(export):
    payload = json.dumps(
        {
            "file": "/src/lib/code-editor.functions.ts?tss-serverfn-split",
            "export": f"{export}_createServerFn_handler",
        },
        separators=(",", ":"),
    )
    return base64.b64encode(payload.encode()).decode().rstrip("=")


PAYLOADS = json.load(open("/tmp/browser/codeeditor/payloads.json"))
CALLS = [
    ("tree  (codeListDir)", "codeListDir", PAYLOADS["tree"]),
    ("read  (codeReadFile)", "codeReadFile", PAYLOADS["read"]),
    ("write (codeWriteFile)", "codeWriteFile", PAYLOADS["write"]),
    ("restore (codeRestoreSnapshot)", "codeRestoreSnapshot", PAYLOADS["restore"]),
]

ACCOUNTS = [
    ("admin عادي (platform_admin)", "platform_admin"),
    ("staff (platform_admin + staff perm)", "staff"),
    ("مالك متجر (no platform row)", None),
]

created = []
results = []
for label, role in ACCOUNTS:
    email = f"probe.{abs(hash(label)) % 10**8}.gate@kaheel-probe.invalid"
    status, body = req(
        f"{URL}/auth/v1/admin/users",
        {"email": email, "password": PASSWORD, "email_confirm": True},
        admin_headers(),
        "POST",
    )
    uid = json.loads(body).get("id") if status < 300 else None
    print(f"[create] {label} -> {status} uid={uid}")
    if not uid:
        print(body[:400])
        continue
    created.append((uid, email, role))
    if role:
        st, bd = req(
            f"{URL}/rest/v1/mkt_platform_admins",
            {"user_id": uid, "platform_role": "platform_admin", "granted_reason": "temporary security probe"},
            {**admin_headers(), "Prefer": "return=minimal"},
            "POST",
        )
        print(f"[role] platform_admin -> {st} {bd[:200]}")
        if role == "staff":
            st, bd = req(
                f"{URL}/rest/v1/mkt_staff_permissions",
                {"user_id": uid, "perm": "reports.inbox_view"},
                {**admin_headers(), "Prefer": "return=minimal"},
                "POST",
            )
            print(f"[staff perm] reports.inbox_view -> {st} {bd[:200]}")

    st, bd = req(
        f"{URL}/auth/v1/token?grant_type=password",
        {"email": email, "password": PASSWORD},
        {"apikey": PUB, "Content-Type": "application/json"},
        "POST",
    )
    token = json.loads(bd).get("access_token") if st < 300 else None
    print(f"[signin] {label} -> {st} token={'yes' if token else 'no'}")
    if not token:
        print(bd[:400])
        continue

    # Independent confirmation that the DB gate itself says "not owner" for this user.
    st_owner, bd_owner = req(
        f"{URL}/rest/v1/rpc/mkt_is_system_owner",
        {},
        {"apikey": PUB, "Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        "POST",
    )
    print(f"[mkt_is_system_owner] {label} -> {st_owner} {bd_owner.strip()[:80]}")

    for name, export, payload in CALLS:
        st, bd = req(
            f"{APP}/_serverFn/{fn_id(export)}",
            payload,
            {
                "Content-Type": "application/json",
                "x-tsr-serverFn": "true",
                "Origin": APP,
                "Referer": f"{APP}/admin/content/code",
                "Authorization": f"Bearer {token}",
            },
            "POST",
        )
        snippet = " ".join(bd.split())[:160]
        results.append((label, name, st, snippet))
        print(f"  [{label}] {name} -> HTTP {st} :: {snippet}")

print("\n--- cleanup ---")
for uid, email, role in created:
    if role:
        st, _ = req(f"{URL}/rest/v1/mkt_staff_permissions?user_id=eq.{uid}", None, admin_headers(), "DELETE")
        print(f"[staff perm delete] {email} -> {st}")
        st, _ = req(f"{URL}/rest/v1/mkt_platform_admins?user_id=eq.{uid}", None, admin_headers(), "DELETE")
        print(f"[role delete] {email} -> {st}")
    st, _ = req(f"{URL}/auth/v1/admin/users/{uid}", None, admin_headers(), "DELETE")
    print(f"[user delete] {email} -> {st}")

with open("/tmp/browser/codeeditor/results.json", "w") as fh:
    json.dump(results, fh, ensure_ascii=False, indent=2)

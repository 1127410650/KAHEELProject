"""Runtime isolation tests for KAHEEL chat + calls.

Creates three throwaway auth users (buyer, seller, intruder), a private
conversation between buyer and seller, then exercises every read/write path
with each user's real JWT through PostgREST. Everything is deleted at the end.
"""
import json
import os
import urllib.error
import urllib.request
import uuid

URL = os.environ["SUPABASE_URL"].rstrip("/")
SVC = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PUB = os.environ["SUPABASE_PUBLISHABLE_KEY"]

results = []


def call(method, path, body=None, jwt=None, key=None, prefer=None):
    apikey = key or SVC
    headers = {"apikey": apikey, "Content-Type": "application/json"}
    headers["Authorization"] = f"Bearer {jwt or (SVC if apikey == SVC else '')}".strip()
    if headers["Authorization"] == "Bearer":
        del headers["Authorization"]
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def check(name, passed, detail=""):
    results.append((name, passed, detail))
    print(("PASS  " if passed else "FAIL  ") + name + ("  | " + str(detail) if detail else ""))


def make_user(tag):
    email = f"iso-{tag}-{uuid.uuid4().hex[:8]}@kaheel.test"
    password = "Kaheel-Isolation-" + uuid.uuid4().hex
    st, body = call("POST", "/auth/v1/admin/users",
                    {"email": email, "password": password, "email_confirm": True})
    assert st in (200, 201), (st, body)
    uid = body["id"]
    st, tok = call("POST", "/auth/v1/token?grant_type=password",
                   {"email": email, "password": password}, key=PUB)
    assert st == 200, (st, tok)
    return {"id": uid, "jwt": tok["access_token"], "email": email}


def main():
    buyer = make_user("buyer")
    seller = make_user("seller")
    intruder = make_user("intruder")
    print(f"users: buyer={buyer['id']} seller={seller['id']} intruder={intruder['id']}")

    category_id = "eb995b39-12b4-4f29-9b97-694bdb8ae388"
    st, city = call("GET", "/rest/v1/mkt_cities?select=id,country_id&limit=1")
    city_id, country_id = city[0]["id"], city[0]["country_id"]

    listing_id = str(uuid.uuid4())
    st, _ = call("POST", "/rest/v1/mkt_listings", [{
        "id": listing_id, "title": "ISO TEST listing", "type_code": "product",
        "category_id": category_id, "owner_user_id": seller["id"], "status": "published",
        "city_id": city_id, "country_id": country_id, "price": 100, "currency": "SAR",
        "qa_batch_id": "iso-test",
    }], prefer="return=minimal")
    assert st in (200, 201, 204), (st, _)

    conv_id = str(uuid.uuid4())
    st, _ = call("POST", "/rest/v1/mkt_conversations", [{
        "id": conv_id, "listing_id": listing_id, "buyer_user_id": buyer["id"],
        "seller_user_id": seller["id"], "qa_batch_id": "iso-test",
    }], prefer="return=minimal")
    assert st in (200, 201, 204), (st, _)

    # Other conversation, between the intruder and nobody the buyer knows.
    other_conv = str(uuid.uuid4())
    call("POST", "/rest/v1/mkt_conversations", [{
        "id": other_conv, "listing_id": listing_id, "buyer_user_id": intruder["id"],
        "seller_user_id": seller["id"], "qa_batch_id": "iso-test",
    }], prefer="return=minimal")

    def rpc(name, args, jwt):
        return call("POST", f"/rest/v1/rpc/{name}", args, jwt=jwt, key=PUB)

    # ---- 1. parties can talk -------------------------------------------------
    st, mid = rpc("mkt_message_send",
                  {"_conversation_id": conv_id, "_kind": "text", "_body": "hello from buyer"},
                  buyer["jwt"])
    check("1. buyer can send into own conversation", st == 200 and isinstance(mid, str), st)
    st, mid2 = rpc("mkt_message_send",
                   {"_conversation_id": conv_id, "_kind": "text", "_body": "hello from seller"},
                   seller["jwt"])
    check("2. seller can send into same conversation", st == 200, st)

    st, rows = rpc("mkt_messages_list", {"_conversation_id": conv_id}, buyer["jwt"])
    check("3. buyer reads both messages", st == 200 and len(rows or []) == 2,
          f"status={st} count={len(rows or [])}")

    # ---- 2. third party is locked out ---------------------------------------
    st, rows = rpc("mkt_messages_list", {"_conversation_id": conv_id}, intruder["jwt"])
    check("4. intruder message list (knows the id) returns nothing",
          st == 200 and len(rows or []) == 0, f"status={st} count={len(rows or [])}")

    st, rows = call("GET", f"/rest/v1/mkt_messages?select=id,body&conversation_id=eq.{conv_id}",
                    jwt=intruder["jwt"], key=PUB)
    check("5. intruder direct table read returns 0 rows",
          st == 200 and len(rows or []) == 0, f"status={st} rows={rows}")

    st, body = call("POST", "/rest/v1/mkt_messages",
                    [{"conversation_id": conv_id, "body": "injected", "kind": "text"}],
                    jwt=intruder["jwt"], key=PUB, prefer="return=representation")
    check("6. intruder direct table insert rejected", st in (401, 403, 404, 42501, 400) and st != 201,
          f"status={st}")

    st, body = rpc("mkt_message_send",
                   {"_conversation_id": conv_id, "_kind": "text", "_body": "injected via rpc"},
                   intruder["jwt"])
    check("7. intruder send RPC rejected", st >= 400, f"status={st} body={body}")

    st, ctx = rpc("mkt_conversation_context", {"_conversation_id": conv_id}, intruder["jwt"])
    check("8. intruder gets no conversation context", st >= 400 or not ctx, f"status={st} ctx={ctx}")

    st, rows = call("GET", f"/rest/v1/mkt_conversations?select=id&id=eq.{conv_id}",
                    jwt=intruder["jwt"], key=PUB)
    check("9. intruder cannot see the conversation row",
          st == 200 and len(rows or []) == 0, f"status={st} rows={rows}")

    # ---- 3. inbox listing is per user ---------------------------------------
    st, rows = rpc("mkt_conversations_list", {}, buyer["jwt"])
    ids = [r["id"] for r in (rows or [])]
    check("10. buyer inbox contains only own thread",
          st == 200 and ids == [conv_id], f"status={st} ids={ids}")

    st, rows = rpc("mkt_conversations_list", {}, intruder["jwt"])
    ids = [r["id"] for r in (rows or [])]
    check("11. intruder inbox excludes buyer/seller thread",
          st == 200 and conv_id not in ids, f"status={st} ids={ids}")

    st, rows = call("GET", "/rest/v1/mkt_conversations?select=id", jwt=intruder["jwt"], key=PUB)
    visible = [r["id"] for r in (rows or [])]
    check("12. intruder table-wide conversation scan sees only own",
          st == 200 and conv_id not in visible and set(visible) <= {other_conv},
          f"status={st} ids={visible}")

    # ---- 4. anonymous access ------------------------------------------------
    st, rows = call("GET", f"/rest/v1/mkt_messages?select=id&conversation_id=eq.{conv_id}", key=PUB)
    check("13. anonymous message read blocked/empty",
          st >= 400 or len(rows or []) == 0, f"status={st} rows={rows}")
    st, body = rpc("mkt_messages_list", {"_conversation_id": conv_id}, None)
    check("14. anonymous messages_list RPC denied", st >= 400, f"status={st}")

    # ---- 5. receipts and typing -------------------------------------------
    st, _ = rpc("mkt_conversation_mark_read", {"_conversation_id": conv_id}, seller["jwt"])
    mark_ok = st in (200, 204)
    st, rows = rpc("mkt_messages_list", {"_conversation_id": conv_id}, buyer["jwt"])
    mine = [r for r in (rows or []) if r["mine"]]
    check("15. seller reading stamps the buyer's message read",
          mark_ok and st == 200 and len(mine) == 1
          and all(r["read_at"] and r["delivered_at"] for r in mine),
          f"mine={mine}")
    peer = [r for r in (rows or []) if not r["mine"]]
    check("16. buyer's own unread state untouched by peer",
          all(r["read_at"] is None for r in peer), f"peer={peer}")

    st, body = rpc("mkt_conversation_mark_read", {"_conversation_id": conv_id}, intruder["jwt"])
    check("17. intruder cannot mark the thread read", st >= 400, f"status={st}")

    st, body = rpc("mkt_typing_ping", {"_conversation_id": conv_id}, buyer["jwt"])
    check("18. buyer can publish typing", st in (200, 204), f"status={st}")
    st, val = rpc("mkt_typing_peer", {"_conversation_id": conv_id}, seller["jwt"])
    check("19. seller sees peer typing", st == 200 and val is True, f"status={st} val={val}")
    st, val = rpc("mkt_typing_peer", {"_conversation_id": conv_id}, intruder["jwt"])
    check("20. intruder sees no typing signal", st >= 400 or val is False, f"status={st} val={val}")
    st, rows = call("GET", f"/rest/v1/mkt_typing?select=user_id&conversation_id=eq.{conv_id}",
                    jwt=intruder["jwt"], key=PUB)
    check("21. intruder cannot read typing rows",
          st == 200 and len(rows or []) == 0, f"status={st} rows={rows}")
    st, body = call("POST", "/rest/v1/mkt_typing",
                    [{"conversation_id": conv_id, "user_id": buyer["id"]}],
                    jwt=intruder["jwt"], key=PUB)
    check("22. intruder cannot spoof another user's typing row", st >= 400, f"status={st}")

    # ---- 6. message tampering ----------------------------------------------
    st, body = call("PATCH", f"/rest/v1/mkt_messages?id=eq.{mid}", {"body": "tampered"},
                    jwt=seller["jwt"], key=PUB, prefer="return=representation")
    changed = bool(body) if isinstance(body, list) else False
    check("23. peer cannot edit the other party's message row",
          not changed, f"status={st} body={body}")
    st, body = call("PATCH", f"/rest/v1/mkt_messages?id=eq.{mid}", {"body": "tampered"},
                    jwt=intruder["jwt"], key=PUB, prefer="return=representation")
    check("24. intruder cannot edit any message", not (isinstance(body, list) and body),
          f"status={st} body={body}")
    st, body = call("DELETE", f"/rest/v1/mkt_messages?id=eq.{mid}",
                    jwt=intruder["jwt"], key=PUB, prefer="return=representation")
    check("25. intruder cannot delete a message", not (isinstance(body, list) and body),
          f"status={st} body={body}")

    # ---- 7. calls ----------------------------------------------------------
    st, rows = call("GET", f"/rest/v1/mkt_calls?select=id&conversation_id=eq.{conv_id}",
                    jwt=intruder["jwt"], key=PUB)
    check("26. intruder cannot list calls of the thread",
          st == 200 and len(rows or []) == 0, f"status={st} rows={rows}")
    st, body = rpc("mkt_call_can_call_conv", {"_conversation_id": conv_id}, intruder["jwt"])
    check("27a. intruder cannot query call permission for the thread",
          st >= 400 or not (body or {}).get("allowed", False) if isinstance(body, dict) else st >= 400,
          f"status={st} body={body}")
    st, body = rpc("mkt_call_start_conv", {"_conversation_id": conv_id},
                   intruder["jwt"])
    check("27. intruder cannot start a call in the thread", st >= 400, f"status={st} body={body}")
    st, rows = call("GET", "/rest/v1/mkt_call_signals?select=id&limit=5",
                    jwt=intruder["jwt"], key=PUB)
    check("28. intruder sees no call signals", st == 200 and len(rows or []) == 0,
          f"status={st} rows={rows}")

    # ---- cleanup ------------------------------------------------------------
    call("DELETE", "/rest/v1/mkt_typing?conversation_id=eq." + conv_id)
    call("DELETE", "/rest/v1/mkt_messages?conversation_id=eq." + conv_id)
    call("DELETE", "/rest/v1/mkt_conversations?qa_batch_id=eq.iso-test")
    call("DELETE", "/rest/v1/mkt_listings?qa_batch_id=eq.iso-test")
    for u in (buyer, seller, intruder):
        call("DELETE", f"/auth/v1/admin/users/{u['id']}")

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\nTOTAL: {passed}/{len(results)} passed")
    if passed != len(results):
        print("FAILED:", [n for n, ok, _ in results if not ok])


main()

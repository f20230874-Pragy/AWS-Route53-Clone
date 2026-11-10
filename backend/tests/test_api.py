import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["SEED_DEMO_DATA"] = "1"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth(client):
    r = client.post("/api/auth/login", json={"account_id": "123456789012", "username": "admin", "password": "password"})
    assert r.status_code == 200
    return client


def test_requires_auth(client):
    from fastapi.testclient import TestClient as TC
    with TC(app) as anon:
        assert anon.get("/api/hosted-zones").status_code == 401


def test_bad_login(client):
    assert client.post("/api/auth/login", json={"username": "admin", "password": "x"}).status_code == 401


def test_session_persistence_and_logout(client):
    from fastapi.testclient import TestClient as TC
    with TC(app) as c:
        c.post("/api/auth/login", json={"username": "admin", "password": "password"})
        assert c.get("/api/auth/me").json()["username"] == "admin"
        assert c.post("/api/auth/logout").status_code == 204
        assert c.get("/api/auth/me").status_code == 401


def test_zone_crud(auth):
    r = auth.post("/api/hosted-zones", json={"name": "Test-Zone.com", "comment": "hi"})
    assert r.status_code == 201, r.text
    z = r.json()
    assert z["name"] == "test-zone.com." and z["record_count"] == 2 and z["id"].startswith("Z")
    assert auth.post("/api/hosted-zones", json={"name": "test-zone.com"}).status_code == 409
    assert auth.post("/api/hosted-zones", json={"name": "bad_name!.com"}).status_code == 422
    assert auth.post("/api/hosted-zones", json={"name": "p.local", "type": "private"}).status_code == 422
    assert auth.put(f"/api/hosted-zones/{z['id']}", json={"comment": "new"}).json()["comment"] == "new"
    page = auth.get("/api/hosted-zones", params={"search": "test-zone"}).json()
    assert page["total"] == 1
    assert auth.get("/api/hosted-zones", params={"type": "private"}).json()["total"] >= 2
    assert auth.delete(f"/api/hosted-zones/{z['id']}").status_code == 204
    assert auth.get(f"/api/hosted-zones/{z['id']}").status_code == 404


def test_pagination(auth):
    p1 = auth.get("/api/hosted-zones", params={"page_size": 5, "page": 1}).json()
    p3 = auth.get("/api/hosted-zones", params={"page_size": 5, "page": 3}).json()
    assert len(p1["items"]) == 5 and p1["total"] >= 12 and len(p3["items"]) >= 1


def test_record_crud_and_validation(auth):
    z = auth.post("/api/hosted-zones", json={"name": "rec.test"}).json()
    base = f"/api/hosted-zones/{z['id']}/records"
    ok = auth.post(base, json={"name": "www", "type": "A", "ttl": 300, "values": ["1.2.3.4"]})
    assert ok.status_code == 201 and ok.json()["name"] == "www.rec.test."
    assert auth.post(base, json={"name": "www", "type": "A", "values": ["1.2.3.4"]}).status_code == 409
    assert auth.post(base, json={"name": "www", "type": "CNAME", "values": ["x.com"]}).status_code == 409
    assert auth.post(base, json={"name": "", "type": "CNAME", "values": ["x.com"]}).status_code == 422
    assert auth.post(base, json={"name": "a", "type": "A", "values": ["999.1.1.1"]}).status_code == 422
    assert auth.post(base, json={"name": "a", "type": "AAAA", "values": ["::1"]}).status_code == 201
    assert auth.post(base, json={"name": "m", "type": "MX", "values": ["10 mail.rec.test"]}).json()["values"] == ["10 mail.rec.test."]
    assert auth.post(base, json={"name": "m", "type": "MX", "values": ["mail"]}).status_code == 422
    assert auth.post(base, json={"name": "t", "type": "TXT", "values": ["hello"]}).json()["values"] == ['"hello"']
    assert auth.post(base, json={"name": "s", "type": "SRV", "values": ["1 2 3 x.rec.test"]}).status_code == 201
    assert auth.post(base, json={"name": "c", "type": "CAA", "values": ['0 issue "ca.com"']}).status_code == 201
    assert auth.post(base, json={"name": "p", "type": "PTR", "values": ["host.rec.test"]}).status_code == 201
    assert auth.post(base, json={"name": "n", "type": "NS", "values": ["ns1.x.com"]}).status_code == 201
    # names outside the zone are treated as sub-domain prefixes, like the console's "Record name" box
    r = auth.post(base, json={"name": "other.com", "type": "A", "values": ["1.1.1.1"]})
    assert r.status_code == 201 and r.json()["name"] == "other.com.rec.test."
    # weighted needs identifier
    assert auth.post(base, json={"name": "w", "type": "A", "values": ["1.1.1.1"], "routing_policy": "Weighted", "weight": 5}).status_code == 422
    assert auth.post(base, json={"name": "w", "type": "A", "values": ["1.1.1.1"], "routing_policy": "Weighted", "weight": 5, "set_identifier": "a"}).status_code == 201
    # alias
    assert auth.post(base, json={"name": "al", "type": "A", "is_alias": True, "alias_target": "d1.cloudfront.net"}).status_code == 201
    # update
    rid = ok.json()["id"]
    up = auth.put(f"{base}/{rid}", json={"name": "www", "type": "A", "ttl": 60, "values": ["5.6.7.8"]})
    assert up.status_code == 200 and up.json()["ttl"] == 60
    # search + filters
    assert auth.get(base, params={"search": "5.6.7.8"}).json()["total"] == 1
    assert auth.get(base, params={"type": "MX"}).json()["total"] == 1
    assert auth.get(base, params={"alias": "yes"}).json()["total"] == 1
    assert auth.get(base, params={"routing_policy": "Weighted"}).json()["total"] == 1
    # protected records
    recs = auth.get(base, params={"page_size": 100}).json()["items"]
    soa = next(r for r in recs if r["type"] == "SOA")
    ns = next(r for r in recs if r["type"] == "NS" and r["name"] == "rec.test.")
    assert auth.delete(f"{base}/{soa['id']}").status_code == 409
    assert auth.delete(f"{base}/{ns['id']}").status_code == 409
    # zone not empty
    assert auth.delete(f"/api/hosted-zones/{z['id']}").status_code == 409
    ids = [r["id"] for r in recs if r["type"] not in ("NS", "SOA") or r["name"] != "rec.test."]
    ids = [r["id"] for r in recs if r["id"] not in (soa["id"], ns["id"])]
    assert auth.post(f"{base}/bulk-delete", json={"ids": ids}).json()["deleted"] == len(ids)
    assert auth.delete(f"/api/hosted-zones/{z['id']}").status_code == 204


def test_import_export(auth):
    z = auth.post("/api/hosted-zones", json={"name": "bind.test"}).json()
    zone = '''$ORIGIN bind.test.
$TTL 1h
@   IN SOA ns1.bind.test. admin.bind.test. ( 1 2h 1h 1w 1d )
@   IN NS ns1.bind.test.
@   IN A 192.0.2.1
www IN CNAME @
    IN TXT "ignored-dup-owner-inherits-www"
mail 600 IN A 192.0.2.5
@   IN MX 10 mail
@   IN TXT "v=spf1 -all" ; comment
bad IN A 999.0.0.1
'''
    r = auth.post(f"/api/hosted-zones/{z['id']}/records/import", json={"content": zone}).json()
    assert r["created"] >= 4, r
    assert any("bad.bind.test." in e for e in r["errors"])
    b = auth.get(f"/api/hosted-zones/{z['id']}/export", params={"format": "bind"})
    assert "mail.bind.test.\t600\tIN\tA\t192.0.2.5" in b.text
    j = auth.get(f"/api/hosted-zones/{z['id']}/export", params={"format": "json"}).json()
    assert j["zone"]["name"] == "bind.test." and len(j["records"]) >= 6

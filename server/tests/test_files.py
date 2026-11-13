from test_accounts import auth, client


def test_download_link_serves_the_file_as_an_attachment():
    _, h = auth("luke", "Luke")
    r = client.put("/api/rides/files/cranky-2026.fit", content=b"\x0e\x10fit", headers=h)
    assert r.status_code == 200
    url = r.json()["url"]
    got = client.get(url)  # no login: the link itself is the credential
    assert got.content == b"\x0e\x10fit"
    assert got.headers["content-disposition"] == 'attachment; filename="cranky-2026.fit"'
    assert client.get(url + "?inline=1").headers["content-disposition"].startswith("inline")
    assert client.get(url.replace(".fit", ".png")).status_code == 404


def test_download_needs_a_login_a_known_type_and_a_sane_size():
    _, h = auth("luke", "Luke")
    assert client.put("/api/rides/files/a.fit", content=b"x").status_code == 401
    assert client.put("/api/rides/files/a.exe", content=b"x", headers=h).status_code == 422
    assert client.put("/api/rides/files/a.png", content=b"", headers=h).status_code == 413


def test_old_downloads_make_way():
    _, h = auth("luke", "Luke")
    put = lambda i: client.put(f"/api/rides/files/r{i}.json", content=b"{}", headers=h)  # noqa: E731
    urls = [put(i).json()["url"] for i in range(8)]
    assert client.get(urls[0]).status_code == 404
    assert client.get(urls[-1]).status_code == 200

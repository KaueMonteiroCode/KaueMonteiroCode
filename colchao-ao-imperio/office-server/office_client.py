"""Ajudante para robôs em Python (só biblioteca padrão).

    from office_client import report
    report("alfredo", status="working", task="Pesquisando ofertas", progress=40, event="Encontrou 12 ofertas")

Nunca derruba o seu robô: se o escritório estiver fechado, só ignora.
"""
import json
import os
import urllib.request


def report(agent, **fields):
    url = os.environ.get("OFFICE_URL", "http://localhost:4317")
    token = os.environ.get("OFFICE_TOKEN")
    body = json.dumps({"agent": agent, **fields}).encode("utf-8")
    req = urllib.request.Request(f"{url}/api/report" + (f"?k={token}" if token else ""), data=body, headers={"content-type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=3) as r:
            return r.status == 200
    except Exception:
        return False

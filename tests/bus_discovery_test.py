"""Isolated discovery order. Uses dummy tokens and temp files; no owner config."""
import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
PY = os.environ.get("AGENT_BUS_PYTHON") or sys.executable
PROBE = r"""
import json, os, sys
sys.path.insert(0, os.environ["AGENT_BUS_ROOT"])
import agent_bus_mcp as bus
print(json.dumps({"url": bus.REMOTE_URL, "token": bus.REMOTE_TOKEN}))
"""


def probe(home, db, extra_env=None, files=None):
    drive, tail = os.path.splitdrive(str(home))
    env = {**os.environ, "HOME": str(home), "USERPROFILE": str(home), "HOMEDRIVE": drive or "C:",
           "HOMEPATH": tail or "\\", "AGENT_BUS_DB": str(db), "AGENT_BUS_ROOT": str(ROOT)}
    env.pop("AGENT_BUS_URL", None)
    env.pop("AGENT_BUS_TOKEN", None)
    if extra_env:
        env.update(extra_env)
    for path, payload in (files or {}).items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload), encoding="utf-8")
    result = subprocess.run([PY, "-c", PROBE], cwd=str(ROOT), env=env, capture_output=True, text=True, timeout=20)
    if result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout)
    return json.loads(result.stdout)


class Discovery(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="agent-bus-discovery-")
        self.home = Path(self.temp.name) / "home"
        self.db = Path(self.temp.name) / "bus.sqlite"
        self.home.mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def test_env_url_wins_over_descriptor_and_home(self):
        found = probe(self.home, self.db, extra_env={"AGENT_BUS_URL": "http://127.0.0.1:9", "AGENT_BUS_TOKEN": "env-token"},
                      files={self.db.parent / "bus-connection.json": {"version": 1, "db": str(self.db),
                                                                     "url": "http://127.0.0.1:8", "token": "desc-token"},
                             self.home / ".agent-bus" / "config.json": {"url": "http://127.0.0.1:7", "token": "home-token"}})
        self.assertEqual(found, {"url": "http://127.0.0.1:9", "token": "env-token"})

    def test_local_descriptor_wins_over_home_config(self):
        found = probe(self.home, self.db, files={
            self.db.parent / "bus-connection.json": {"version": 1, "db": str(self.db),
                                                     "url": "http://127.0.0.1:8", "token": "desc-token"},
            self.home / ".agent-bus" / "config.json": {"url": "http://127.0.0.1:7", "token": "home-token"}})
        self.assertEqual(found, {"url": "http://127.0.0.1:8", "token": "desc-token"})

    def test_home_config_used_when_no_descriptor(self):
        found = probe(self.home, self.db, files={
            self.home / ".agent-bus" / "config.json": {"url": "http://127.0.0.1:7", "token": "home-token"}})
        self.assertEqual(found, {"url": "http://127.0.0.1:7", "token": "home-token"})

    def test_mismatched_descriptor_db_fails_visibly(self):
        drive, tail = os.path.splitdrive(str(self.home))
        env = {**os.environ, "HOME": str(self.home), "USERPROFILE": str(self.home), "HOMEDRIVE": drive or "C:",
               "HOMEPATH": tail or "\\", "AGENT_BUS_DB": str(self.db), "AGENT_BUS_ROOT": str(ROOT)}
        env.pop("AGENT_BUS_URL", None)
        env.pop("AGENT_BUS_TOKEN", None)
        desc = self.db.parent / "bus-connection.json"
        desc.write_text(json.dumps({"version": 1, "db": str(self.db.parent / "other.sqlite"),
                                    "url": "http://127.0.0.1:8", "token": "desc-token"}), encoding="utf-8")
        result = subprocess.run([PY, "-c", PROBE], cwd=str(ROOT), env=env, capture_output=True, text=True, timeout=20)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Invalid local Agent Bus connection descriptor", result.stderr + result.stdout)


if __name__ == "__main__":
    unittest.main()

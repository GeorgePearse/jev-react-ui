"""Loopback-only JSON API for local UI clients; MCP remains the agent control plane."""

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from modelmode.workspace import Workspace

MAX_BODY = 1_000_000


def make_handler(workspace: Workspace) -> type[BaseHTTPRequestHandler]:
    """Bind prediction requests to one explicit trusted workspace."""

    class Handler(BaseHTTPRequestHandler):
        server_version = "ModelModeLocal/0.1"

        def _json(self, status: int, value: Any) -> None:
            body = json.dumps(value, allow_nan=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            if self.path == "/health":
                self._json(200, {"status": "ready"})
                return
            if self.path == "/capabilities":
                entries = []
                for capability in workspace.list_capabilities():
                    latest = capability["versions"][-1]
                    run = workspace.get_run(latest["run_id"])
                    dataset = workspace.describe_dataset(run["dataset_id"])
                    selected = next(
                        candidate
                        for candidate in run["candidates"]
                        if candidate["name"] == latest["candidate"]
                    )
                    entries.append(
                        {
                            "name": capability["name"],
                            "version": latest["version"],
                            "labels": dataset["classes"],
                            "candidate": selected["name"],
                            "validation": selected.get("validation", {}),
                            "test": latest.get("test", {}),
                            "abstain_below": latest["abstain_below"],
                        }
                    )
                self._json(200, {"capabilities": entries})
                return
            self._json(404, {"error": "Not found"})

        def do_POST(self) -> None:
            if self.path != "/predict":
                self._json(404, {"error": "Not found"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= MAX_BODY:
                    raise ValueError("Request body must be between 1 byte and 1 MB")
                request = json.loads(self.rfile.read(length))
                name = request.get("name")
                examples = request.get("examples")
                version = request.get("version")
                if not isinstance(name, str) or not isinstance(examples, list):
                    raise ValueError("Provide a capability name and examples array")
                started = time.perf_counter()
                result = workspace.predict(name, examples, version)
                result["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 2)
                self._json(200, result)
            except (ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
                self._json(400, {"error": str(error)})
            except Exception:
                self._json(500, {"error": "Local prediction failed"})

        def log_message(self, _format: str, *_args: Any) -> None:
            return

    return Handler


def main() -> None:
    """Run the local prediction bridge on loopback; never exposes model files."""
    parser = argparse.ArgumentParser(
        description="Serve local ModelMode predictions to a UI"
    )
    parser.add_argument("--root", required=True, help="Trusted ModelMode workspace")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(
        ("127.0.0.1", args.port), make_handler(Workspace(args.root))
    )
    print(f"ModelMode local prediction API listening at http://127.0.0.1:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

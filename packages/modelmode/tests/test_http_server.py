"""The loopback UI bridge serves only published local capabilities."""

import json
import threading
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from modelmode.http_server import make_handler


class PublishedWorkspace:
    def list_capabilities(self):
        return [
            {
                "name": "emoji",
                "versions": [
                    {
                        "version": 1,
                        "run_id": "r1",
                        "candidate": "tfidf_word",
                        "abstain_below": 0,
                    }
                ],
            }
        ]

    def get_run(self, _run_id):
        return {
            "dataset_id": "d1",
            "candidates": [{"name": "tfidf_word", "validation": {"accuracy": 1.0}}],
        }

    def describe_dataset(self, _dataset_id):
        return {"classes": ["😂", "😢"]}

    def predict(self, name, examples, version):
        assert (name, examples, version) == ("emoji", ["funny"], 1)
        return {
            "predictions": [
                {
                    "label": "😂",
                    "score": 0.9,
                    "abstained": False,
                    "probabilities": {"😂": 0.9, "😢": 0.1},
                }
            ]
        }


def test_capability_and_prediction_routes() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(PublishedWorkspace()))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        with urlopen(f"{base}/capabilities") as response:
            capability = json.load(response)["capabilities"][0]
        assert capability["labels"] == ["😂", "😢"]
        assert capability["validation"] == {"accuracy": 1.0}

        request = Request(
            f"{base}/predict",
            data=json.dumps(
                {"name": "emoji", "version": 1, "examples": ["funny"]}
            ).encode(),
            headers={"content-type": "application/json"},
            method="POST",
        )
        with urlopen(request) as response:
            result = json.load(response)
        assert result["predictions"][0]["label"] == "😂"
        assert result["elapsed_ms"] >= 0

        try:
            urlopen(f"{base}/missing")
        except HTTPError as error:
            assert error.code == 404
        else:
            raise AssertionError("Missing route should return 404")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

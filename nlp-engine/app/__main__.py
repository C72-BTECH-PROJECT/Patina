"""Start the NLP service: `python -m app` from nlp-engine/.

Binds 127.0.0.1:8000 by default, so the service is reachable only from this
machine (the gateway and core call it over loopback). NLP_HOST and NLP_PORT
override the defaults.
"""

import os

import uvicorn


def main() -> None:
    host = os.environ.get("NLP_HOST", "127.0.0.1")
    port = int(os.environ.get("NLP_PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port)


if __name__ == "__main__":
    main()

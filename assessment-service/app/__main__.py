"""Start the assessment service: `python -m app` from assessment-service/.

T-0029 (I-0060, I-0061): binds app.config.HOST:PORT, by default 127.0.0.1:8002,
the address the backend calls (ASSESSMENT_SERVICE_URL). Internal only: never
bind 0.0.0.0; the browser reaches assessments through the backend.
"""
import uvicorn

from app.config import HOST, PORT
from app.main import app

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)

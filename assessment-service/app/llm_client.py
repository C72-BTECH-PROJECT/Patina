
import json
import time

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    OpenAI,
    RateLimitError,
)

from app.config import (
    FREE_MODELS,
    MAX_RETRIES_PER_MODEL,
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    REQUEST_TIMEOUT_SECONDS,
)


class AssessmentLLMError(Exception):
    """Raised when all configured LLM models fail."""


def generate_json(prompt: str) -> tuple[dict, str]:
    """
    Generate a JSON object using OpenRouter.

    Returns:
        A tuple containing the parsed JSON object and model name.
    """
    if not OPENROUTER_API_KEY:
        raise AssessmentLLMError(
            "OPENROUTER_API_KEY is missing from assessment-service/.env"
        )

    if not FREE_MODELS:
        raise AssessmentLLMError("No models are configured.")

    client = OpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL,
        timeout=REQUEST_TIMEOUT_SECONDS,
        max_retries=0,
    )

    failures = []

    try:
        for model in FREE_MODELS:
            for attempt in range(MAX_RETRIES_PER_MODEL):
                try:
                    response = client.chat.completions.create(
                        model=model,
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    "You generate technical assessments. "
                                    "Follow the user's instructions and "
                                    "return only valid JSON."
                                ),
                            },
                            {"role": "user", "content": prompt},
                        ],
                        temperature=0.3,
                    )

                    content = response.choices[0].message.content

                    if not content:
                        raise ValueError("The model returned empty content.")

                    result = json.loads(content)

                    if not isinstance(result, dict):
                        raise ValueError(
                            "The model response must be a JSON object."
                        )

                    return result, model

                except (
                    RateLimitError,
                    APITimeoutError,
                    APIConnectionError,
                    APIStatusError,
                ) as exc:
                    failures.append(
                        f"{model}, attempt {attempt + 1}: "
                        f"{type(exc).__name__}"
                    )

                    retryable = (
                        isinstance(
                            exc,
                            (
                                RateLimitError,
                                APITimeoutError,
                                APIConnectionError,
                            ),
                        )
                        or (
                            isinstance(exc, APIStatusError)
                            and (
                                exc.status_code >= 500
                                or exc.status_code == 408
                            )
                        )
                    )

                    if not retryable:
                        break

                    if attempt + 1 < MAX_RETRIES_PER_MODEL:
                        time.sleep(min(2 ** attempt, 4))

                except (json.JSONDecodeError, ValueError) as exc:
                    failures.append(
                        f"{model}, attempt {attempt + 1}: "
                        f"{type(exc).__name__}: {exc}"
                    )

                    if attempt + 1 < MAX_RETRIES_PER_MODEL:
                        time.sleep(min(2 ** attempt, 4))

    finally:
        client.close()

    summary = "; ".join(failures[-6:])
    raise AssessmentLLMError(
        "All configured models failed to generate valid JSON. "
        f"Recent failures: {summary or 'No response received.'}"
    )

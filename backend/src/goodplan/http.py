"""Chamadas HTTP das rotinas: novas tentativas quando a rede ou o servidor da fonte falham."""

import time
from collections.abc import Callable, Mapping, Sequence

import httpx2

SERVER_ERROR = 500
RETRY_DELAYS = (2.0, 5.0)
USER_AGENT = "GoodPlan/0.1 (+https://goodplan.jpaulos.dev)"

HttpFactory = Callable[[], httpx2.Client]


def default_http_factory() -> httpx2.Client:
    return httpx2.Client(headers={"User-Agent": USER_AGENT}, follow_redirects=True)


def get_with_retries(
    client: httpx2.Client,
    url: str,
    *,
    params: Mapping[str, str] | None = None,
    timeout: float,
    sleep: Callable[[float], None] = time.sleep,
    delays: Sequence[float] = RETRY_DELAYS,
) -> httpx2.Response:
    """GET com até len(delays) novas tentativas em erro de rede ou 5xx; 4xx falha na hora."""
    for attempt in range(len(delays) + 1):
        last = attempt == len(delays)
        try:
            response = client.get(url, params=params, timeout=timeout)
        except httpx2.TransportError:
            if last:
                raise
        else:
            if response.status_code < SERVER_ERROR or last:
                response.raise_for_status()
                return response
        sleep(delays[attempt])
    raise AssertionError("inalcançável: a última tentativa sempre devolve ou levanta")

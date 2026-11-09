import httpx2
import pytest

from goodplan.http import get_with_retries


def _client(statuses: list[int | Exception]) -> httpx2.Client:
    answers = iter(statuses)

    def handler(request: httpx2.Request) -> httpx2.Response:
        answer = next(answers)
        if isinstance(answer, Exception):
            raise answer
        return httpx2.Response(answer, json=[])

    return httpx2.Client(transport=httpx2.MockTransport(handler))


def test_retries_after_server_errors_then_succeeds():
    waits: list[float] = []
    with _client([503, 502, 200]) as client:
        response = get_with_retries(client, "https://x.test/a", timeout=1, sleep=waits.append)
    assert response.status_code == 200
    assert waits == [2.0, 5.0]


def test_gives_up_after_three_attempts():
    waits: list[float] = []
    with _client([503, 503, 503, 200]) as client, pytest.raises(httpx2.HTTPStatusError):
        get_with_retries(client, "https://x.test/a", timeout=1, sleep=waits.append)
    assert waits == [2.0, 5.0]


def test_network_error_is_retried():
    waits: list[float] = []
    with _client([httpx2.ConnectError("sem rede"), 200]) as client:
        response = get_with_retries(client, "https://x.test/a", timeout=1, sleep=waits.append)
    assert response.status_code == 200
    assert waits == [2.0]


def test_client_errors_are_not_retried():
    waits: list[float] = []
    with _client([404, 200]) as client, pytest.raises(httpx2.HTTPStatusError):
        get_with_retries(client, "https://x.test/a", timeout=1, sleep=waits.append)
    assert waits == []

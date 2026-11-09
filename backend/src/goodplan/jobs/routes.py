"""Rota interna das rotinas: chamada pelo agendador do Worker, com token próprio."""

from fastapi import APIRouter, Depends, Request

from goodplan.jobs.runner import run_due
from goodplan.schemas import JobResultOut, RunDueOut
from goodplan.security import require_jobs_token

router = APIRouter()


@router.post("/internal/jobs/run-due", dependencies=[Depends(require_jobs_token)])
def run_due_jobs(request: Request) -> RunDueOut:
    state = request.app.state
    results = run_due(state.sessionmaker, state.http_factory, state.settings, state.clock())
    return RunDueOut(jobs=[JobResultOut(job=r.job, status=r.status, detail=r.detail) for r in results])

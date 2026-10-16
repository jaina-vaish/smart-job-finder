from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.job_api import search_jobs

from app.database import (
    create_tables,
    save_jobs,
    search_stored_jobs,
    get_cache_time,
    update_cache_time,
    save_job,
    get_saved_jobs,
    remove_saved_job,
)


app = FastAPI(
    title="Smart Job Finder API",
    description="A smart job search platform for job seekers",
    version="1.0.0",
)


create_tables()


app.mount(
    "/static",
    StaticFiles(directory="static"),
    name="static",
)


@app.get("/")
def home():
    return FileResponse("static/index.html")


# ====================================
# SEARCH JOBS
# ====================================

@app.get("/jobs")
def get_jobs(
    role: str = Query(default=""),
    country: str = Query(default="IN"),
    city: str = Query(default=""),
    limit: int = Query(default=20, ge=1, le=50),
):
    safe_limit = min(limit, 20)

    cache_time = get_cache_time(
        role=role,
        country=country,
        city=city,
    )

    cache_is_fresh = False

    if cache_time:
        try:
            cached_at = datetime.fromisoformat(cache_time)

            if cached_at.tzinfo is None:
                cached_at = cached_at.replace(
                    tzinfo=timezone.utc
                )

            cache_age = (
                datetime.now(timezone.utc) - cached_at
            )

            cache_is_fresh = (
                cache_age < timedelta(minutes=10)
            )

        except ValueError:
            cache_is_fresh = False

    if cache_is_fresh:
        jobs = search_stored_jobs(
            role=role,
            city=city,
        )

        return {
            "success": True,
            "jobs": jobs[:safe_limit],
            "count": len(jobs[:safe_limit]),
            "source": "sqlite_cache",
            "cache_status": "fresh",
        }

    result = search_jobs(
        role=role,
        country=country,
        city=city,
        limit=safe_limit,
    )

    if result.get("success"):
        jobs = result.get("jobs", [])

        save_jobs(jobs)

        update_cache_time(
            role=role,
            country=country,
            city=city,
        )

        result["source"] = "job_api"
        result["cache_status"] = "refreshed"

    return result


# ====================================
# SAVE A JOB
# ====================================

@app.post("/saved-jobs/{job_id}")
def add_saved_job(job_id: str):
    result = save_job(job_id)

    if not result["success"]:
        raise HTTPException(
            status_code=404,
            detail=result["message"],
        )

    return result


# ====================================
# GET SAVED JOBS
# ====================================

@app.get("/saved-jobs")
def list_saved_jobs():
    jobs = get_saved_jobs()

    return {
        "success": True,
        "count": len(jobs),
        "jobs": jobs,
    }


# ====================================
# REMOVE A SAVED JOB
# ====================================

@app.delete("/saved-jobs/{job_id}")
def delete_saved_job(job_id: str):
    removed = remove_saved_job(job_id)

    if not removed:
        raise HTTPException(
            status_code=404,
            detail="Saved job not found.",
        )

    return {
        "success": True,
        "message": "Saved job removed successfully.",
    }
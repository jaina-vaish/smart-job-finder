from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.job_api import search_jobs
from app.database import (
    create_tables,
    save_jobs,
    search_stored_jobs
)


app = FastAPI(
    title="Smart Job Finder API",
    description="A smart job search platform for job seekers",
    version="1.0.0"
)


# Create SQLite database and tables
create_tables()


# Serve frontend files
app.mount(
    "/static",
    StaticFiles(directory="static"),
    name="static"
)


# Home page
@app.get("/")
def home():
    return FileResponse(
        "static/index.html"
    )


# Job search
@app.get("/jobs")
def get_jobs(
    role: str = Query(
        default=""
    ),
    country: str = Query(
        default="IN"
    ),
    city: str = Query(
        default=""
    ),
    limit: int = Query(
        default=20,
        ge=1,
        le=50
    )
):

    safe_limit = min(
        limit,
        20
    )


    # 1. Check recently stored jobs first
    stored_jobs = search_stored_jobs(
        role=role,
        city=city
    )


    # 2. If matching cached jobs exist,
    #    return them without calling the API
    if stored_jobs:

        return {
            "success": True,
            "total": len(stored_jobs),
            "source": "database",
            "filters": {
                "role": role,
                "country": country,
                "city": city
            },
            "jobs": stored_jobs[:safe_limit]
        }


    # 3. No suitable cached jobs.
    #    Call the external API.
    result = search_jobs(
        role=role,
        country=country,
        city=city,
        limit=safe_limit
    )


    # 4. Save newly fetched jobs into SQLite
    if result.get("success"):

        save_jobs(
            result.get(
                "jobs",
                []
            )
        )

        result["source"] = "api"


    return result
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta, timezone


DATABASE_PATH = Path("jobs.db")

CACHE_MINUTES = 60


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def create_tables():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            title TEXT,
            company TEXT,
            location TEXT,
            city TEXT,
            country TEXT,
            remote INTEGER,
            employment_type TEXT,
            seniority TEXT,
            experience_level TEXT,
            experience_band TEXT,
            posted_at TEXT,
            apply_url TEXT,
            source TEXT,
            source_type TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    connection.commit()
    connection.close()


def save_jobs(jobs):
    if not jobs:
        return

    connection = get_connection()
    cursor = connection.cursor()

    for job in jobs:
        cursor.execute(
            """
            INSERT INTO jobs (
                id,
                title,
                company,
                location,
                city,
                country,
                remote,
                employment_type,
                seniority,
                experience_level,
                experience_band,
                posted_at,
                apply_url,
                source,
                source_type
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

            ON CONFLICT(id)
            DO UPDATE SET
                title = excluded.title,
                company = excluded.company,
                location = excluded.location,
                city = excluded.city,
                country = excluded.country,
                remote = excluded.remote,
                employment_type = excluded.employment_type,
                seniority = excluded.seniority,
                experience_level = excluded.experience_level,
                experience_band = excluded.experience_band,
                posted_at = excluded.posted_at,
                apply_url = excluded.apply_url,
                source = excluded.source,
                source_type = excluded.source_type,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                job.get("id"),
                job.get("title"),
                job.get("company"),
                job.get("location"),
                job.get("city"),
                job.get("country"),
                1 if job.get("remote") else 0,
                job.get("employment_type"),
                job.get("seniority"),
                job.get("experience_level"),
                job.get("experience_band"),
                job.get("posted_at"),
                job.get("apply_url"),
                job.get("source"),
                job.get("source_type"),
            ),
        )

    connection.commit()
    connection.close()


def search_stored_jobs(role="", city=""):
    connection = get_connection()
    cursor = connection.cursor()

    cutoff = datetime.now(timezone.utc) - timedelta(
        minutes=CACHE_MINUTES
    )

    cutoff_string = cutoff.strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    query = """
        SELECT *
        FROM jobs
        WHERE updated_at >= ?
    """

    parameters = [cutoff_string]

    if role:
        query += """
            AND LOWER(title) LIKE LOWER(?)
        """
        parameters.append(f"%{role}%")

    if city:
        query += """
            AND LOWER(city) LIKE LOWER(?)
        """
        parameters.append(f"%{city}%")

    query += """
        ORDER BY posted_at DESC
    """

    cursor.execute(query, parameters)

    rows = cursor.fetchall()

    connection.close()

    return [dict(row) for row in rows]
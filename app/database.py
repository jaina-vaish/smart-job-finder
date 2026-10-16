import sqlite3
from pathlib import Path
from datetime import datetime, timezone


DATABASE_PATH = Path("jobs.db")


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def create_tables():
    connection = get_connection()
    cursor = connection.cursor()

    # Store jobs fetched from the external API.
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

    # Track when each search was last refreshed.
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS search_cache (
            cache_key TEXT PRIMARY KEY,
            role TEXT,
            country TEXT,
            city TEXT,
            last_fetched_at TEXT NOT NULL
        )
        """
    )

    # Store jobs explicitly saved by the user.
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS saved_jobs (
            job_id TEXT PRIMARY KEY,
            saved_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id)
                ON DELETE CASCADE
        )
        """
    )

    connection.commit()
    connection.close()


def save_jobs(jobs):
    if not jobs:
        return

    connection = get_connection()

    try:
        cursor = connection.cursor()

        for job in jobs:
            cursor.execute(
                """
                INSERT INTO jobs (
                    id, title, company, location, city, country,
                    remote, employment_type, seniority,
                    experience_level, experience_band, posted_at,
                    apply_url, source, source_type
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

    finally:
        connection.close()


def get_all_jobs():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT *
            FROM jobs
            ORDER BY posted_at DESC
            """
        )

        return [dict(row) for row in cursor.fetchall()]

    finally:
        connection.close()


def search_stored_jobs(role="", city=""):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        query = """
            SELECT *
            FROM jobs
            WHERE 1=1
        """

        parameters = []

        if role:
            query += " AND LOWER(title) LIKE LOWER(?)"
            parameters.append(f"%{role}%")

        if city:
            query += " AND LOWER(city) LIKE LOWER(?)"
            parameters.append(f"%{city}%")

        query += " ORDER BY posted_at DESC"

        cursor.execute(query, parameters)

        return [dict(row) for row in cursor.fetchall()]

    finally:
        connection.close()


def create_cache_key(role="", country="IN", city=""):
    role = role.strip().lower()
    country = country.strip().lower()
    city = city.strip().lower()

    return f"{role}|{country}|{city}"


def get_cache_time(role="", country="IN", city=""):
    cache_key = create_cache_key(role, country, city)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT last_fetched_at
            FROM search_cache
            WHERE cache_key = ?
            """,
            (cache_key,),
        )

        row = cursor.fetchone()

        return row["last_fetched_at"] if row else None

    finally:
        connection.close()


def update_cache_time(role="", country="IN", city=""):
    cache_key = create_cache_key(role, country, city)

    current_time = datetime.now(timezone.utc).isoformat()

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO search_cache (
                cache_key, role, country, city, last_fetched_at
            )
            VALUES (?, ?, ?, ?, ?)

            ON CONFLICT(cache_key)
            DO UPDATE SET
                role = excluded.role,
                country = excluded.country,
                city = excluded.city,
                last_fetched_at = excluded.last_fetched_at
            """,
            (
                cache_key,
                role,
                country,
                city,
                current_time,
            ),
        )

        connection.commit()

    finally:
        connection.close()


# ====================================
# SAVE JOBS FEATURE
# ====================================

def save_job(job_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # Only save jobs that exist in our jobs table.
        cursor.execute(
            "SELECT id FROM jobs WHERE id = ?",
            (job_id,),
        )

        if cursor.fetchone() is None:
            return {
                "success": False,
                "message": "Job not found. Search for the job again.",
            }

        cursor.execute(
            """
            INSERT OR IGNORE INTO saved_jobs (job_id)
            VALUES (?)
            """,
            (job_id,),
        )

        already_saved = cursor.rowcount == 0

        connection.commit()

        return {
            "success": True,
            "already_saved": already_saved,
            "message": (
                "Job already saved."
                if already_saved
                else "Job saved successfully."
            ),
        }

    finally:
        connection.close()


def get_saved_jobs():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT jobs.*, saved_jobs.saved_at
            FROM saved_jobs
            JOIN jobs ON jobs.id = saved_jobs.job_id
            ORDER BY saved_jobs.saved_at DESC
            """
        )

        return [dict(row) for row in cursor.fetchall()]

    finally:
        connection.close()


def remove_saved_job(job_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM saved_jobs
            WHERE job_id = ?
            """,
            (job_id,),
        )

        connection.commit()

        return cursor.rowcount > 0

    finally:
        connection.close()
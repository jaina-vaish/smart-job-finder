import os
import requests
import re
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

API_URL = "https://api.jobopportunitiesapi.org/v1/jobs"

API_KEY = os.getenv("JOB_API_KEY")

MAX_JOBS = 20


def parse_date(date_string):
    if not date_string:
        return datetime.min.replace(tzinfo=timezone.utc)

    try:
        return datetime.fromisoformat(
            date_string.replace("Z", "+00:00")
        )
    except (ValueError, TypeError):
        return datetime.min.replace(tzinfo=timezone.utc)


def get_experience_band(minimum, maximum):
    if minimum <= 1:
        return "0-1 years"

    if minimum <= 2:
        return "1-2 years"

    if minimum <= 5:
        return "2-5 years"

    return "5+ years"


def extract_experience(description):
    if not description:
        return {
            "raw": "Not specified",
            "band": "Not specified"
        }

    text = description.lower()

    # Examples: 1-2 years, 2–5 years
    range_patterns = [
        r"(\d+)\s*[-–]\s*(\d+)\s*years?",
        r"(\d+)\s*to\s*(\d+)\s*years?"
    ]

    for pattern in range_patterns:
        match = re.search(pattern, text)

        if match:
            minimum = int(match.group(1))
            maximum = int(match.group(2))

            return {
                "raw": f"{minimum}-{maximum} years",
                "band": get_experience_band(minimum, maximum)
            }

    # Examples: 2+ years, 3 or more years
    plus_patterns = [
        r"(\d+)\s*\+\s*years?",
        r"(\d+)\s*or\s*more\s*years?"
    ]

    for pattern in plus_patterns:
        match = re.search(pattern, text)

        if match:
            minimum = int(match.group(1))

            return {
                "raw": f"{minimum}+ years",
                "band": get_experience_band(minimum, None)
            }

    # Examples: minimum of 2 years, at least 2 years
    minimum_patterns = [
        r"minimum\s+of\s+(\d+)\s*years?",
        r"at\s+least\s+(\d+)\s*years?"
    ]

    for pattern in minimum_patterns:
        match = re.search(pattern, text)

        if match:
            minimum = int(match.group(1))

            return {
                "raw": f"{minimum}+ years",
                "band": get_experience_band(minimum, None)
            }

    # Example: 2 years experience
    single_pattern = r"(\d+)\s*years?\s+(?:of\s+)?experience"

    match = re.search(single_pattern, text)

    if match:
        years = int(match.group(1))

        return {
            "raw": f"{years} years",
            "band": get_experience_band(years, years)
        }

    # Entry-level phrases
    entry_patterns = [
        "no experience required",
        "no prior experience",
        "fresh graduate",
        "recent graduate",
        "entry level",
        "entry-level",
        "0 years experience"
    ]

    for phrase in entry_patterns:
        if phrase in text:
            return {
                "raw": "Entry Level",
                "band": "0-1 years"
            }

    return {
        "raw": "Not specified",
        "band": "Not specified"
    }


def get_job_description(job_id):
    """
    Fetch the full job description.

    This is kept separate because the listing response may only
    tell us whether a description exists.
    """

    if not job_id or not API_KEY:
        return None

    url = f"https://api.jobopportunitiesapi.org/v1/jobs/{job_id}"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Accept": "application/json"
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            timeout=15
        )

        if response.status_code == 401:
            return None

        if response.status_code == 429:
            return None

        response.raise_for_status()

        data = response.json()

        job = data.get("data", data)

        return job.get("description")

    except (
        requests.exceptions.RequestException,
        ValueError
    ):
        return None


def search_jobs(role="", country="IN", city="", limit=20):

    if not API_KEY:
        return {
            "success": False,
            "error": "JOB_API_KEY is missing from the .env file.",
            "jobs": []
        }

    limit = min(limit, MAX_JOBS)

    params = {
        "country": country,
        "limit": limit
    }

    if role:
        params["title"] = role

    if city:
        params["city"] = city

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Accept": "application/json"
    }

    try:

        response = requests.get(
            API_URL,
            params=params,
            headers=headers,
            timeout=20
        )

        # Authentication error
        if response.status_code == 401:
            return {
                "success": False,
                "error": (
                    "API authentication failed. "
                    "Please check the API key in your .env file."
                ),
                "jobs": []
            }

        # Rate limit
        if response.status_code == 429:
            retry_after = response.headers.get(
                "Retry-After",
                "a short while"
            )

            return {
                "success": False,
                "error": (
                    f"The job provider is rate-limiting requests. "
                    f"Please wait {retry_after} seconds and try again."
                ),
                "jobs": []
            }

        response.raise_for_status()

        data = response.json()

        jobs = data.get("data", [])

        results = []

        seen_ids = set()

        for job in jobs:

            job_id = job.get("id")

            if job_id in seen_ids:
                continue

            seen_ids.add(job_id)

            description = None

            if job.get("has_description"):
                description = get_job_description(job_id)

            experience = extract_experience(description)

            results.append({
                "id": job_id,
                "title": job.get("title"),
                "company": job.get("company"),
                "location": job.get("location"),
                "city": job.get("city"),
                "country": job.get("country"),
                "remote": job.get("remote"),
                "employment_type": job.get("employment_type"),
                "seniority": job.get("seniority"),
                "experience_level": experience["raw"],
                "experience_band": experience["band"],
                "posted_at": job.get("posted_at"),
                "apply_url": job.get("apply_url"),
                "source": job.get("source"),
                "source_type": job.get("source_type")
            })

        # Newest jobs first
        results.sort(
            key=lambda job: parse_date(
                job.get("posted_at")
            ),
            reverse=True
        )

        return {
            "success": True,
            "total": len(results),
            "filters": {
                "role": role,
                "country": country,
                "city": city
            },
            "jobs": results
        }

    except requests.exceptions.Timeout:

        return {
            "success": False,
            "error": "Job API request timed out.",
            "jobs": []
        }

    except requests.exceptions.RequestException as e:

        return {
            "success": False,
            "error": f"Job API request failed: {str(e)}",
            "jobs": []
        }

    except ValueError:

        return {
            "success": False,
            "error": "Job API returned invalid JSON.",
            "jobs": []
        }
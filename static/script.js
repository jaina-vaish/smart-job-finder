const roleInput = document.getElementById("role");
const cityInput = document.getElementById("city");
const experienceFilter = document.getElementById("experience");
const postedFilter = document.getElementById("posted");

const searchButton = document.getElementById("searchButton");
const resetButton = document.getElementById("resetButton");

const jobsContainer = document.getElementById("jobsContainer");
const loading = document.getElementById("loading");
const error = document.getElementById("error");
const errorText = document.getElementById("errorText");
const empty = document.getElementById("empty");
const resultsText = document.getElementById("resultsText");
const sourceStatus = document.getElementById("sourceStatus");

const searchSection = document.getElementById("searchSection");
const savedJobsSection = document.getElementById("savedJobsSection");
const savedJobsButton = document.getElementById("savedJobsButton");
const savedCount = document.getElementById("savedCount");
const backToSearchButton = document.getElementById("backToSearchButton");
const savedJobsContainer = document.getElementById("savedJobsContainer");
const savedJobsText = document.getElementById("savedJobsText");
const savedLoading = document.getElementById("savedLoading");
const savedError = document.getElementById("savedError");
const savedErrorText = document.getElementById("savedErrorText");
const savedEmpty = document.getElementById("savedEmpty");

let allJobs = [];
let currentSource = "";
let savedJobIds = new Set();


/* =========================
   SEARCH JOBS
========================= */

async function searchJobs() {
    const role = roleInput.value.trim();
    const city = cityInput.value.trim();

    showLoading();

    try {
        const params = new URLSearchParams();

        if (role) {
            params.append("role", role);
        }

        if (city) {
            params.append("city", city);
        }

        params.append("country", "IN");
        params.append("limit", "20");

        const response = await fetch(`/jobs?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || "Unable to fetch jobs.");
        }

        allJobs = data.jobs || [];
        currentSource = data.source || "";

        updateSourceStatus();
        hideLoading();

        applyFilters();
        await refreshSavedJobIds();
    } catch (err) {
        console.error(err);
        showError(err.message || "Unable to connect to the job server.");
    }
}


/* =========================
   CACHE SOURCE STATUS
========================= */

function updateSourceStatus() {
    if (!sourceStatus) {
        return;
    }

    sourceStatus.classList.remove("hidden");

    if (currentSource === "sqlite_cache") {
        sourceStatus.textContent = "✓ Results served from SQLite cache";
        sourceStatus.classList.remove("api-source");
        sourceStatus.classList.add("cache-source");
    } else if (currentSource === "job_api") {
        sourceStatus.textContent = "↻ Fresh results fetched from Job API";
        sourceStatus.classList.remove("cache-source");
        sourceStatus.classList.add("api-source");
    } else {
        sourceStatus.textContent = "";
        sourceStatus.classList.add("hidden");
    }
}


/* =========================
   APPLY FILTERS
========================= */

function applyFilters() {
    const selectedExperience = experienceFilter.value;
    const selectedPosted = postedFilter.value;

    let filteredJobs = [...allJobs];

    if (selectedExperience === "entry") {
        filteredJobs = filteredJobs.filter(
            job => job.experience_band === "0-1 years"
        );
    } else if (selectedExperience === "specified") {
        filteredJobs = filteredJobs.filter(
            job =>
                job.experience_band &&
                job.experience_band !== "Not specified"
        );
    } else if (selectedExperience === "unknown") {
        filteredJobs = filteredJobs.filter(
            job =>
                !job.experience_band ||
                job.experience_band === "Not specified"
        );
    }

    if (selectedPosted !== "all") {
        const now = new Date();
        let milliseconds = 0;

        if (selectedPosted === "24h") {
            milliseconds = 24 * 60 * 60 * 1000;
        } else if (selectedPosted === "7d") {
            milliseconds = 7 * 24 * 60 * 60 * 1000;
        } else if (selectedPosted === "30d") {
            milliseconds = 30 * 24 * 60 * 60 * 1000;
        }

        filteredJobs = filteredJobs.filter(job => {
            if (!job.posted_at) {
                return false;
            }

            const postedDate = new Date(job.posted_at);

            if (isNaN(postedDate.getTime())) {
                return false;
            }

            const age = now - postedDate;

            return age >= 0 && age <= milliseconds;
        });
    }

    renderJobs(filteredJobs);
}


/* =========================
   RENDER SEARCH RESULTS
========================= */

function renderJobs(jobs) {
    jobsContainer.innerHTML = "";

    if (jobs.length === 0) {
        empty.classList.remove("hidden");
        resultsText.textContent = "No jobs match your current filters.";
        return;
    }

    empty.classList.add("hidden");

    resultsText.textContent =
        `${jobs.length} job${jobs.length === 1 ? "" : "s"} found`;

    jobs.forEach(job => {
        jobsContainer.appendChild(createJobCard(job, false));
    });
}


/* =========================
   CREATE JOB CARD
========================= */

function createJobCard(job, isSavedView = false) {
    const card = document.createElement("article");
    card.className = "job-card";

    const title = escapeHTML(job.title || "Job Opportunity");
    const company = escapeHTML(job.company || "Company not specified");
    const location = escapeHTML(
        job.location || job.city || "Location not specified"
    );
    const employment = escapeHTML(job.employment_type || "Not specified");
    const experienceBand = escapeHTML(job.experience_band || "Not specified");
    const rawExperience = escapeHTML(
        job.experience_level || "Not specified"
    );
    const seniority = escapeHTML(job.seniority || "Not specified");
    const source = escapeHTML(job.source || "Job Source");
    const posted = formatDate(job.posted_at);

    // The API may provide "on_site", "remote", or a boolean.
    const remoteValue = String(job.remote ?? "").toLowerCase();
    let workMode = "Not specified";

    if (
        job.remote === true ||
        remoteValue === "remote" ||
        remoteValue === "true" ||
        remoteValue === "1"
    ) {
        workMode = "Remote";
    } else if (
        job.remote === false ||
        remoteValue === "on_site" ||
        remoteValue === "onsite" ||
        remoteValue === "false" ||
        remoteValue === "0"
    ) {
        workMode = "On-site";
    } else if (remoteValue === "hybrid") {
        workMode = "Hybrid";
    }

    const applyUrl = safeApplyUrl(job.apply_url);

    let experienceHTML = `Experience: <strong>${experienceBand}</strong>`;

    if (
        rawExperience !== experienceBand &&
        rawExperience !== "Not specified"
    ) {
        experienceHTML += `
            <span class="raw-experience">(${rawExperience})</span>
        `;
    }

    const isSaved = savedJobIds.has(String(job.id));

    const actionButton = isSavedView
        ? `
            <button
                class="remove-saved-button"
                data-job-id="${escapeHTML(job.id)}"
                type="button"
            >
                Remove
            </button>
        `
        : `
            <button
                class="save-button"
                data-job-id="${escapeHTML(job.id)}"
                type="button"
                ${isSaved ? "disabled" : ""}
            >
                ${isSaved ? "✓ Saved" : "♡ Save Job"}
            </button>
        `;

    card.innerHTML = `
        <div class="job-top">
            <div>
                <h3 class="job-title">${title}</h3>
                <p class="company">${company}</p>
            </div>
            <span class="source-badge">${source}</span>
        </div>

        <div class="job-details">
            <div class="detail">
                <span class="detail-label">Location</span>
                <span class="detail-value">${location}</span>
            </div>

            <div class="detail">
                <span class="detail-label">Work Type</span>
                <span class="detail-value">${employment}</span>
            </div>

            <div class="detail">
                <span class="detail-label">Work Mode</span>
                <span class="detail-value">${workMode}</span>
            </div>

            <div class="detail">
                <span class="detail-label">Seniority Signal</span>
                <span class="detail-value">${seniority}</span>
            </div>
        </div>

        <div class="experience">${experienceHTML}</div>

        <div class="job-footer">
            <span class="posted">Posted: ${posted}</span>

            <div class="job-actions">
                ${actionButton}

                ${
                    applyUrl
                        ? `
                            <a
                                href="${escapeHTML(applyUrl)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="apply-button"
                            >
                                Apply Now →
                            </a>
                        `
                        : ""
                }
            </div>
        </div>
    `;

    return card;
}


/* =========================
   SAVE A JOB
========================= */

async function saveJob(jobId, button) {
    if (!jobId || !button) {
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const response = await fetch(
            `/saved-jobs/${encodeURIComponent(jobId)}`,
            { method: "POST" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.detail || data.message || "Unable to save this job."
            );
        }

        savedJobIds.add(String(jobId));

        button.textContent = "✓ Saved";
        button.disabled = true;

        await refreshSavedJobCount();
    } catch (err) {
        console.error(err);
        alert(err.message || "Unable to save this job.");
        button.textContent = "♡ Save Job";
        button.disabled = false;
    }
}


/* =========================
   LOAD SAVED JOBS
========================= */

async function loadSavedJobs() {
    savedLoading.classList.remove("hidden");
    savedError.classList.add("hidden");
    savedEmpty.classList.add("hidden");
    savedJobsContainer.innerHTML = "";

    try {
        const response = await fetch("/saved-jobs");

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error("Unable to load saved jobs.");
        }

        const jobs = data.jobs || [];

        savedJobIds = new Set(
            jobs.map(job => String(job.id))
        );

        savedCount.textContent = String(jobs.length);
        savedJobsText.textContent =
            `${jobs.length} saved job${jobs.length === 1 ? "" : "s"}`;

        if (jobs.length === 0) {
            savedEmpty.classList.remove("hidden");
        } else {
            jobs.forEach(job => {
                savedJobsContainer.appendChild(
                    createJobCard(job, true)
                );
            });
        }
    } catch (err) {
        console.error(err);
        savedErrorText.textContent =
            err.message || "Unable to load saved jobs.";
        savedError.classList.remove("hidden");
    } finally {
        savedLoading.classList.add("hidden");
    }
}


/* =========================
   REFRESH SAVED JOB COUNT
========================= */

async function refreshSavedJobCount() {
    try {
        const response = await fetch("/saved-jobs");

        if (!response.ok) {
            throw new Error("Unable to refresh saved-job count.");
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error("Unable to refresh saved-job count.");
        }

        const jobs = data.jobs || [];

        savedJobIds = new Set(
            jobs.map(job => String(job.id))
        );

        savedCount.textContent = String(jobs.length);
        return jobs;
    } catch (err) {
        console.error(err);
        return null;
    }
}


/* =========================
   REFRESH SAVED JOB IDS
========================= */

async function refreshSavedJobIds() {
    const jobs = await refreshSavedJobCount();

    if (jobs === null) {
        return;
    }

    // Refresh buttons after the saved status is known.
    applyFilters();
}


/* =========================
   REMOVE A SAVED JOB
========================= */

async function removeSavedJob(jobId, button) {
    if (!jobId || !button) {
        return;
    }

    button.disabled = true;
    button.textContent = "Removing...";

    try {
        const response = await fetch(
            `/saved-jobs/${encodeURIComponent(jobId)}`,
            { method: "DELETE" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.detail || data.message || "Unable to remove this job."
            );
        }

        savedJobIds.delete(String(jobId));

        await loadSavedJobs();
        applyFilters();
    } catch (err) {
        console.error(err);
        alert(err.message || "Unable to remove this job.");
        button.textContent = "Remove";
        button.disabled = false;
    }
}


/* =========================
   SAVED JOBS VIEW
========================= */

async function showSavedJobs() {
    searchSection.classList.add("hidden");
    savedJobsSection.classList.remove("hidden");

    await loadSavedJobs();
}


function showSearchJobs() {
    savedJobsSection.classList.add("hidden");
    searchSection.classList.remove("hidden");
}


/* =========================
   DATE FORMAT
========================= */

function formatDate(dateString) {
    if (!dateString) {
        return "Not specified";
    }

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
        return "Not specified";
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}


/* =========================
   SAFE APPLY URL
========================= */

function safeApplyUrl(value) {
    if (!value) {
        return "";
    }

    try {
        const url = new URL(value);

        if (url.protocol === "https:" || url.protocol === "http:") {
            return url.href;
        }
    } catch {
        return "";
    }

    return "";
}


/* =========================
   HTML SAFETY
========================= */

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}


/* =========================
   LOADING AND ERROR STATES
========================= */

function showLoading() {
    loading.classList.remove("hidden");
    error.classList.add("hidden");
    empty.classList.add("hidden");

    jobsContainer.innerHTML = "";
    resultsText.textContent = "Searching for jobs...";

    if (sourceStatus) {
        sourceStatus.classList.add("hidden");
    }
}


function hideLoading() {
    loading.classList.add("hidden");
}


function showError(message) {
    loading.classList.add("hidden");
    empty.classList.add("hidden");

    jobsContainer.innerHTML = "";
    error.classList.remove("hidden");

    errorText.textContent = message;
    resultsText.textContent = "Unable to load jobs.";

    if (sourceStatus) {
        sourceStatus.classList.add("hidden");
    }
}


/* =========================
   RESET SEARCH
========================= */

function resetSearch() {
    roleInput.value = "";
    cityInput.value = "";
    experienceFilter.value = "all";
    postedFilter.value = "all";

    allJobs = [];
    currentSource = "";

    jobsContainer.innerHTML = "";

    error.classList.add("hidden");
    empty.classList.add("hidden");
    loading.classList.add("hidden");

    resultsText.textContent = "Search for jobs to get started.";

    if (sourceStatus) {
        sourceStatus.textContent = "";
        sourceStatus.classList.add("hidden");
    }
}


/* =========================
   EVENT LISTENERS
========================= */

searchButton.addEventListener("click", searchJobs);
resetButton.addEventListener("click", resetSearch);

experienceFilter.addEventListener("change", applyFilters);
postedFilter.addEventListener("change", applyFilters);

savedJobsButton.addEventListener("click", showSavedJobs);
backToSearchButton.addEventListener("click", showSearchJobs);


/* Use event delegation for buttons in dynamically rendered job cards. */

jobsContainer.addEventListener("click", event => {
    const button = event.target.closest(".save-button");

    if (button) {
        saveJob(button.dataset.jobId, button);
    }
});


savedJobsContainer.addEventListener("click", event => {
    const button = event.target.closest(".remove-saved-button");

    if (button) {
        removeSavedJob(button.dataset.jobId, button);
    }
});


/* =========================
   ENTER KEY
========================= */

roleInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        searchJobs();
    }
});

cityInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        searchJobs();
    }
});


/* Load the saved-job count when the page opens. */

refreshSavedJobCount();
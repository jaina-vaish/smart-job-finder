const roleInput =
    document.getElementById("role");

const cityInput =
    document.getElementById("city");

const experienceFilter =
    document.getElementById("experience");

const postedFilter =
    document.getElementById("posted");

const searchButton =
    document.getElementById("searchButton");

const resetButton =
    document.getElementById("resetButton");

const jobsContainer =
    document.getElementById("jobsContainer");

const loading =
    document.getElementById("loading");

const error =
    document.getElementById("error");

const errorText =
    document.getElementById("errorText");

const empty =
    document.getElementById("empty");

const resultsText =
    document.getElementById("resultsText");


let allJobs = [];


/* =========================
   SEARCH JOBS
========================= */

async function searchJobs() {

    const role =
        roleInput.value.trim();

    const city =
        cityInput.value.trim();


    showLoading();


    try {

        const params =
            new URLSearchParams();


        if (role) {

            params.append(
                "role",
                role
            );

        }


        if (city) {

            params.append(
                "city",
                city
            );

        }


        params.append(
            "country",
            "IN"
        );


        // IMPORTANT:
        // Backend currently accepts maximum 20 jobs.
        params.append(
            "limit",
            "20"
        );


        const response =
            await fetch(
                `/jobs?${params.toString()}`
            );


        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );

        }


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.error ||
                "Unable to fetch jobs."
            );

        }


        allJobs =
            data.jobs || [];


        hideLoading();


        applyFilters();

    }


    catch (err) {

        console.error(err);


        showError(
            err.message ||
            "Unable to connect to the job server."
        );

    }

}



/* =========================
   APPLY FILTERS
========================= */

function applyFilters() {

    const selectedExperience =
        experienceFilter.value;

    const selectedPosted =
        postedFilter.value;


    let filteredJobs =
        [...allJobs];


    /* =========================
       EXPERIENCE FILTER
    ========================= */

    if (
        selectedExperience ===
        "entry"
    ) {

        filteredJobs =
            filteredJobs.filter(
                job =>
                    job.experience_band ===
                    "0-1 years"
            );

    }


    else if (
        selectedExperience ===
        "specified"
    ) {

        filteredJobs =
            filteredJobs.filter(
                job =>
                    job.experience_band &&
                    job.experience_band !==
                    "Not specified"
            );

    }


    else if (
        selectedExperience ===
        "unknown"
    ) {

        filteredJobs =
            filteredJobs.filter(
                job =>
                    !job.experience_band ||
                    job.experience_band ===
                    "Not specified"
            );

    }



    /* =========================
       POSTED DATE FILTER
    ========================= */

    if (
        selectedPosted !==
        "all"
    ) {

        const now =
            new Date();


        let milliseconds = 0;


        if (
            selectedPosted ===
            "24h"
        ) {

            milliseconds =
                24 *
                60 *
                60 *
                1000;

        }


        else if (
            selectedPosted ===
            "7d"
        ) {

            milliseconds =
                7 *
                24 *
                60 *
                60 *
                1000;

        }


        else if (
            selectedPosted ===
            "30d"
        ) {

            milliseconds =
                30 *
                24 *
                60 *
                60 *
                1000;

        }


        filteredJobs =
            filteredJobs.filter(
                job => {

                    if (
                        !job.posted_at
                    ) {

                        return false;

                    }


                    const postedDate =
                        new Date(
                            job.posted_at
                        );


                    if (
                        isNaN(
                            postedDate.getTime()
                        )
                    ) {

                        return false;

                    }


                    const age =
                        now -
                        postedDate;


                    return (
                        age >= 0 &&
                        age <= milliseconds
                    );

                }
            );

    }


    renderJobs(
        filteredJobs
    );

}



/* =========================
   RENDER JOBS
========================= */

function renderJobs(
    jobs
) {

    jobsContainer.innerHTML =
        "";


    if (
        jobs.length === 0
    ) {

        empty.classList.remove(
            "hidden"
        );


        resultsText.textContent =
            "No jobs match your current filters.";


        return;

    }


    empty.classList.add(
        "hidden"
    );


    resultsText.textContent =
        `${jobs.length} job${
            jobs.length === 1
                ? ""
                : "s"
        } found`;


    jobs.forEach(
        job => {

            const card =
                createJobCard(
                    job
                );


            jobsContainer.appendChild(
                card
            );

        }
    );

}



/* =========================
   CREATE JOB CARD
========================= */

function createJobCard(
    job
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "job-card";


    const title =
        escapeHTML(
            job.title ||
            "Job Opportunity"
        );


    const company =
        escapeHTML(
            job.company ||
            "Company not specified"
        );


    const location =
        escapeHTML(
            job.location ||
            job.city ||
            "Location not specified"
        );


    const employment =
        escapeHTML(
            job.employment_type ||
            "Not specified"
        );


    const experienceBand =
        escapeHTML(
            job.experience_band ||
            "Not specified"
        );


    const rawExperience =
        escapeHTML(
            job.experience_level ||
            "Not specified"
        );


    const seniority =
        escapeHTML(
            job.seniority ||
            "Not specified"
        );


    const source =
        escapeHTML(
            job.source ||
            "Job Source"
        );


    const posted =
        formatDate(
            job.posted_at
        );


    const remote =
        job.remote
            ? "Remote"
            : "On-site / Hybrid";


    const applyUrl =
        job.apply_url ||
        "#";


    let experienceHTML = `
        Experience:
        <strong>
            ${experienceBand}
        </strong>
    `;


    if (
        rawExperience !==
        experienceBand &&
        rawExperience !==
        "Not specified"
    ) {

        experienceHTML += `
            <span class="raw-experience">
                (${rawExperience})
            </span>
        `;

    }


    card.innerHTML = `

        <div class="job-top">

            <div>

                <h3 class="job-title">
                    ${title}
                </h3>

                <p class="company">
                    ${company}
                </p>

            </div>


            <span class="source-badge">
                ${source}
            </span>

        </div>


        <div class="job-details">


            <div class="detail">

                <span class="detail-label">
                    Location
                </span>

                <span class="detail-value">
                    ${location}
                </span>

            </div>


            <div class="detail">

                <span class="detail-label">
                    Work Type
                </span>

                <span class="detail-value">
                    ${employment}
                </span>

            </div>


            <div class="detail">

                <span class="detail-label">
                    Work Mode
                </span>

                <span class="detail-value">
                    ${remote}
                </span>

            </div>


            <div class="detail">

                <span class="detail-label">
                    Seniority Signal
                </span>

                <span class="detail-value">
                    ${seniority}
                </span>

            </div>


        </div>


        <div class="experience">

            ${experienceHTML}

        </div>


        <div class="job-footer">

            <span class="posted">

                Posted:
                ${posted}

            </span>


            <a
                href="${applyUrl}"
                target="_blank"
                rel="noopener noreferrer"
                class="apply-button"
            >
                Apply Now →
            </a>

        </div>

    `;


    return card;

}



/* =========================
   DATE FORMAT
========================= */

function formatDate(
    dateString
) {

    if (!dateString) {

        return "Not specified";

    }


    const date =
        new Date(
            dateString
        );


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return "Not specified";

    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );

}



/* =========================
   HTML SAFETY
========================= */

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(value);


    return div.innerHTML;

}



/* =========================
   LOADING
========================= */

function showLoading() {

    loading.classList.remove(
        "hidden"
    );


    error.classList.add(
        "hidden"
    );


    empty.classList.add(
        "hidden"
    );


    jobsContainer.innerHTML =
        "";


    resultsText.textContent =
        "Searching for jobs...";

}


function hideLoading() {

    loading.classList.add(
        "hidden"
    );

}



/* =========================
   ERROR
========================= */

function showError(
    message
) {

    loading.classList.add(
        "hidden"
    );


    empty.classList.add(
        "hidden"
    );


    jobsContainer.innerHTML =
        "";


    error.classList.remove(
        "hidden"
    );


    errorText.textContent =
        message;


    resultsText.textContent =
        "Unable to load jobs.";

}



/* =========================
   RESET
========================= */

function resetSearch() {

    roleInput.value =
        "";

    cityInput.value =
        "";

    experienceFilter.value =
        "all";

    postedFilter.value =
        "all";

    allJobs = [];

    jobsContainer.innerHTML =
        "";

    error.classList.add(
        "hidden"
    );

    empty.classList.add(
        "hidden"
    );

    resultsText.textContent =
        "Search for jobs to get started.";

}



/* =========================
   EVENT LISTENERS
========================= */

searchButton.addEventListener(
    "click",
    searchJobs
);


resetButton.addEventListener(
    "click",
    resetSearch
);


experienceFilter.addEventListener(
    "change",
    applyFilters
);


postedFilter.addEventListener(
    "change",
    applyFilters
);



/* =========================
   ENTER KEY
========================= */

roleInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter"
        ) {

            searchJobs();

        }

    }
);


cityInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter"
        ) {

            searchJobs();

        }

    }
);
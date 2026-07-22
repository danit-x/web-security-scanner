# 🛡️ Website Security Scanner

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)
![Status](https://img.shields.io/badge/Status-University%20Project-blue)

A full-stack MERN application that scans a user-submitted website URL for common security misconfigurations and returns a graded report with plain-language explanations and fix recommendations.


## Table of Contents

- [Overview](#overview)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [Security Checks Implemented](#security-checks-implemented)
- [Scoring Methodology](#scoring-methodology)
- [Responsible Use & Ethical Considerations](#responsible-use--ethical-considerations)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Many websites today are built quickly with the help of AI code generation tools ("vibe coding"). These sites often work correctly but skip basic security hygiene — missing security headers, exposed configuration files, outdated JavaScript libraries, and misconfigured cookies are common issues.

This project lets a site owner paste their URL, run a **passive, non-intrusive security scan**, and receive:

- A letter grade (A–F) summarizing overall security posture
- A categorized list of findings with severity ratings
- Plain-language explanations and recommended fixes for each issue
- A saved history of past scans, tied to a user account

The scanner performs **inspection only** — it does not attempt to exploit vulnerabilities, brute-force anything, or perform any active attack. It is intended as an educational/awareness tool.

## Screenshots

**Login / Register**

<img width="1622" height="887" alt="image" src="https://github.com/user-attachments/assets/d4063549-a734-49a3-bff9-844d2083502e" />
<img width="1650" height="827" alt="image" src="https://github.com/user-attachments/assets/957412d4-dfd6-45a9-957a-88ed11d675e5" />



**Dashboard — URL Scan Input**

`[ screenshot placeholder ]`

**Scan Report — Grade & Findings**

`[ screenshot placeholder ]`

**Scan History**

`[ screenshot placeholder ]`

## Tech Stack

**Frontend:** React (Vite), React Router, Axios
**Backend:** Node.js, Express
**Database:** MongoDB with Mongoose
**Auth:** JSON Web Tokens (JWT), bcrypt
**Scanning Engine:** Axios (HTTP requests), Cheerio (HTML parsing), Node `tls` module (SSL/TLS inspection), semver (version comparison)
**Security Middleware:** Helmet, express-rate-limit, CORS

## Features

- User authentication (register/login) with hashed passwords and JWT sessions
- Passive security scan across six categories (see below)
- Automated A–F grading with a transparent, documented scoring model
- Full scan history per user account
- Rate limiting and SSRF protection on the scan endpoint
- Responsive UI, usable on desktop and mobile

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm
- A [MongoDB Atlas](https://www.mongodb.com/atlas) account (or a local MongoDB instance)

### Installation

Clone the repository:

```bash
git clone https://github.com/danit-x/web-security-scanner.git
cd web-security-scanner
```

Install backend dependencies:

```bash
cd server
npm install
```

Install frontend dependencies:

```bash
cd ../client
npm install
```

### Environment Variables

Create a `.env` file inside `server/` with the following:

| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the backend runs on | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key used to sign JWTs | `your_secret_key` |
| `JWT_EXPIRES_IN` | Token expiry duration | `7d` |

Create a `.env` file inside `client/` with the following:

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Base URL of the backend API | `http://localhost:5000/api` |

> ⚠️ Never commit `.env` files. Both are already excluded via `.gitignore`.

### Running the App

Start the backend (from `server/`):

```bash
npm run dev
```

Start the frontend (from `client/`):

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173` and will communicate with the backend at the URL set in `VITE_API_URL`.

**Production build:**

```bash
cd client
npm run build
```

## Security Checks Implemented

All checks are **passive** — they inspect what a normal browser request would already receive, without attempting to exploit, brute-force, or bypass anything.

| Check | What it does |
|---|---|
| **Security Headers** | Verifies presence of key HTTP security headers: `Content-Security-Policy`, `Strict-Transport-Security` (HSTS), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. |
| **SSL/TLS** | Confirms the site uses HTTPS and inspects the certificate for expiry and basic configuration issues. Flags HTTP-only sites as high severity. |
| **Exposed Sensitive Files** | Checks common sensitive paths (e.g. `.env`, `.git/config`, backup files) for accidental public accessibility. |
| **Cookie Flags** | Parses `Set-Cookie` headers and checks for `Secure`, `HttpOnly`, and `SameSite` attributes. |
| **Mixed Content** | Scans the page HTML for resources loaded over plain HTTP on an HTTPS page. |
| **Outdated JavaScript Libraries** | Extracts library names/versions from `<script>` tags and compares them against a reference list of known-vulnerable versions. |

Each finding follows a consistent structure:

```json
{
  "category": "Headers",
  "severity": "medium",
  "description": "Missing Content-Security-Policy header.",
  "recommendation": "Add a CSP header to restrict which sources of content the browser is allowed to load."
}
```

## Scoring Methodology

Every scan starts at a baseline of **100 points**. Points are deducted per finding based on severity:

| Severity | Points Deducted | Rationale |
|---|---|---|
| High | -15 | Directly exploitable or high-impact risk (e.g. exposed `.env`, no HTTPS) |
| Medium | -8 | Meaningful weakness that raises risk but isn't immediately exploitable alone |
| Low | -3 | Best-practice gap with limited direct impact |

The final score is clamped between 0–100 and mapped to a letter grade:

| Score Range | Grade |
|---|---|
| 90–100 | A |
| 75–89 | B |
| 60–74 | C |
| 40–59 | D |
| Below 40 | F |

This weighting ensures a small number of severe issues affect the grade more than several minor gaps, while the cumulative effect of many small issues can still meaningfully lower a score.

## Responsible Use & Ethical Considerations

- **Ownership Disclaimer** — users must confirm they own or have permission to scan the target site before a scan is allowed to run.
- **SSRF Protection** — the backend rejects scan requests targeting `localhost`, `127.0.0.1`, and private/internal IP ranges.
- **Rate Limiting** — the scan endpoint is rate-limited per user to prevent abuse and avoid overwhelming target servers.
- **No Active Exploitation** — the scanner strictly inspects; it never attempts to exploit, inject payloads into, or bypass authentication on a target site.
- **Secure-by-Example** — the backend applies the same practices it checks for (Helmet, restricted CORS, hashed passwords, JWT auth).

## Known Limitations

These are intentional scope decisions, not oversights:

- **Bundled/Minified JavaScript** — the library check only detects libraries loaded via a visible `<script src>` with a version in the filename/URL; bundled JS with no exposed version isn't detectable.
- **Static Vulnerability Reference Data** — the vulnerable library list is a static, manually curated file rather than a live CVE database connection.
- **TLS Check Depth** — the SSL/TLS check covers certificate presence, validity, and expiry, not full protocol/cipher suite analysis.
- **Passive Scanning Only** — no active penetration testing or authenticated scanning is performed, by design.
- **Bot Detection / Firewalls** — some sites may block automated requests (WAFs, bot protection), resulting in incomplete results.

## Roadmap

Potential future improvements, not currently implemented:

- [ ] PDF export of scan reports
- [ ] Live CVE database integration
- [ ] CORS misconfiguration and server info leakage checks
- [ ] Scheduled/recurring scans with email alerts

## License

This project is licensed under the [MIT License](LICENSE).

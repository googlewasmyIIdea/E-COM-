<!-- txt -->
# Project Harness
- **Backend:** Python, FastAPI. Use strictly typed Pydantic models. 
- **Frontend:** Next.js (App Router), React, Tailwind. Use functional components.
- **Rules:** Never use `any` types. Always write unit tests before writing the implementation.

 Global AI Harness: Root Project Architect

## 1. System Overview
You are the Principal Architect of this repository. This project is a modern full-stack web application composed of a Next.js frontend and a Python/FastAPI backend, fully containerized via Docker. 

When working in this repo, you must adhere to these global rules first. Depending on the task, you must then consult the domain-specific rules (⁠ backend/AI-BACKEND.md ⁠ or ⁠ frontend/AI-FRONTEND.md ⁠).

## 2. Infrastructure & Docker Rules
•⁠  ⁠*Orchestration:* The project relies on a single ⁠ docker-compose.yml ⁠ at the root.
•⁠  ⁠*Services:* 
  - ⁠ frontend ⁠: Node.js container for Next.js.
  - ⁠ backend ⁠: Python 3.11+ container for FastAPI, managed by ⁠ uv ⁠.
  - ⁠ database ⁠: PostgreSQL 15+ container.
•⁠  ⁠*Networking:* Services communicate over a shared internal Docker network. The frontend fetches from the backend via an internal URL during server-side rendering, and a public URL for client-side fetches.

## 3. Git & Version Control
•⁠  ⁠*Commits:* Strictly use Conventional Commits (e.g., ⁠ feat: add user auth ⁠, ⁠ fix: correct pydantic validation ⁠, ⁠ chore: update dependencies ⁠).
•⁠  ⁠*Branching:* Use ⁠ feature/<name> ⁠, ⁠ bugfix/<name> ⁠, or ⁠ refactor/<name> ⁠.
•⁠  ⁠*Pre-Commit:* Before suggesting a commit, ensure all code complies with Ruff (backend) and ESLint (frontend).

## 4. Universal Coding Directives
•⁠  ⁠*Zero Filler:* Do not output conversational filler (e.g., "Sure, here is the code!" or "Let me know if you need help!"). Output only the requested code, terminal commands, or necessary architectural explanations.
•⁠  ⁠*Security First:* Never hardcode secrets, API keys, or database credentials. Always load them from ⁠ .env ⁠ files using ⁠ os.getenv ⁠ or Next.js environment variables.
•⁠  ⁠*The Critic Loop:* Across the entire stack, unit tests must be written and validated before the actual implementation.

## 5. Context Routing (How to Help Me)
When I give you a prompt, determine the scope and read the necessary context:
•⁠  ⁠*UI/Client Tasks:* Read ⁠ frontend/AI-frontend.md ⁠.
•⁠  ⁠*API/Database Tasks:* Read ⁠ backend/AI-backend.md ⁠.
•⁠  ⁠*Full-Stack Features:* Read both. Propose the JSON API contract first. Once approved, write the backend tests, then the backend implementation, then the frontend tests, then the frontend implementation.
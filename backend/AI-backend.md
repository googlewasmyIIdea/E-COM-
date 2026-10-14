## 1. Domain & Objective
You are a senior backend engineer. You write strict, scalable, and highly performant Python code. This backend acts as a REST API servicing a Next.js frontend. 

## 2. Tech Stack & Tooling
•⁠  ⁠*Language:* Python 3.13
•⁠  ⁠*Framework:* FastAPI
•⁠  ⁠*Data Validation:* Pydantic v2
•⁠  ⁠*ORM / Database:* SQLAlchemy 2.0 (Async) + Alembic
•⁠  ⁠*Package Manager:* ⁠ uv ⁠
•⁠  ⁠*Testing:* PyTest, ⁠ pytest-asyncio ⁠
•⁠  ⁠*Quality Gates:* Ruff (linting and formatting), MyPy (strict typing)

## 3. Strict Backend Rules
•⁠  ⁠*Absolute Typing:* Every function signature must have explicit type hints for both arguments and return values. Never use ⁠ Any ⁠. 
•⁠  ⁠*Async First:* All database operations and external network calls must use ⁠ async ⁠/⁠ await ⁠.
•⁠  ⁠*Dependency Injection:* Use FastAPI's ⁠ Depends() ⁠ for database sessions, authentication checks, and external services. Do not instantiate these globally.
•⁠  ⁠*Pydantic v2:* Use Pydantic models for all request and response schemas. Controllers/Routes must return Pydantic models, never raw dictionaries. While returning keep it simple and use only json.
•⁠  ⁠*Separation of Concerns:* 
  - ⁠ routers/ ⁠: Only contains route definitions and dependency injection.
  - ⁠ services/ ⁠: Contains the actual business logic. Make class for each feature.
  - ⁠ models/ ⁠: Contains database models and interaction logic and use classmethods 
 
•⁠  ⁠*Error Handling:* Make a base exception.py with custom exception not found, authentication, make new exception when necessary,Raise custom exception from exeception.py early for invalid states. Use custom exception handlers for domain-specific errors.

## 4. Execution Loop
1.⁠ ⁠When asked to build an endpoint, write the PyTest cases first in ⁠ tests/ ⁠.
2.⁠ ⁠Mock database calls using ⁠ pytest-mock ⁠ or use an in-memory SQLite database for testing.
3.⁠ ⁠Write the implementation to pass the tests.
4.⁠ ⁠Ensure the output strictly follows Ruff formatting.
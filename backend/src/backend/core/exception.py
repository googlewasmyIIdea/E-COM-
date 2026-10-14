class DomainError(Exception):
    status_code: int = 400


class NotFoundError(DomainError):
    status_code = 404


class AuthenticationError(DomainError):
    status_code = 401


class NotImplementedError(DomainError):
    status_code = 501


class ConflictError(DomainError):
    status_code = 409


class AuthorizationError(DomainError):
    status_code = 403


class ValidationError(DomainError):
    status_code = 400


class ServiceUnavailableError(DomainError):
    status_code = 503


class RateLimitError(DomainError):
    status_code = 429

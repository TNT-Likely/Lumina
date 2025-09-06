export class AppError extends Error {
  httpStatus: number
  bizCode?: string
  details?: unknown

  constructor ( message: string, httpStatus: number, bizCode?: string, details?: unknown ) {
    super( message )
    this.name = 'AppError'
    this.httpStatus = httpStatus
    this.bizCode = bizCode
    this.details = details
  }
}

export class ForbiddenError extends AppError {
  constructor ( message = 'Forbidden', bizCode = 'FORBIDDEN', details?: unknown ) {
    super( message, 403, bizCode, details )
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor ( message = 'Not Found', bizCode = 'NOT_FOUND', details?: unknown ) {
    super( message, 404, bizCode, details )
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends AppError {
  constructor ( message = 'Bad Request', bizCode = 'BAD_REQUEST', details?: unknown ) {
    super( message, 400, bizCode, details )
    this.name = 'ValidationError'
  }
}

export class ConflictError extends AppError {
  constructor ( message = 'Conflict', bizCode = 'CONFLICT', details?: unknown ) {
    super( message, 409, bizCode, details )
    this.name = 'ConflictError'
  }
}

export const isAppError = ( e: unknown ): e is AppError => {
  return !!e && typeof e === 'object' && 'httpStatus' in ( e as Record<string, unknown> )
}

export class AppError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof Error) return new AppError('UNEXPECTED', error.message, { cause: error })
  return new AppError('UNEXPECTED', 'Đã xảy ra lỗi không xác định.')
}

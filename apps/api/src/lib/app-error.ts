export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}

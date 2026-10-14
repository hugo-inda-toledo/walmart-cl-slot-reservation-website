export interface FieldError {
  readonly field: string;
  readonly message: string;
  readonly rejectedValue?: unknown;
}

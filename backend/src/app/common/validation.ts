export interface ValidationIssue {
  path: string;
  message: string;
  code?: "required" | "type" | "value";
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationIssue[] };

export type Validator<T> = (input: unknown) => ValidationResult<T>;

export type FieldValidator = (value: unknown, path: string) => ValidationIssue[];

export function validateRequest<T>(
  input: unknown,
  validator: Validator<T>
): ValidationResult<T> {
  return validator(input);
}

export function formatValidationErrors(errors: ValidationIssue[]): string {
  if (errors.length === 0) {
    return "Invalid request";
  }

  return errors.map((error) => `${error.path}: ${error.message}`).join("; ");
}

export function createObjectValidator<T>(
  shape: Record<string, FieldValidator>
): Validator<T> {
  return (input: unknown) => {
    if (!isRecord(input)) {
      return failure([
        {
          path: "",
          message: "Expected object",
          code: "type"
        }
      ]);
    }

    const errors: ValidationIssue[] = [];
    for (const key of Object.keys(shape)) {
      errors.push(...shape[key](input[key], key));
    }

    if (errors.length > 0) {
      return failure(errors);
    }

    return success(input as T);
  };
}

export function requiredString(options?: {
  minLength?: number;
  maxLength?: number;
  trim?: boolean;
}): FieldValidator {
  return (value, path) => {
    if (value === undefined || value === null) {
      return [requiredIssue(path)];
    }
    if (typeof value !== "string") {
      return [typeIssue(path, "string")];
    }

    const text = options?.trim ? value.trim() : value;
    if (text.length === 0) {
      return [valueIssue(path, "Must not be empty")];
    }
    if (options?.minLength !== undefined && text.length < options.minLength) {
      return [
        valueIssue(path, `Must be at least ${options.minLength} characters`)
      ];
    }
    if (options?.maxLength !== undefined && text.length > options.maxLength) {
      return [
        valueIssue(path, `Must be at most ${options.maxLength} characters`)
      ];
    }
    return [];
  };
}

export function optionalString(options?: {
  minLength?: number;
  maxLength?: number;
  trim?: boolean;
}): FieldValidator {
  const validator = requiredString(options);
  return (value, path) => (value === undefined ? [] : validator(value, path));
}

export function requiredBoolean(): FieldValidator {
  return (value, path) => {
    if (value === undefined || value === null) {
      return [requiredIssue(path)];
    }
    if (typeof value !== "boolean") {
      return [typeIssue(path, "boolean")];
    }
    return [];
  };
}

export function optionalBoolean(): FieldValidator {
  const validator = requiredBoolean();
  return (value, path) => (value === undefined ? [] : validator(value, path));
}

export function requiredNumber(options?: {
  min?: number;
  max?: number;
  integer?: boolean;
}): FieldValidator {
  return (value, path) => {
    if (value === undefined || value === null) {
      return [requiredIssue(path)];
    }
    if (typeof value !== "number" || Number.isNaN(value)) {
      return [typeIssue(path, "number")];
    }
    if (options?.integer && !Number.isInteger(value)) {
      return [valueIssue(path, "Must be an integer")];
    }
    if (options?.min !== undefined && value < options.min) {
      return [valueIssue(path, `Must be >= ${options.min}`)];
    }
    if (options?.max !== undefined && value > options.max) {
      return [valueIssue(path, `Must be <= ${options.max}`)];
    }
    return [];
  };
}

export function optionalNumber(options?: {
  min?: number;
  max?: number;
  integer?: boolean;
}): FieldValidator {
  const validator = requiredNumber(options);
  return (value, path) => (value === undefined ? [] : validator(value, path));
}

export function requiredStringEnum(values: readonly string[]): FieldValidator {
  return (value, path) => {
    if (value === undefined || value === null) {
      return [requiredIssue(path)];
    }
    if (typeof value !== "string") {
      return [typeIssue(path, "string")];
    }
    if (!values.includes(value)) {
      return [valueIssue(path, `Must be one of ${values.join(", ")}`)];
    }
    return [];
  };
}

export function optionalStringEnum(values: readonly string[]): FieldValidator {
  const validator = requiredStringEnum(values);
  return (value, path) => (value === undefined ? [] : validator(value, path));
}

export function requiredStringArray(options?: {
  minItems?: number;
  maxItems?: number;
  minLength?: number;
}): FieldValidator {
  return (value, path) => {
    if (value === undefined || value === null) {
      return [requiredIssue(path)];
    }
    if (!Array.isArray(value)) {
      return [typeIssue(path, "array")];
    }
    if (options?.minItems !== undefined && value.length < options.minItems) {
      return [valueIssue(path, `Must have at least ${options.minItems} items`)];
    }
    if (options?.maxItems !== undefined && value.length > options.maxItems) {
      return [valueIssue(path, `Must have at most ${options.maxItems} items`)];
    }
    const errors: ValidationIssue[] = [];
    value.forEach((item, index) => {
      if (typeof item !== "string") {
        errors.push(typeIssue(`${path}[${index}]`, "string"));
        return;
      }
      if (options?.minLength !== undefined && item.length < options.minLength) {
        errors.push(
          valueIssue(
            `${path}[${index}]`,
            `Must be at least ${options.minLength} characters`
          )
        );
      }
    });
    return errors;
  };
}

export function optionalStringArray(options?: {
  minItems?: number;
  maxItems?: number;
  minLength?: number;
}): FieldValidator {
  const validator = requiredStringArray(options);
  return (value, path) => (value === undefined ? [] : validator(value, path));
}

export function requiredRecord(): FieldValidator {
  return (value, path) => {
    if (value === undefined || value === null) {
      return [requiredIssue(path)];
    }
    if (!isRecord(value)) {
      return [typeIssue(path, "object")];
    }
    return [];
  };
}

export function optionalRecord(): FieldValidator {
  const validator = requiredRecord();
  return (value, path) => (value === undefined ? [] : validator(value, path));
}

export function objectField<T>(validator: Validator<T>): FieldValidator {
  return (value, path) => {
    const result = validator(value);
    if (result.ok) {
      return [];
    }
    return result.errors.map((error) => ({
      ...error,
      path: joinPath(path, error.path)
    }));
  };
}

export function optionalObjectField<T>(validator: Validator<T>): FieldValidator {
  const fieldValidator = objectField(validator);
  return (value, path) => (value === undefined ? [] : fieldValidator(value, path));
}

function success<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function failure(errors: ValidationIssue[]): ValidationResult<never> {
  return { ok: false, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredIssue(path: string): ValidationIssue {
  return { path, message: "Required", code: "required" };
}

function typeIssue(path: string, expected: string): ValidationIssue {
  return { path, message: `Expected ${expected}`, code: "type" };
}

function valueIssue(path: string, message: string): ValidationIssue {
  return { path, message, code: "value" };
}

function joinPath(base: string, next: string): string {
  if (!base) {
    return next;
  }
  if (!next) {
    return base;
  }
  return `${base}.${next}`;
}

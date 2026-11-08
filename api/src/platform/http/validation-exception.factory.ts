import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';

/** A single invalid request field, emitted under `details.fields`. */
export interface ValidationFieldError {
  /** External snake_case path of the invalid field. */
  field: string;
  /** Every class-validator message for that field. */
  messages: string[];
}

export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';
export const VALIDATION_FAILED_MESSAGE = 'Validation failed';

/**
 * Converts class-validator errors into the public structured field-error shape
 * carried in `details.fields`, using the external snake_case request paths
 * (e.g. `display_name`, `preferences.region`, `items.0.product_public_id`).
 */
export function flattenValidationFields(
  errors: ValidationError[],
): ValidationFieldError[] {
  const fields: ValidationFieldError[] = [];

  const walk = (items: ValidationError[], parentPath: string) => {
    for (const item of items) {
      const path = parentPath ? `${parentPath}.${item.property}` : item.property;
      const messages = Object.values(item.constraints ?? {});

      if (messages.length > 0) {
        fields.push({ field: toSnakeCasePath(path), messages });
      }

      if (item.children && item.children.length > 0) {
        walk(item.children, path);
      }
    }
  };

  walk(errors, '');

  return fields;
}

function toSnakeCasePath(path: string): string {
  return path
    .split('.')
    .map((segment) => {
      if (/^\d+$/.test(segment)) {
        return segment;
      }

      return segment
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/-/g, '_')
        .toLowerCase();
    })
    .join('.');
}

/**
 * `ValidationPipe` exception factory producing the standard
 * `VALIDATION_FAILED` error with a `details.fields` array instead of Nest's
 * bare message array, so the public envelope keeps a single string `message`.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    code: VALIDATION_FAILED_CODE,
    message: VALIDATION_FAILED_MESSAGE,
    details: { fields: flattenValidationFields(errors) },
  });
}

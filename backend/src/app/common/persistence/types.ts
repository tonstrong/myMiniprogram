/**
 * Persistence-facing record shapes aligned with SQL schema.
 * SQL column names are snake_case; these interfaces use camelCase.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface BaseRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatedAtRecord {
  createdAt: Date;
}

export interface ProviderModelFields {
  provider?: string | null;
  modelName?: string | null;
  modelTier?: string | null;
}

export interface RetryableProviderFields extends ProviderModelFields {
  retryCount?: number | null;
}

export interface ProviderMetaJsonField {
  providerMeta?: JsonValue | null;
}

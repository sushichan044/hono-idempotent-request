import type { IdempotencyFingerprint } from "./brand";

export type RequestIdentifier = {
  /**
   * Request method
   */
  requestMethod: string;

  /**
   * Request path
   */
  requestPath: string;

  /**
   * `Idempotency-Key` header value
   */
  idempotencyKey: string;

  /**
   * Request fingerprint
   *
   * This is used to identify the request in the storage.
   */
  fingerprint: IdempotencyFingerprint | null;
};

export const isIdenticalRequest = (
  target: RequestIdentifier,
  candidate: RequestIdentifier,
): boolean => {
  return (
    target.requestMethod === candidate.requestMethod &&
    target.requestPath === candidate.requestPath &&
    target.idempotencyKey === candidate.idempotencyKey &&
    target.fingerprint === candidate.fingerprint
  );
};

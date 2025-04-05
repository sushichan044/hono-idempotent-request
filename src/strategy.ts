import type { MaybePromise } from "./utils/types";

/**
 * Function type for defining the condition for activating idempotency processing
 *
 * Receives a request object and returns a boolean indicating whether to apply idempotency processing
 *
 * Return `true` to activate idempotency processing, `false` otherwise
 */
type IdempotencyActivationStrategyFunction = (
  request: Request,
) => MaybePromise<boolean>;

/**
 * Strategy for activating idempotency processing
 */
export type IdempotencyActivationStrategy =
  | "always"
  | "opt-in"
  | IdempotencyActivationStrategyFunction;

/**
 * Convert strategy to function type
 *
 * If specified as a string, convert to the corresponding function,
 * and if specified as a function, return it as is
 *
 * @param strategy The strategy.
 * @returns Function that returns a boolean indicating whether to apply idempotency processing.
 */
export const prepareActivationStrategy = (
  strategy: IdempotencyActivationStrategy,
): IdempotencyActivationStrategyFunction => {
  if (typeof strategy === "function") {
    return strategy;
  }

  if (strategy === "opt-in") {
    return OPT_IN_WITH_KEY;
  }

  if (strategy === "always") {
    return ALWAYS_ACTIVE;
  }

  throw new Error(
    `Invalid activation strategy: ${String(strategy satisfies never)}`,
  );
};

/**
 * Strategy for always applying idempotency processing
 */
const ALWAYS_ACTIVE = (() =>
  true) satisfies IdempotencyActivationStrategyFunction;

/**
 * Strategy for applying idempotency processing only if the Idempotency-Key header exists
 */
const OPT_IN_WITH_KEY: IdempotencyActivationStrategyFunction = (request) =>
  typeof request.headers.get("Idempotency-Key") === "string";

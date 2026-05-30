import type { Awaitable } from "./utils/types";

type ResponseType =
  | "error"
  | "key_conflict"
  | "key_missing"
  | "key_payload_mismatch"
  | "retrieved_stored_response"
  | "storage_error"
  | "success";

export type Hooks = {
  modifyResponse: (response: Response, type: ResponseType) => Awaitable<Response>;
};

export const resolveHooks = (userHooks: Partial<Hooks> = {}): Hooks => {
  return {
    modifyResponse: userHooks.modifyResponse ?? ((response) => response),
  };
};

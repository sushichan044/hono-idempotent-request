/**
 * @file
 *
 *   Utility to clone Hono request object. New efficient utility `cloneRawRequest` is available in
 *   Hono v4.6.10+. This module tries to import and use it if available. If not available, it falls
 *   back to using the standard `Request.clone()` method.
 */

import type { Context } from "hono";
import type { cloneRawRequest as cloneRawRequestImpl, HonoRequest } from "hono/request";

let _cloneRawRequest: typeof cloneRawRequestImpl | null = null;
let _triedImporting = false;

export async function cloneRequest(context: Context): Promise<Request> {
  if (!_triedImporting) {
    _triedImporting = true;
    _cloneRawRequest = await tryImportCloneRawRequest();
  }

  if (_cloneRawRequest) {
    return _cloneRawRequest(context.req as HonoRequest);
  }

  return context.req.raw.clone();
}

async function tryImportCloneRawRequest(): Promise<typeof cloneRawRequestImpl | null> {
  try {
    // hono >=4.0.0, <4.6.10 fails here
    const module = await import("hono/request");
    // hono >=4.6.10 <4.10 has hono/request export, but no cloneRawRequest
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    return module.cloneRawRequest ?? null;
  } catch {
    return null;
  }
}

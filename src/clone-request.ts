import type { Context } from "hono";

import * as honoRequest from "hono/request";

export async function cloneRequest(context: Context): Promise<Request> {
  if ("cloneRawRequest" in honoRequest) {
    return await honoRequest.cloneRawRequest(
      context.req as honoRequest.HonoRequest,
    );
  }

  return context.req.raw.clone();
}

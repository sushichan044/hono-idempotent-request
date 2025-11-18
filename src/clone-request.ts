import type { Context } from "hono";
import type {
  cloneRawRequest as cloneRawRequestImpl,
  HonoRequest,
} from "hono/request";

export async function cloneRequest(context: Context): Promise<Request> {
  const cloneRawRequest = await tryImportCloneRawRequest();
  if (cloneRawRequest != null) {
    return await cloneRawRequest(context.req as HonoRequest);
  }

  return context.req.raw.clone();
}

async function tryImportCloneRawRequest(): Promise<
  typeof cloneRawRequestImpl | null
> {
  try {
    // hono <4.6.10 fails here
    const module = await import("hono/request");
    // hono >=4.6.10 <4.10 has hono/request export, but no cloneRawRequest
    return module.cloneRawRequest ?? null;
  } catch {
    return null;
  }
}

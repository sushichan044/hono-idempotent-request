# hono-idempotent-request

Idempotent request middleware for [Hono](https://hono.dev/), compliant with [IETF draft-ietf-httpapi-idempotency-key-header-07](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07).

## Features

- ✅ **Idempotency-Key Header Support** - Process requests idempotently based on the `Idempotency-Key` header
- 🔄 **Response Caching** - Cache and reuse responses for requests with the same `Idempotency-Key`
- 🔒 **Concurrent Request Detection** - Detect and handle concurrent requests with the same `Idempotency-Key`
- 🔍 **Payload Validation** - Verify request payload consistency using fingerprints
- 📋 **RFC 7807 Compliant Errors** - Return errors following the Problem Details for HTTP APIs specification
- 🎯 **Flexible Activation** - Control when idempotency processing is applied
- 🔧 **Bring Your Own Implementation** - Implement your own storage adapter and server specification

## Installation

```bash
# pnpm
pnpm add hono-idempotent-request

# npm
npm install hono-idempotent-request

# yarn
yarn add hono-idempotent-request
```

## Requirements

- Hono >= 4.0.0

## Quick Start

```typescript
import { Hono } from "hono";
import { idempotentRequest } from "hono-idempotent-request";

const app = new Hono()
  .use(
    "/api",
    idempotentRequest({
      activationStrategy: (request) => ["POST", "PATCH"].includes(request.method),
      // https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#name-resource
      resource: {
        satisfiesKeySpec: (key: string) => {
          // Validate Idempotency-Key format.
          // Other than this example, you can implement your own logic like UUID validation.
          return key.length <= 255;
        },
        getStorageKey: (idempotencyKey: string, request: Request) => {
          // Generate a storage key for the request.
          // For better isolation / performance, you might want to include user identifiers or other context.
          // Returns a plain string (internal conversion to branded type is handled by middleware)
          return `${idempotencyKey}:${request.url}`;
        },
        getFingerprint: async (request: Request) => {
          // Generate a fingerprint for the request.
          // Returns a string or null. If you want to use structured objects, stringify them.
          const payload = await request.json();
          return JSON.stringify({ user: payload.userId });
        },
      },
      storage: {
        adapter: {
          get: async (storageKey) => {
            // Retrieve a stored request
            return yourStorage.get(storageKey);
          },
          save: async (request) => {
            // Save a new request
            // The storageKey is available as request.storageKey
            await yourStorage.set(request.storageKey, request);
          },
          update: async (request) => {
            // Update an existing request
            // The storageKey is available as request.storageKey
            await yourStorage.set(request.storageKey, request);
          },
        },
      },
    }),
  )
  .post("/api/payment", async (c) => {
    // Your handler logic
    return c.json({ status: "success" });
  });
```

## Configuration

### `IdempotentRequestImplementation`

#### `activationStrategy` (optional)

Controls when idempotency processing is applied.

- `"always"`: Apply idempotency processing to all requests
- `"opt-in-with-key"` (default): Only apply when the `Idempotency-Key` header is present
- `(request: Request) => boolean | Promise<boolean>`: Custom function to determine activation

```typescript
activationStrategy: "opt-in-with-key"
// or
activationStrategy: (request) => request.method === "POST"
```

#### `hooks` (optional)

Hooks to modify behavior.

- `modifyResponse?: (response: Response, type: ResponseType) => Promise<Response> | Response`

Modify the response before it's returned to the client. The `type` parameter indicates why the hook was called:
- `"success"`: Successful request processing
- `"retrieved_stored_response"`: Cached response returned
- `"key_conflict"`: Concurrent request detected (409)
- `"key_missing"`: Missing or invalid Idempotency-Key (400)
- `"key_payload_mismatch"`: Fingerprint mismatch detected (422)
- `"error"`: General error

```typescript
hooks: {
  modifyResponse: (response, type) => {
    // Add custom headers based on response type
    if (type === "retrieved_stored_response") {
      response.headers.set("X-Idempotent-Replayed", "true");
    }
    return response;
  }
}
```

#### `resource` (required)

Resource specification implementation.

##### Resource Specification

- `satisfiesKeySpec(key: string): boolean`
  - Validate the `Idempotency-Key` format
  - Return `true` if the key is valid

- `getStorageKey(idempotencyKey: string, request: Request): string | Promise<string>`
  - Generate a storage key from the `Idempotency-Key` and request
  - Return a plain string (internal conversion to branded type is handled by middleware)
  - **MUST include the `Idempotency-Key` value in the returned string**

- `getFingerprint(request: Request): string | null | Promise<string | null>`
  - Generate a fingerprint for the request payload
  - Return a plain string or `null` if fingerprinting is not needed
  - If returning structured data, stringify it (e.g., `JSON.stringify()`)
  - Return `null` if this resource does not use fingerprinting

#### `storage` (required)

Storage adapter implementation.

##### `storage.adapter`

- `get(storageKey: StorageKey): Promise<IdempotentRequest | null>`
  - Retrieve a stored idempotent request by storage key
  - Return `null` if not found

- `save(request: UnProcessedIdempotentRequest): Promise<void>`
  - Save a new unprocessed idempotent request
  - The request object includes: `storageKey`, `idempotencyKey`, `fingerprint`, `requestMethod`, `requestPath`, `createdAt`, `lockedAt` (null), `response` (null)
  - Access the storage key via `request.storageKey`
  - Throw `IdempotencyKeyStorageError` if the key already exists

- `update(request: ProcessingIdempotentRequest | FulfilledIdempotentRequest): Promise<void>`
  - Update an existing idempotent request
  - The request object includes all fields including `request.storageKey`
  - `ProcessingIdempotentRequest` has `lockedAt: Date` and `response: null`
  - `FulfilledIdempotentRequest` has `lockedAt: null` and `response: SerializedResponse`
  - Throw `IdempotencyKeyStorageError` if the key doesn't exist

## Error Handling

The middleware returns the following HTTP errors in accordance with the IETF draft:

### 400 Bad Request

The `Idempotency-Key` header is missing or doesn't satisfy the specification.

```json
{
  "type": "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-4.2",
  "title": "Bad Request",
  "status": 400,
  "detail": "Idempotency-Key header is missing or does not satisfy the specification"
}
```

### 409 Conflict

A request with the same `Idempotency-Key` is currently being processed.

```json
{
  "type": "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-4.3",
  "title": "Conflict",
  "status": 409,
  "detail": "A request with the same Idempotency-Key is currently being processed"
}
```

### 422 Unprocessable Content

The `Idempotency-Key` is being reused with a different request payload.

```json
{
  "type": "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-06#section-4.4",
  "title": "Unprocessable Content",
  "status": 422,
  "detail": "Idempotency-Key is reused for a different request payload"
}
```

## API Reference

### Middleware

- `idempotentRequest(implementation: IdempotentRequestImplementation): MiddlewareHandler`

### Types

- `IdempotentRequestImplementation` - Configuration interface
- `IdempotentRequest` - Union type of all request states
  - `UnProcessedIdempotentRequest` - Request not yet processed (`lockedAt: null`, `response: null`)
  - `ProcessingIdempotentRequest` - Request currently being processed (`lockedAt: Date`, `response: null`)
  - `FulfilledIdempotentRequest` - Request completed with cached response (`lockedAt: null`, `response: SerializedResponse`)
- `SerializedResponse` - Serialized response type
- `ResourceSpecification` - Resource specification interface
- `StorageAdapter` - Storage adapter interface
- `StorageKey` - Branded type for storage keys
- `IdempotencyFingerprint` - Branded type for request fingerprints

### IdempotentRequest Fields

All `IdempotentRequest` variants include these common fields:

- `storageKey: StorageKey` - Key used to retrieve the request from storage
- `idempotencyKey: string` - Original `Idempotency-Key` header value
- `fingerprint: IdempotencyFingerprint | null` - Request payload fingerprint (null if not used)
- `requestMethod: string` - HTTP method (e.g., "POST")
- `requestPath: string` - Request URL pathname
- `createdAt: Date` - Timestamp when the request record was created

State-specific fields:

- `lockedAt: Date | null` - Processing lock timestamp (Date when processing, null otherwise)
- `response: SerializedResponse | null` - Cached response (only present in `FulfilledIdempotentRequest`)

### Errors

- `IdempotencyKeyStorageError` - Thrown when storage operations fail
- `UnsafeImplementationError` - Thrown when implementation violates safety constraints

## License

MIT

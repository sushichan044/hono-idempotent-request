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
          return `${idempotencyKey}:${request.url}`;
        },
        getFingerprint: async (request: Request) => {
          // Generate a fingerprint for the request.
          // If you want to use structured objects, you should normalize the order of keys to compare them by semantics.
          const payload = await request.json();
          return {
            user: payload.userId,
          };
        },
      },
      storage: {
        adapter: {
          get: async (key) => {
            // Retrieve a stored request
            return yourStorage.get(key);
          },
          save: async (key, request) => {
            // Save a new request
            await yourStorage.set(key, request);
          },
          update: async (key, request) => {
            // Update an existing request
            await yourStorage.set(key, request);
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

- `"always"` (default): Apply idempotency processing to all requests
- `"opt-in"`: Only apply when the `Idempotency-Key` header is present
- `(request: Request) => boolean`: Custom function to determine activation

```typescript
activationStrategy: "opt-in"
// or
activationStrategy: (request) => request.method === "POST"
```

#### `hooks` (optional)

Hooks to modify behavior.

- `modifyResponse?: (response: Response) => Promise<Response> | Response`

Modify the response before it's returned to the client.

```typescript
hooks: {
  modifyResponse: (response) => {
    // Add custom headers, etc.
    return response;
  }
}
```

#### `server` (required)

Server specification implementation.

##### `server.specification`

- `satisfiesKeySpec(key: string): boolean`
  - Validate the `Idempotency-Key` format
  - Return `true` if the key is valid

- `getStorageKey(key: string, request: Request): StorageKey`
  - Generate a storage key from the `Idempotency-Key` and request
  - Use `createStorageKey()` to create a branded `StorageKey`

- `getFingerprint(request: Request): Promise<IdempotencyFingerprint>`
  - Generate a fingerprint for the request payload
  - Use `createIdempotencyFingerprint()` to create a branded `IdempotencyFingerprint`

#### `storage` (required)

Storage adapter implementation.

##### `storage.adapter`

- `get(key: StorageKey): Promise<IdempotentRequest | null>`
  - Retrieve a stored idempotent request
  - Return `null` if not found

- `save(key: StorageKey, request: IdempotentRequest): Promise<void>`
  - Save a new idempotent request
  - Throw `IdempotencyKeyStorageError` if the key already exists

- `update(key: StorageKey, request: IdempotentRequest): Promise<void>`
  - Update an existing idempotent request
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
- `IdempotentRequest` - Stored request type
- `SerializedResponse` - Serialized response type
- `IdempotentRequestServerSpecification` - Server specification interface
- `IdempotentRequestStorageAdapter` - Storage adapter interface
- `StorageKey` - Branded type for storage keys
- `IdempotencyFingerprint` - Branded type for request fingerprints

### Utilities

- `createStorageKey(key: string): StorageKey`
- `createIdempotencyFingerprint(fingerprint: string): IdempotencyFingerprint`

### Errors

- `IdempotencyKeyStorageError` - Thrown when storage operations fail
- `UnsafeImplementationError` - Thrown when implementation violates safety constraints

## License

MIT

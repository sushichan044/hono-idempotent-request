import { describe, expect, it } from "vitest";

import type { SerializedResponse } from "./serializer";

import { cloneAndSerializeResponse, deserializeResponse } from "./serializer";

describe("serializeResponse", () => {
  it("can serialize a response", async () => {
    const mockResponse = new Response("Test body", {
      headers: {
        "Content-Type": "text/plain",
        "X-Test-Header": "test-value",
      },
      status: 200,
      statusText: "OK",
    });

    const serialized = await cloneAndSerializeResponse(mockResponse);

    expect(serialized).toStrictEqual({
      body: "Test body",
      headers: {
        "content-type": "text/plain",
        "x-test-header": "test-value",
      },
      status: 200,
      statusText: "OK",
    });
  });

  it("should not consume the original response body", async () => {
    const originalResponse = new Response("Test body", {
      headers: {
        "Content-Type": "text/plain",
      },
      status: 200,
    });

    // serialize the response
    await cloneAndSerializeResponse(originalResponse);

    // original response body is not consumed
    // If consumed, this will cause
    // TypeError: Body is unusable: Body has already been read
    const body = await originalResponse.text();
    expect(body).toBe("Test body");
  });
});

describe("deserializeResponse", () => {
  it("can deserialize a serialized response", async () => {
    const serialized = {
      body: "Test body",
      headers: {
        "content-type": "text/plain",
        "x-test-header": "test-value",
      },
      status: 200,
      statusText: "OK",
    } satisfies SerializedResponse;

    const response = deserializeResponse(serialized);

    expect(response.status).toBe(200);
    expect(response.statusText).toBe("OK");
    // Headers should be case-insensitive
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("X-Test-Header")).toBe("test-value");
    expect(response.headers.get("x-test-header")).toBe("test-value");

    expect(await response.text()).toBe("Test body");
  });
});

describe("BodyInit round-trip", () => {
  it("should round-trip string bodies", async () => {
    const response = new Response("Hello");
    const serialized = await cloneAndSerializeResponse(response);
    const actualBody = await response.text();

    const deserialized = deserializeResponse(serialized);
    const deserializedBody = await deserialized.text();

    expect(deserializedBody).toBe(actualBody);
  });

  it("should round-trip Blob bodies", async () => {
    const response = new Response(
      new Blob(["Hello Blob"], { type: "text/plain" }),
    );
    const serialized = await cloneAndSerializeResponse(response);
    const actualBody = await response.text();

    const deserialized = deserializeResponse(serialized);
    const deserializedBody = await deserialized.text();

    expect(deserializedBody).toBe(actualBody);
  });

  it("should round-trip ArrayBuffer bodies", async () => {
    const buf = new TextEncoder().encode("Hello AB").buffer;
    const response = new Response(buf);
    const serialized = await cloneAndSerializeResponse(response);
    const actualBody = await response.text();

    const deserialized = deserializeResponse(serialized);
    const deserializedBody = await deserialized.text();

    expect(deserializedBody).toBe(actualBody);
  });

  it("should round-trip Uint8Array bodies", async () => {
    const uint8 = new TextEncoder().encode("Hello UA");
    const response = new Response(uint8);
    const serialized = await cloneAndSerializeResponse(response);
    const actualBody = await response.text();

    const deserialized = deserializeResponse(serialized);
    const deserializedBody = await deserialized.text();

    expect(deserializedBody).toBe(actualBody);
  });

  it("should round-trip URLSearchParams bodies", async () => {
    const usp = new URLSearchParams({ baz: "qux", foo: "bar" });
    const response = new Response(usp);
    const serialized = await cloneAndSerializeResponse(response);
    const actualBody = await response.text();

    const deserialized = deserializeResponse(serialized);
    const deserializedBody = await deserialized.text();

    expect(deserializedBody).toBe(actualBody);
  });

  it("should round-trip FormData bodies", async () => {
    const fd = new FormData();
    fd.append("key", "value");
    const response = new Response(fd);
    const serialized = await cloneAndSerializeResponse(response);
    const actualBody = await response.text();

    const deserialized = deserializeResponse(serialized);
    const deserializedBody = await deserialized.text();

    expect(deserializedBody).toBe(actualBody);
  });

  it("should round-trip ReadableStream bodies", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Hello Stream"));
        controller.close();
      },
    });
    const response = new Response(stream);
    const serialized = await cloneAndSerializeResponse(response);
    const actualBody = await response.text();

    const deserialized = deserializeResponse(serialized);
    const deserializedBody = await deserialized.text();

    expect(deserializedBody).toBe(actualBody);
  });

  it("should round-trip null bodies", async () => {
    const response = new Response(null);
    const serialized = await cloneAndSerializeResponse(response);
    const actualBody = await response.text();

    const deserialized = deserializeResponse(serialized);
    const deserializedBody = await deserialized.text();

    expect(deserializedBody).toBe(actualBody);
  });
});

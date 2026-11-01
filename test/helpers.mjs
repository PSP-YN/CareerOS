import { Readable } from 'node:stream';

export function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

export function createMockReq({
  method = 'GET',
  headers = {},
  body = {},
  streamBody = null
} = {}) {
  const normalizedHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    normalizedHeaders[k.toLowerCase()] = v;
  }

  let req;
  if (streamBody !== null) {
    req = Readable.from(
      Array.isArray(streamBody) ? streamBody : [Buffer.isBuffer(streamBody) ? streamBody : Buffer.from(streamBody)]
    );
  } else {
    req = Readable.from([]);
  }

  req.method = method;
  req.headers = normalizedHeaders;
  req.body = body;
  return req;
}

export function mockFetch(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    return handler(url, options);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

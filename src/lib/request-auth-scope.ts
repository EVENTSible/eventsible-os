import { AsyncLocalStorage } from "node:async_hooks";

type Store = { responses: Map<string, Promise<Response>>; verifications: number };
// OpenNext bundles Proxy and rendering separately. Share the context carrier,
// never a user response, between those bundles. Each Worker fetch owns a store.
const key = Symbol.for("eventsible.qa.request-auth-scope.v1");
const shared = globalThis as typeof globalThis & { [key]?: AsyncLocalStorage<Store> };
const scope = shared[key] ??= new AsyncLocalStorage<Store>();

export function withRequestAuthScope<T>(callback: () => T): T {
  return scope.run({ responses: new Map(), verifications: 0 }, callback);
}

// Numeric QA evidence only; no identity, token or response data leaves the scope.
export function requestAuthVerificationCount(): number {
  return scope.getStore()?.verifications ?? 0;
}

export function requestAuthFetch(backendUrl: string, upstream: typeof fetch = fetch): typeof fetch {
  const userUrl = new URL("/auth/v1/user", backendUrl).href;
  return async (input, init) => {
    const store = scope.getStore();
    // Request objects and mutations are deliberately excluded. Outside the QA
    // Worker wrapper there is no store, so verification uses the normal fetch.
    if (!store || input instanceof Request || String(input) !== userUrl ||
        (init?.method ?? "GET").toUpperCase() !== "GET" || init?.body) {
      return upstream(input, init);
    }
    const headers = new Headers(init?.headers);
    if (!headers.get("authorization") || !headers.get("apikey")) return upstream(input, init);
    init?.signal?.throwIfAborted();
    const identity = JSON.stringify([userUrl, [...headers.entries()].sort()]);
    let pending = store.responses.get(identity);
    if (!pending) {
      pending = upstream(input, init);
      store.verifications++;
      store.responses.set(identity, pending);
    }
    try {
      const response = await pending;
      init?.signal?.throwIfAborted();
      // A failed verification is never reused, even within the request.
      if (!response.ok) store.responses.delete(identity);
      return response.clone();
    } catch (error) {
      store.responses.delete(identity);
      throw error;
    }
  };
}

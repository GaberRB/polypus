/**
 * Hardened HTTP client for the network tools (web_search/web_fetch/download).
 *
 * Security model (defense in depth, on top of `authorizeNetwork`):
 *  - https only; every URL re-screened with `screenUrl` (incl. each redirect hop).
 *  - SSRF closed at CONNECT time via a custom DNS `lookup` that rejects any
 *    resolved private/loopback/link-local address. Because https.request reuses
 *    the address the lookup returned, a public hostname that resolves to a private
 *    IP (DNS-rebinding / TOCTOU) is blocked — there is no second, unchecked lookup.
 *  - response size capped (streamed, aborted on overflow) to stop memory blowups
 *    and decompression bombs; `accept-encoding: identity` avoids compressed bodies.
 *  - hard timeout and external AbortSignal support.
 *  - redirects followed manually (bounded) so each Location is re-screened.
 */
import { request as httpsRequest, type RequestOptions } from "node:https";
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import type { LookupFunction } from "node:net";
import { isPrivateAddress, screenUrl, type UrlPolicy } from "../permissions/policy.js";

export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 5;
const USER_AGENT = "polypus-agent (+https://github.com/GaberRB/polypus)";

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  /** Abort once the body exceeds this many bytes. Default 5 MB. */
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Domain/port rules re-applied to every hop (in addition to the always-on SSRF guard). */
  policy?: UrlPolicy;
  signal?: AbortSignal;
}

export interface SafeResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  /** Final URL after redirects. */
  url: string;
  contentType: string;
}

/** Thrown for any policy/SSRF/size/timeout failure so callers can surface a clean message. */
export class SafeFetchError extends Error {}

/**
 * A DNS lookup that validates the resolved address before any socket is opened.
 * Rejects private/loopback/link-local results — this is what actually stops
 * SSRF via hostnames (e.g. an attacker domain pointing at 169.254.169.254).
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, options as LookupOptions, (err, address, family) => {
    const cb = callback as (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family: number) => void;
    if (err) return cb(err, "", 0);
    const addrs: LookupAddress[] = Array.isArray(address)
      ? address
      : [{ address: address as string, family: family ?? 0 }];
    for (const a of addrs) {
      if (isPrivateAddress(a.address)) {
        return cb(new SafeFetchError(`host "${hostname}" resolved to private address ${a.address} (SSRF blocked)`), "", 0);
      }
    }
    cb(null, address as string | LookupAddress[], family ?? 0);
  });
};

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeResponse> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let url = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    // Re-screen every hop with the same rules the permission engine used up front.
    const screen = screenUrl(url, options.policy);
    if (screen.blocked) throw new SafeFetchError(screen.reason ?? "blocked URL");

    const res = await requestOnce(url, options);
    if (res.redirectTo) {
      url = new URL(res.redirectTo, url).toString();
      continue;
    }
    return res.response!;
  }
  throw new SafeFetchError(`too many redirects (>${maxRedirects})`);
}

interface OnceResult {
  redirectTo?: string;
  response?: SafeResponse;
}

function requestOnce(url: string, options: SafeFetchOptions): Promise<OnceResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const u = new URL(url);

  return new Promise<OnceResult>((resolve, reject) => {
    const reqOpts: RequestOptions = {
      method: options.method ?? "GET",
      lookup: guardedLookup,
      headers: {
        "user-agent": USER_AGENT,
        "accept-encoding": "identity",
        accept: "*/*",
        ...options.headers,
      },
    };

    const req = httpsRequest(u, reqOpts, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location) {
        res.destroy();
        resolve({ redirectTo: location });
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy();
          cleanup();
          reject(new SafeFetchError(`response exceeded the ${maxBytes}-byte limit`));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        cleanup();
        resolve({
          response: {
            status,
            headers: res.headers,
            body: Buffer.concat(chunks),
            url,
            contentType: String(res.headers["content-type"] ?? ""),
          },
        });
      });
      res.on("error", (err) => {
        cleanup();
        reject(new SafeFetchError(err.message));
      });
    });

    const timer = setTimeout(() => {
      req.destroy(new SafeFetchError(`request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const onAbort = () => req.destroy(new SafeFetchError("aborted"));
    options.signal?.addEventListener("abort", onAbort, { once: true });
    function cleanup() {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }

    req.on("error", (err) => {
      cleanup();
      reject(err instanceof SafeFetchError ? err : new SafeFetchError(err.message));
    });
    req.end();
  });
}

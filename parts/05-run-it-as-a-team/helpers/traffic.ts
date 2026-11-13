// A recording door in front of a shop, the same helper as Part 4's, that also keeps each body.
// The learner's tests talk to the door, the door passes every request on to the shop,
// and it writes down what was asked and what came back.
// A check can also change one kind of answer on its way back, to see if the tests notice.
import type { Shop } from "../../../checks/lib/world";

export type Exchange = {
  method: string;
  path: string;
  query: URLSearchParams;
  body: string;
  status: number;
};

// Gets the parsed answer and the question it answers. Returns the answer to send on.
export type Rewrite = (answer: unknown, query: URLSearchParams) => unknown;

export type Door = {
  url: string;
  exchanges: Exchange[];
  close: () => void;
};

type DoorOptions = { rewritePath?: string; rewrite?: Rewrite };

// Headers that describe the old body. The shop's new body needs fresh ones.
const BODY_HEADERS = ["content-length", "content-encoding", "transfer-encoding"];

async function passOn(request: Request, shopUrl: string): Promise<Response> {
  const address = new URL(request.url);
  const target = `${shopUrl}${address.pathname}${address.search}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  return fetch(target, {
    method: request.method,
    headers: request.headers,
    body,
    redirect: "manual",
  });
}

function copyHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);
  for (const name of BODY_HEADERS) headers.delete(name);
  return headers;
}

async function rewritten(response: Response, query: URLSearchParams, rewrite: Rewrite) {
  const answer = await response.json();
  const changed = JSON.stringify(rewrite(answer, query));
  return new Response(changed, { status: response.status, headers: copyHeaders(response) });
}

async function plainCopy(response: Response) {
  const body = await response.arrayBuffer();
  return new Response(body, { status: response.status, headers: copyHeaders(response) });
}

export function openDoor(shop: Shop, options: DoorOptions = {}): Door {
  const exchanges: Exchange[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const address = new URL(request.url);
      const body = await request.clone().text();
      const response = await passOn(request, shop.url);
      const query = address.searchParams;
      exchanges.push({
        method: request.method,
        path: address.pathname,
        query,
        body,
        status: response.status,
      });
      const shouldRewrite = options.rewrite && address.pathname === options.rewritePath;
      if (shouldRewrite && response.ok && options.rewrite) {
        return rewritten(response, query, options.rewrite);
      }
      return plainCopy(response);
    },
  });
  return {
    url: `http://localhost:${server.port}`,
    exchanges,
    close: () => server.stop(true),
  };
}

// Turns an OpenAPI path like /api/orders/{orderId} into a pattern that matches real paths.
export function pathPattern(openApiPath: string): RegExp {
  const withParts = openApiPath.replace(/\{[^}]+\}/g, "[^/]+");
  return new RegExp(`^${withParts}$`);
}

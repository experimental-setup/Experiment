import type { Server } from "bun";
import { renderToReadableStream } from "react-dom/server";
import { prerenderToNodeStream as prerender } from "react-dom/static";
import { matchRoutes, StaticRouter } from "react-router";

import { log } from "../utils/logger";
import { Shell } from "../root";
import { publish, subscribe, type Update } from "../utils/æther";
import { eventStream } from "../utils/eventStream";
import { getManifest } from "../feature/pwa/manifest";
import { clientCss, clientFile, description, iconResolutions, name } from "../const";
import type { Nullish } from "../types";
import { getClientAsString } from "./_macro" with { type: "macro" };
import { paramsAtom, routeAtom, ROUTES } from "../feature/router";
import { store } from "../store";
import { assignToWindow } from "../utils/hydration";

export const getStaticHtml = async (
  location: string,
  additionalScripts?: Array<string | Nullish>,
  baseUrl?: string,
): Promise<string> => {
  const { prelude } = await prerender(
    <StaticRouter location={location} basename={baseUrl}>
      <Shell bootstrap additionalScripts={additionalScripts} baseUrl={baseUrl} />
    </StaticRouter>,
  );
  return new Promise((resolve, reject) => {
    let data = "";
    prelude.on("data", (chunk) => {
      data += chunk;
    });
    prelude.on("end", () => resolve(data));
    prelude.on("error", reject);
  });
};

export const doStatic = async (request: Request) => {
  const url = new URL(request.url);
  let response: Response | null = null;
  if (url.pathname === "/favicon.ico") {
    response ??= new Response("KO", { status: 404 });
  }
  if (url.pathname === "/manifest.json") {
    response ??= new Response(JSON.stringify(getManifest(name, description, iconResolutions)), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  const [clientFileContent, css] = await getClientAsString();
  if (url.pathname === clientFile) {
    response ??= new Response(clientFileContent.text, { headers: { "Content-Type": "application/javascript" } });
  }
  if (url.pathname === clientCss) {
    response ??= new Response(css.text, { headers: { "Content-Type": "text/css" } });
  }
  if (response) {
    log("Static", request.url);
  }
  return response;
};

export const doSSR = async (request: Request) => {
  const url = new URL(request.url);
  log("SSR", request.url);
  return new Response(await getStaticHtml(url.pathname), {
    headers: {
      "Content-Type": "text/html",
    },
  });
};

export const doStreamingSSR = async (request: Request) => {
  const url = new URL(request.url);
  log("SSR", request.url);
  const matches = matchRoutes(ROUTES, url.pathname);
  if (matches && matches.length === 1) {
    const [{ route, params }] = matches;
    store.set(routeAtom, route);
    store.set(paramsAtom, params);
  }
  const stream = await renderToReadableStream(
    <StaticRouter location={url.pathname}>
      <Shell additionalScripts={[assignToWindow("REALM", `"SSR"`)]} />
    </StaticRouter>,
    {
      signal: request.signal,
      onError(error: unknown) {
        // Log streaming rendering errors from inside the shell
        console.error(error);
      },
      bootstrapModules: [clientFile],
    },
  );
  await stream.allReady;
  return new Response(stream, {
    headers: {
      "Content-Type": "text/html",
    },
  });
};

export const doPOST = async (request: Request) => {
  if (request.method !== "POST") {
    return null;
  }
  const body = await request.json();
  log(request.method, request.url, body);
  publish(body);
  return new Response("OK");
};

export const doSSE = async (request: Request, server: Server) => {
  if (request.headers.get("accept") !== "text/event-stream") {
    return null;
  }
  log("SSE", request.url);
  server.timeout(request, 1000 * 60 * 60);
  return eventStream(request.signal, (send) => {
    const listener = (data: Update) => {
      log("SSE >>>", data);
      send({ data: JSON.stringify(data) });
    };
    const unsub = subscribe(listener);
    return () => {
      log("SSE closed");
      unsub();
    };
  });
};

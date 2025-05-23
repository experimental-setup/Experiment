import type { Serve } from "bun";
import { debugAtom } from "../atoms/common";
import { localCertAndKeyAtom } from "../atoms/https";
import { clientCss, clientFile, description, hostname, iconResolutions, name, port } from "../const";
import { getManifest } from "../feature/pwa/manifest";
import { store } from "../store";
import { createFetch } from "../utils/handler";
import { log } from "../utils/logger";
import { doPOST, doSSE, doStreamingSSR } from "./_handlers";
import { getClientAsString } from "./_macro" with { type: "macro" };

const tls = (await store.get(localCertAndKeyAtom))
  .map(({ cert, key }) => ({ cert: Bun.file(cert), key: Bun.file(key) }))
  .unwrapOr(undefined);

export default {
  development: store.get(debugAtom),
  hostname,
  port,
  tls,
  fetch: createFetch(
    doSSE,
    doPOST,
    async (request: Request) => {
      const url = new URL(request.url);
      let response: Response | null = null;
      if (url.pathname === "/favicon.ico") {
        response = new Response("KO", { status: 404 });
      }
      if (url.pathname === "/manifest.json") {
        response = new Response(JSON.stringify(getManifest(name, description, iconResolutions)), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      }
      const [clientFileContent, css] = await getClientAsString();
      if (url.pathname === clientFile) {
        return new Response(clientFileContent.text, { headers: { "Content-Type": "application/javascript" } });
      }
      if (url.pathname === clientCss) {
        return new Response(css.text, { headers: { "Content-Type": "text/css" } });
      }
      if (response) {
        log("Static", request.url);
      }
      return response;
    },
    doStreamingSSR,
  ),
} satisfies Serve;

import { Hono } from "hono";
import { cors } from "hono/cors";

import { anything } from "./routes/anything";
import { authentication } from "./routes/authentication";
import { cookies } from "./routes/cookies";
import { dynamicData } from "./routes/dynamic-data";
import { httpMethods } from "./routes/http-methods";
import { images } from "./routes/images";
import { redirects } from "./routes/redirects";
import { requestInspection } from "./routes/request-inspection";
import { responseFormats } from "./routes/response-formats";
import { responseInspection } from "./routes/response-inspection";
import { statusCodes } from "./routes/status-codes";
import spec from "./spec.json";
import { prettyJSON } from "./utils/pretty-json";

const app = new Hono();

// CORS on every response so browsers can call httpbin from any page.
// Like httpbin, the request's Origin is echoed (or "*") with credentials allowed.
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L214
app.use(
	cors({
		origin: (origin) => origin || "*",
		credentials: true,
		maxAge: 3600,
	}),
);
app.use(prettyJSON);

app.get("/spec.json", (c) => {
	const { host, protocol } = new URL(c.req.url);

	// Copy instead of mutating the module-level spec shared across requests
	return c.json(
		{ ...spec, host, schemes: [protocol.replace(":", "")] },
		{ headers: { "Cache-Control": "public, max-age=604800" } },
	);
});

app.route("/", httpMethods);
app.route("/", statusCodes);
app.route("/", requestInspection);
app.route("/", responseFormats);
app.route("/", responseInspection);
app.route("/", authentication);
app.route("/", dynamicData);
app.route("/", cookies);
app.route("/", redirects);
app.route("/", anything);
app.route("/", images);

export default app;

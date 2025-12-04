import { Hono } from "hono";

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
import { default as spec } from "./spec.json";
import { prettyJSON } from "./utils/pretty-json";

const app = new Hono();

app.use(prettyJSON);

app.get("/spec.json", async (c) => {
	spec.host = new URL(c.req.url).host;
	spec.schemes =
		new URL(c.req.url).protocol === "https:" ? ["https"] : ["http"];

	return c.json(spec, {
		headers: {
			"Cache-Control": "public, max-age=604800",
		},
	});
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

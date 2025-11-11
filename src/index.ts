import { swaggerUI } from "@hono/swagger-ui";
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

const app = new Hono();

// Root endpoint
app.get("/", swaggerUI({ url: "/spec.json" }));

// Register route handlers
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

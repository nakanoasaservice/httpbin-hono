import { Hono } from "hono";

export const authentication = new Hono();

// GET /basic-auth/:user/:passwd
authentication.get("/basic-auth/:user/:passwd", async (c) => {
	const user = c.req.param("user");
	const passwd = c.req.param("passwd");

	const authHeader = c.req.header("authorization");

	if (!authHeader || !authHeader.startsWith("Basic ")) {
		c.header("WWW-Authenticate", 'Basic realm="Fake Realm"');
		return c.body(null, 401);
	}

	const credentials = atob(authHeader.substring(6));
	const [providedUser, providedPasswd] = credentials.split(":");

	if (providedUser !== user || providedPasswd !== passwd) {
		c.header("WWW-Authenticate", 'Basic realm="Fake Realm"');
		return c.body(null, 401);
	}

	return c.json({
		authenticated: true,
		user: user,
	});
});

// GET /bearer
authentication.get("/bearer", (c) => {
	const authHeader = c.req.header("authorization");

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		c.header("WWW-Authenticate", "Bearer");
		return c.body(null, 401);
	}

	const token = authHeader.substring(7);

	return c.json({
		authenticated: true,
		token: token,
	});
});

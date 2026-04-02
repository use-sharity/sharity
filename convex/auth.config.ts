const CLERK_ISSUER_URL = process.env.CLERK_ISSUER_URL;
if (!CLERK_ISSUER_URL) {
	throw new Error(
		"Missing CLERK_ISSUER_URL. Set it in your Convex environment (not just Next.js).",
	);
}

const config = {
	providers: [
		{
			domain: CLERK_ISSUER_URL,
			applicationID: "convex",
		},
	],
};

export default config;

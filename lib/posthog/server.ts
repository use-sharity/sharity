import { PostHog, type EventMessage } from "posthog-node";

function getRequiredEnvVar(value: string | undefined, key: string): string {
	if (!value) {
		throw new Error(`Missing required PostHog environment variable: ${key}`);
	}

	return value;
}

export function createPostHogServerClient(): PostHog {
	const token = getRequiredEnvVar(
		process.env.NEXT_PUBLIC_POSTHOG_TOKEN,
		"NEXT_PUBLIC_POSTHOG_TOKEN",
	);
	const host = getRequiredEnvVar(
		process.env.NEXT_PUBLIC_POSTHOG_HOST,
		"NEXT_PUBLIC_POSTHOG_HOST",
	);

	return new PostHog(token, {
		host,
		flushAt: 1,
		flushInterval: 0,
	});
}

export async function withPostHogServerClient<T>(
	handler: (client: PostHog) => Promise<T>,
): Promise<T> {
	const client = createPostHogServerClient();

	try {
		return await handler(client);
	} finally {
		await client.shutdown();
	}
}

type ServerCaptureMessage = EventMessage & { distinctId: string };
type AllFlagsResult = Awaited<ReturnType<PostHog["getAllFlags"]>>;

export async function captureAndShutdown(
	message: ServerCaptureMessage,
): Promise<void> {
	await withPostHogServerClient(async (client) => {
		client.capture(message);
	});
}

export async function getAllFlagsAndShutdown(
	distinctId: string,
): Promise<AllFlagsResult> {
	return withPostHogServerClient(async (client) => {
		return client.getAllFlags(distinctId);
	});
}

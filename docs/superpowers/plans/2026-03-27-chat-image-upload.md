# Chat Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users attach images in the Sharry chat widget — the LLM sees them via vision, and `createItem` attaches them to new item listings via Cloudinary.

**Architecture:** Images are uploaded to Cloudinary client-side on attach (same `useCloudinaryUpload` hook as the item form). Cloudinary URLs are sent to the LLM as `FileUIPart` for vision. `CloudinaryRef[]` are embedded in the message content as a `__IMAGE_REFS__` sentinel string — this means refs persist in message history (including Convex-saved messages for authed users), multi-turn works automatically, and the server stays stateless. The API route strips sentinel text before the LLM sees it, and extracts refs from all messages for the `createItem` tool.

**Tech Stack:** AI SDK `useChat` + `sendMessage`, `@imaxis/cloudinary-convex` Cloudinary upload hook, Convex mutations, Claude Haiku 4.5 vision.

**Spec:** `docs/superpowers/specs/2026-03-27-chat-image-upload-design.md`

---

### Task 1: System Prompt + Tool Description Updates

Small, safe changes with no UI or logic dependencies. Sets the foundation for the LLM to understand image support.

**Files:**
- Modify: `lib/sharry-prompt.ts:80` (remove "never mention images" line)
- Modify: `lib/sharry-prompt.ts:84-92` (add image guidance to "Taking actions")
- Modify: `lib/sharry-mutation-tools.ts:107-108` (update createItem tool description)

- [ ] **Step 1: Remove the "never mention images" line from the system prompt**

In `lib/sharry-prompt.ts`, line 80, delete this line:
```
- Never mention photos or images — the chat cannot display them.
```

- [ ] **Step 2: Add image guidance to the "Taking actions" section**

In `lib/sharry-prompt.ts`, after the line about `createItem` (line 90), replace:
```
- For createItem, collect name, description, and category through conversation. Note: photos and location must be added via the app afterward.
```
with:
```
- For createItem, collect name, description, and category through conversation first. Note: location must be added via the app afterward. If the user attached images, set useAttachedImages to true.
- Users can attach images in chat. You can see them and describe what's in them. When creating an item with createItem, if the user attached images, set useAttachedImages to true to include them in the listing. Remind the user they can add more photos later in the app.
```

- [ ] **Step 3: Update the createItem tool description**

In `lib/sharry-mutation-tools.ts`, line 107-108, change the `description` from:
```ts
"Create a new item listing. Collect name, description, and category through conversation first. Note: photos and location must be added via the app afterward.",
```
to:
```ts
"Create a new item listing. Collect name, description, and category through conversation first. Note: location must be added via the app afterward. If the user attached images, set useAttachedImages to true.",
```

- [ ] **Step 4: Verify the dev server still compiles**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use 20 && pnpm build --no-lint 2>&1 | tail -5`
Expected: Build succeeds (or dev server shows no errors).

- [ ] **Step 5: Commit**

```bash
git add lib/sharry-prompt.ts lib/sharry-mutation-tools.ts
git commit -m "feat(chat): update system prompt and tool description for image support"
```

---

### Task 2: API Route — Extract Image Refs + Strip Sentinel

Add the server-side logic to extract `CloudinaryRef[]` from `__IMAGE_REFS__` sentinel strings in messages, strip them before the LLM sees them, and pass refs to tools.

**Files:**
- Modify: `app/api/chat/route.ts` (add extraction/stripping logic, pass refs to buildTools)
- Modify: `lib/sharry-tools.ts:22` (add third parameter)
- Modify: `lib/sharry-tools.ts:322` (pass through to buildMutationTools)
- Modify: `lib/sharry-mutation-tools.ts:104` (add third parameter)
- Modify: `lib/sharry-mutation-tools.ts:106-148` (update createItem schema + handler)

- [ ] **Step 1: Add image ref extraction and stripping to the API route**

In `app/api/chat/route.ts`, after line 17 (`const isAuthed = !!token;`), add a helper and extraction logic. Place it before the `ConvexHttpClient` creation:

```ts
// Extract CloudinaryRefs from __IMAGE_REFS__ sentinels in message history
const IMAGE_REFS_PREFIX = "__IMAGE_REFS__";

function extractAndStripImageRefs(messages: any[]): {
	cleaned: any[];
	imageRefs: Array<{ publicId: string; secureUrl: string }>;
} {
	const imageRefs: Array<{ publicId: string; secureUrl: string }> = [];
	const cleaned = messages.map((msg: any) => {
		if (msg.role !== "user" || !Array.isArray(msg.parts)) return msg;
		const filteredParts = msg.parts.filter((part: any) => {
			if (part.type === "text" && typeof part.text === "string" && part.text.startsWith(IMAGE_REFS_PREFIX)) {
				try {
					const refs = JSON.parse(part.text.slice(IMAGE_REFS_PREFIX.length));
					imageRefs.push(...refs);
				} catch { /* ignore malformed */ }
				return false; // strip this part
			}
			return true;
		});
		return { ...msg, parts: filteredParts };
	});
	return { cleaned, imageRefs };
}
```

Then, right after `const { messages, locale } = await request.json();` (line 13), add:

```ts
const { cleaned: cleanedMessages, imageRefs: attachedImageRefs } =
	extractAndStripImageRefs(messages);
```

Update the `convertToModelMessages` call to use `cleanedMessages`:
```ts
const modelMessages = await convertToModelMessages(cleanedMessages);
```

And update the `buildTools` call:
```ts
const tools = buildTools(convex, locale, attachedImageRefs);
```

- [ ] **Step 2: Update `buildTools` signature in `lib/sharry-tools.ts`**

At the top of `lib/sharry-tools.ts`, add import (place with other type imports):
```ts
import type { CloudinaryRef } from "@/lib/cloudinary-ref";
```

Change line 22:
```ts
export function buildTools(convex: ConvexHttpClient, locale: string) {
```
to:
```ts
export function buildTools(convex: ConvexHttpClient, locale: string, attachedImageRefs: CloudinaryRef[] = []) {
```

Change line 322:
```ts
...buildMutationTools(convex, locale),
```
to:
```ts
...buildMutationTools(convex, locale, attachedImageRefs),
```

- [ ] **Step 3: Update `buildMutationTools` signature in `lib/sharry-mutation-tools.ts`**

At the top, add import (place with other type imports):
```ts
import type { CloudinaryRef } from "@/lib/cloudinary-ref";
```

Change line 104:
```ts
export function buildMutationTools(convex: ConvexHttpClient, locale: string) {
```
to:
```ts
export function buildMutationTools(convex: ConvexHttpClient, locale: string, attachedImageRefs: CloudinaryRef[] = []) {
```

- [ ] **Step 4: Add `useAttachedImages` to `createItem` input schema**

In `lib/sharry-mutation-tools.ts`, update the `createItem` tool's `inputSchema` (around line 109-123). Add `useAttachedImages` to the type parameter and properties:

```ts
inputSchema: jsonSchema<{
	name: string;
	description?: string;
	category?: string;
	useAttachedImages?: boolean;
}>({
	type: "object",
	properties: {
		name: stringParam("Item name"),
		description: stringParam("Item description"),
		category: stringParam(
			"Category: kitchen, furniture, electronics, clothing, books, sports, other",
		),
		useAttachedImages: {
			type: "boolean" as const,
			description: "Set true to attach the user's images to this item",
		},
	},
	required: ["name"],
}),
```

- [ ] **Step 5: Update `createItem` execute handler to pass image refs**

In `lib/sharry-mutation-tools.ts`, replace the existing execute handler (around line 125-148):

```ts
execute: async ({ name, description, category, useAttachedImages }) => {
	try {
		const imageCloudinary =
			useAttachedImages && attachedImageRefs.length > 0
				? attachedImageRefs
				: undefined;
		await convex.mutation(api.items.create, {
			name,
			description,
			category: category as any,
			imageCloudinary,
		});
		// Resolve the new item to get its ID for a direct link
		const resolved = await convex.query(api.chat.resolveMyItem, {
			itemName: name,
		});
		const itemId = resolved?.found === true ? resolved.itemId : null;
		const link = itemId
			? `/${locale}/item/${itemId}`
			: `/${locale}/my-items`;
		const photoNote = imageCloudinary
			? `${imageCloudinary.length} photo(s) attached.`
			: "No photos attached — add them in the app.";
		return {
			success: `Created "${name}". ${photoNote}`,
			nextStep: `Tell the user to add location if needed. Include this exact link in your response: ${link}`,
		};
	} catch (e: any) {
		return { error: e.message ?? "Could not create item." };
	}
},
```

- [ ] **Step 6: Verify build**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use 20 && pnpm build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/api/chat/route.ts lib/sharry-tools.ts lib/sharry-mutation-tools.ts
git commit -m "feat(chat): extract image refs from sentinel, wire through to createItem tool"
```

---

### Task 3: Chat Widget — Image Attach, Upload, Send with Sentinel

Add the image attachment UI, Cloudinary upload, and sentinel-based send flow to the chat widget. Also restore image parts from persisted messages.

**Files:**
- Modify: `components/chat-widget.tsx` (imports, state, file input, upload logic, preview strip, send flow with sentinel, message rendering, persisted message seeding)

**Reference files** (read for patterns, don't modify):
- `components/item-form.tsx:162-254` — how `useCloudinaryUpload` is used
- `lib/image-constants.ts` — `MAX_IMAGE_SIZE_BYTES`
- `lib/cloudinary-ref.ts` — `toCloudinaryRef`

- [ ] **Step 1: Add new imports**

In `components/chat-widget.tsx`, update imports:

Add `ImagePlus` to the existing Lucide import (line 16):
```ts
import { MessageCircle, X, Send, RotateCcw, ImagePlus } from "lucide-react";
```

Add new imports after the existing ones:
```ts
import { useCloudinaryUpload } from "@imaxis/cloudinary-convex/react";
import { toast } from "sonner";
import { toCloudinaryRef, type CloudinaryRef } from "@/lib/cloudinary-ref";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/image-constants";
```

Note: `api` is already imported on line 17 — don't duplicate.

- [ ] **Step 2: Add state and upload hook**

Inside `ChatWidget()`, after the existing state declarations (around line 69-76), add:

```ts
const [pendingFiles, setPendingFiles] = useState<File[]>([]);
const [uploadedRefs, setUploadedRefs] = useState<CloudinaryRef[]>([]);
const [isUploading, setIsUploading] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
const { upload: uploadToCloudinary } = useCloudinaryUpload(
	api.cloudinary.upload,
);
```

- [ ] **Step 3: Add sentinel constant**

At the top of the file (after imports, before the component), add:

```ts
const IMAGE_REFS_PREFIX = "__IMAGE_REFS__";
```

- [ ] **Step 4: Update persisted message seeding to restore image parts**

Replace the seeding logic (around lines 142-154) to restore file parts from sentinel strings:

```ts
// Seed persisted messages once on first load
useEffect(() => {
	if (hasSeeded.current) return;
	if (!persistedMessages) return;
	hasSeeded.current = true;
	if (persistedMessages.length === 0) return;
	const seeded = persistedMessages.map((m, i) => {
		const parts: Array<{ type: string; text?: string; mediaType?: string; url?: string }> = [];
		// Check if content contains image refs sentinel
		const content = m.content;
		const sentinelIdx = content.indexOf(IMAGE_REFS_PREFIX);
		if (sentinelIdx !== -1) {
			const textBefore = content.slice(0, sentinelIdx).trim();
			if (textBefore) parts.push({ type: "text", text: textBefore });
			try {
				const refs: CloudinaryRef[] = JSON.parse(content.slice(sentinelIdx + IMAGE_REFS_PREFIX.length));
				for (const ref of refs) {
					parts.push({ type: "file", mediaType: "image/jpeg", url: ref.secureUrl });
				}
				// Re-add sentinel as text part so it stays in message history for the API route
				parts.push({ type: "text", text: content.slice(sentinelIdx) });
			} catch {
				parts.push({ type: "text", text: content });
			}
		} else {
			parts.push({ type: "text", text: content });
		}
		return {
			id: `persisted-${i}`,
			role: m.role as "user" | "assistant",
			parts,
		};
	});
	setMessages(seeded);
	lastSavedIndexRef.current = seeded.length;
}, [persistedMessages, setMessages]);
```

- [ ] **Step 5: Add file selection handler**

After `handleClearChat` (around line 252), add:

```ts
const handleFileSelect = useCallback(
	async (e: React.ChangeEvent<HTMLInputElement>) => {
		const selected = Array.from(e.target.files ?? []);
		e.target.value = "";

		const remaining = 5 - pendingFiles.length;
		if (remaining <= 0) {
			toast.error("Maximum 5 images per message");
			return;
		}

		const valid: File[] = [];
		for (const file of selected.slice(0, remaining)) {
			if (file.size > MAX_IMAGE_SIZE_BYTES) {
				toast.error(`${file.name} is too large (max 12 MB)`);
				continue;
			}
			valid.push(file);
		}
		if (valid.length === 0) return;

		setPendingFiles((prev) => [...prev, ...valid]);
		setIsUploading(true);

		const newRefs: CloudinaryRef[] = [];
		for (const file of valid) {
			try {
				const result = (await uploadToCloudinary(file, {
					folder: "items",
					tags: ["items"],
				})) as unknown;
				newRefs.push(toCloudinaryRef(result));
			} catch {
				toast.error(`Failed to upload ${file.name}`);
				setPendingFiles((prev) => prev.filter((f) => f !== file));
			}
		}

		setUploadedRefs((prev) => [...prev, ...newRefs]);
		setIsUploading(false);
	},
	[pendingFiles.length, uploadToCloudinary],
);

const handleRemoveFile = useCallback((index: number) => {
	setPendingFiles((prev) => prev.filter((_, i) => i !== index));
	setUploadedRefs((prev) => prev.filter((_, i) => i !== index));
}, []);
```

- [ ] **Step 6: Update `handleSubmit` to include images with sentinel**

Replace the existing `handleSubmit` (lines 227-237):

```ts
const handleSubmit = useCallback(
	(e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = input.trim();
		if ((!trimmed && uploadedRefs.length === 0) || isLoading || isUploading)
			return;

		const files: Array<{
			type: "file";
			mediaType: string;
			url: string;
		}> = uploadedRefs.map((ref, i) => ({
			type: "file" as const,
			mediaType: pendingFiles[i]?.type ?? "image/jpeg",
			url: ref.secureUrl,
		}));

		// Build content string with sentinel for persistence + API extraction
		const textContent = trimmed || (files.length > 0 ? "" : "");
		const sentinel = uploadedRefs.length > 0
			? `\n${IMAGE_REFS_PREFIX}${JSON.stringify(uploadedRefs)}`
			: "";
		const fullContent = `${textContent}${sentinel}`.trim();

		if (files.length > 0) {
			sendMessage({
				text: fullContent || "Attached image(s)",
				files,
			});
		} else {
			sendMessage({ text: fullContent });
		}

		if (isSignedIn && fullContent) {
			saveMessage({ role: "user", content: fullContent });
		}
		setInput("");
		setPendingFiles([]);
		setUploadedRefs([]);
	},
	[
		input,
		isLoading,
		isUploading,
		isSignedIn,
		sendMessage,
		saveMessage,
		uploadedRefs,
		pendingFiles,
	],
);
```

Key: the sentinel string `__IMAGE_REFS__[...]` is appended to the message text. It gets:
- Saved to Convex (persistence across reloads)
- Sent to the API route in message history (multi-turn)
- Stripped by the API route before the LLM sees it

- [ ] **Step 7: Update `getMessageText` to strip sentinel from display**

Replace the existing `getMessageText` function (lines 53-61):

```ts
function getMessageText(message: {
	parts?: Array<{ type: string; text?: string }>;
}): string {
	if (!message.parts) return "";
	return message.parts
		.filter((p) => p.type === "text" && p.text && !p.text.startsWith(IMAGE_REFS_PREFIX))
		.map((p) => p.text ?? "")
		.join("\n");
}
```

This ensures the sentinel JSON is never shown in the UI.

- [ ] **Step 8: Add image preview strip and attach button to the form**

Replace the form JSX (around lines 576-607):

```tsx
<form
	onSubmit={handleSubmit}
	className="px-4 py-3"
	style={{ borderTop: "1px solid var(--border)" }}
>
	{/* Image preview strip */}
	{pendingFiles.length > 0 && (
		<div className="mb-2 flex gap-1.5 overflow-x-auto">
			{pendingFiles.map((file, i) => (
				<div key={i} className="relative shrink-0">
					<img
						src={URL.createObjectURL(file)}
						alt={file.name}
						className="h-10 w-10 rounded-md border object-cover"
					/>
					{isUploading && i >= uploadedRefs.length && (
						<div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40">
							<div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
						</div>
					)}
					<button
						type="button"
						onClick={() => handleRemoveFile(i)}
						className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
					>
						<X className="h-2.5 w-2.5" />
					</button>
				</div>
			))}
		</div>
	)}

	<input
		ref={fileInputRef}
		type="file"
		accept="image/*"
		multiple
		className="hidden"
		onChange={handleFileSelect}
	/>

	<div className="flex gap-2">
		{isSignedIn && (
			<button
				type="button"
				onClick={() => fileInputRef.current?.click()}
				disabled={isLoading || pendingFiles.length >= 5}
				className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-40"
				aria-label="Attach image"
			>
				<ImagePlus
					className="h-4 w-4"
					style={{ color: "var(--muted-foreground)" }}
				/>
			</button>
		)}
		<input
			ref={inputRef}
			type="text"
			value={input}
			onChange={(e) => setInput(e.target.value)}
			placeholder="Ask Sharry anything..."
			disabled={isLoading}
			className="flex-1 rounded-full px-4 py-2 text-sm outline-none"
			style={{
				backgroundColor: "var(--primary-foreground)",
				color: "var(--foreground)",
			}}
		/>
		<button
			type="submit"
			disabled={
				(!input.trim() && uploadedRefs.length === 0) ||
				isLoading ||
				isUploading
			}
			className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
			style={{ backgroundColor: "var(--primary)" }}
		>
			<Send
				className="h-4 w-4"
				style={{ color: "var(--primary-foreground)" }}
			/>
		</button>
	</div>
</form>
```

- [ ] **Step 9: Add image rendering in message bubbles**

In the message rendering loop (around line 456), where `part.type === "text"` is handled, add handling for file parts and skip sentinel text parts. After the existing text part check:

```tsx
// Skip sentinel text parts
if (part.type === "text" && part.text?.startsWith(IMAGE_REFS_PREFIX)) {
	return null;
}
if (part.type === "file" && "url" in part) {
	return (
		<img
			key={idx}
			src={(part as any).url}
			alt="Attached"
			className="mt-1 max-h-[120px] rounded-md object-cover"
		/>
	);
}
```

- [ ] **Step 10: Verify the dev server compiles and renders**

Run the dev server, open the chat widget. Verify:
- Image button appears (when signed in)
- Image button is hidden (when signed out)
- No console errors

- [ ] **Step 11: Commit**

```bash
git add components/chat-widget.tsx
git commit -m "feat(chat): add image attachment with Cloudinary upload, sentinel persistence, and preview"
```

---

### Task 4: Manual End-to-End Testing

No code changes — verify the full flow works.

- [ ] **Step 1: Vision test**

1. Open the chat widget (signed in).
2. Attach an image of a household item.
3. Type "What is this?" and send.
4. Verify the LLM describes the image accurately.
5. Verify the image thumbnail shows in the user's chat bubble.

- [ ] **Step 2: createItem with image test**

1. Attach an image.
2. Type "List this as a kitchen item called Blender" and send.
3. Verify the LLM calls `createItem` with `useAttachedImages: true`.
4. Approve the tool call.
5. Go to My Items — verify the item exists with the image.

- [ ] **Step 3: Multi-turn test**

1. Attach an image in message 1, ask "What category is this?"
2. LLM responds with a suggestion.
3. In message 2 (no new image), say "OK create it as that".
4. Verify the LLM calls `createItem` with `useAttachedImages: true` and the image from message 1 is attached.

This works because the sentinel from message 1 is in the conversation history, and the API route extracts refs from ALL user messages.

- [ ] **Step 4: Persistence test**

1. Attach an image and send a message.
2. Reload the page.
3. Open the chat widget — verify the image thumbnail appears in the restored conversation.
4. Send a new message asking to create an item with the previously attached image.
5. Verify it works (refs are in the persisted message content via sentinel).

- [ ] **Step 5: Edge cases**

1. Attach image > 12 MB — verify toast error.
2. Attach 6 images — verify only 5 accepted.
3. Send text-only message — verify no regressions, no sentinel in display.
4. Open chat while signed out — verify no image button.
5. Clear chat — verify images are gone from the conversation.

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(chat): address issues found during image upload testing"
```

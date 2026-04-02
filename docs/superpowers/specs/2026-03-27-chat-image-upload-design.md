# Chat Image Upload for createItem

## Summary

Allow users to attach images in the Sharry chat widget. Images are uploaded to Cloudinary client-side on attach (same `useCloudinaryUpload` hook as the item form), then Cloudinary URLs are sent to the LLM as `FileUIPart` for vision. `CloudinaryRef[]` are embedded in the message content as a `__IMAGE_REFS__` sentinel string — this means refs persist in message history (including Convex-saved messages for authed users), multi-turn works automatically, and the server stays stateless. The API route strips sentinel text before the LLM sees them, and extracts refs from all user messages for the `createItem` tool.

Scope: `createItem` only. The same pattern can be extended to other mutation tools later.

## Chat Widget (`components/chat-widget.tsx`)

### New state

- `pendingFiles: File[]` — files selected but not yet sent (max 5)
- `uploadedRefs: CloudinaryRef[]` — Cloudinary refs for uploaded files, parallel to `pendingFiles`
- `isUploading: boolean` — true while Cloudinary uploads are in progress

### UI changes

- **Image button** — an image/paperclip icon button to the left of the text input, visible only for signed-in users. Opens a hidden `<input type="file" accept="image/*" multiple>`.
- **Preview strip** — when files are selected, a row of small thumbnails (40x40, `object-cover`) above the input bar. Each thumbnail has an X button to remove it. Loading spinner overlay while uploading.
- **Size validation** — reuse `MAX_IMAGE_SIZE_BYTES` (12 MB) from `lib/image-constants.ts`. Reject oversized files with a toast.
- **File count** — max 5 images per message, matching the item form.
- **Disabled state** — send button disabled while `isUploading`.

### Upload flow

On file selection (not on send):

1. Validate file size against `MAX_IMAGE_SIZE_BYTES`.
2. Add files to `pendingFiles`, set `isUploading = true`.
3. Upload each file to Cloudinary via `useCloudinaryUpload(api.cloudinary.upload)` with `folder: "items"`, `tags: ["items"]`.
4. Store resulting `CloudinaryRef` in `uploadedRefs`.
5. Set `isUploading = false`.
6. If any upload fails, show toast error and remove that file from `pendingFiles`.

### Send flow

On submit:

1. Build `FileUIPart[]` from `uploadedRefs` using `file.type` from the original `File` for `mediaType`.
2. Append `__IMAGE_REFS__` sentinel with JSON-encoded `CloudinaryRef[]` to the text content.
3. Call `sendMessage({ text: contentWithSentinel, files })`.
4. Save the full content string (including sentinel) to Convex via `saveMessage` — this persists refs across page reloads.
5. Clear `pendingFiles` and `uploadedRefs`.

### Message rendering

- `getMessageText()` filters out sentinel text parts so they never display.
- File parts (`part.type === "file"`) render as small thumbnails (max-height 120px) in the chat bubble.
- Sentinel text parts are skipped in the rendering loop.

### Persisted message restoration

When seeding from `persistedMessages`, parse sentinel strings in `content` to restore file parts:
- Split content at `__IMAGE_REFS__`
- Text before becomes a text part
- Parsed refs become file parts (using `secureUrl`)
- Sentinel itself is kept as a hidden text part so it stays in message history for the API route

## API Route (`app/api/chat/route.ts`)

### Image ref extraction + stripping

A helper function `extractAndStripImageRefs(messages)` iterates all user messages:
- Finds text parts starting with `__IMAGE_REFS__`
- Parses the JSON to collect `CloudinaryRef[]`
- Strips those parts from the messages

Returns `{ cleaned, imageRefs }`. Pass `cleaned` to `convertToModelMessages` (LLM never sees sentinel JSON). Pass `imageRefs` to `buildTools`.

### Vision

`convertToModelMessages()` converts `FileUIPart` with Cloudinary URLs to model file parts. Claude fetches images via URL for vision. No changes needed.

## Tools

### `lib/sharry-tools.ts`

`buildTools(convex, locale, attachedImageRefs)` — new third parameter, passes through to `buildMutationTools`.

### `lib/sharry-mutation-tools.ts`

`buildMutationTools(convex, locale, attachedImageRefs)` — new third parameter of type `CloudinaryRef[]`.

**`createItem` tool changes:**

- Updated description: "Note: location must be added via the app afterward. If the user attached images, set useAttachedImages to true."
- New `useAttachedImages?: boolean` in input schema.
- Execute handler: when `useAttachedImages && attachedImageRefs.length > 0`, pass `imageCloudinary: attachedImageRefs` to `api.items.create`.

## System Prompt (`lib/sharry-prompt.ts`)

1. **Remove** "Never mention photos or images — the chat cannot display them."
2. **Replace** createItem guidance with: "Note: location must be added via the app afterward. If the user attached images, set useAttachedImages to true."
3. **Add** "Users can attach images in chat. You can see them and describe what's in them. When creating an item with createItem, if the user attached images, set useAttachedImages to true to include them in the listing. Remind the user they can add more photos later in the app."

## Error Handling

- File too large: toast in chat widget, file not added.
- Cloudinary upload fails on attach: toast error, file removed, user can retry.
- `createItem` with `useAttachedImages` but no refs: creates item without images, includes note to add photos in app.
- Invalid file type: `accept="image/*"` prevents non-images.
- Unauthenticated user: image button hidden (only shown when `isSignedIn`).

## Testing

- Vision: attach image, ask "what is this?" — LLM describes it.
- Create with image: attach image, ask to create item — item created with image.
- Multi-turn: attach image in msg 1, say "create it" in msg 3 — works via sentinel in history.
- Persistence: reload page — image thumbnails restored from persisted messages.
- Text-only: no regressions, no sentinel visible.
- Edge: >12 MB rejected, >5 images rejected, signed-out hides button.

## Files Changed

1. `components/chat-widget.tsx` — image button, preview strip, Cloudinary upload, sentinel in send flow, image rendering, persisted message restoration
2. `app/api/chat/route.ts` — extract and strip `__IMAGE_REFS__` from messages, pass refs to buildTools
3. `lib/sharry-tools.ts` — pass attachedImageRefs through to buildMutationTools
4. `lib/sharry-mutation-tools.ts` — accept attachedImageRefs, pass to api.items.create in createItem tool
5. `lib/sharry-prompt.ts` — remove "never mention images" line, add image support guidance, update createItem guidance

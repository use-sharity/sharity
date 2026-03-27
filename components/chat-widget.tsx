"use client";

import { useAuth } from "@clerk/nextjs";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMutation, useQuery } from "convex/react";
import { useLocale } from "next-intl";
import React, {
	useRef,
	useEffect,
	useState,
	useCallback,
	useMemo,
} from "react";
import Markdown from "react-markdown";
import { MessageCircle, X, Send, RotateCcw, ImagePlus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ToolApprovalCard } from "@/components/tool-approval-card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCloudinaryUpload } from "@imaxis/cloudinary-convex/react";
import { toast } from "sonner";
import { toCloudinaryRef, type CloudinaryRef } from "@/lib/cloudinary-ref";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/image-constants";

const IMAGE_REFS_PREFIX = "__IMAGE_REFS__";

const SUGGESTIONS_BY_STAGE: Record<string, string[]> = {
	new_user: [
		"How do I share an item?",
		"How does fostering work?",
		"What is Sharity?",
	],
	has_items_no_activity: [
		"How can I improve my listings?",
		"How does fostering work?",
		"Where are my items?",
	],
	has_pending_claims: [
		"How do I approve a request?",
		"What happens after approval?",
		"How do I contact a neighbor?",
	],
	active_user: [
		"How do I return an item?",
		"How do ratings work?",
		"How does the calendar work?",
	],
	logged_out: [
		"What is Sharity?",
		"How does sharing work?",
		"How do I sign up?",
	],
};

function getMessageText(message: {
	parts?: Array<{ type: string; text?: string }>;
}): string {
	if (!message.parts) return "";
	return message.parts
		.filter(
			(p) =>
				p.type === "text" && p.text && !p.text.startsWith(IMAGE_REFS_PREFIX),
		)
		.map((p) => p.text ?? "")
		.join("\n");
}

function renderMessageContent(text: string) {
	return <Markdown>{text}</Markdown>;
}

export function ChatWidget() {
	const [isOpen, setIsOpen] = useState(false);
	const [input, setInput] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const persistedMessages = useQuery(api.chat.getMessages);
	const saveMessage = useMutation(api.chat.saveMessage);
	const clearMessages = useMutation(api.chat.clearMessages);
	const hasSeeded = useRef(false);
	const lastSavedIndexRef = useRef(0);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const [uploadedRefs, setUploadedRefs] = useState<CloudinaryRef[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { upload: uploadToCloudinary } = useCloudinaryUpload(
		api.cloudinary.upload,
	);

	const locale = useLocale();
	const userContext = useQuery(api.chat.getUserContext);

	const localeRef = useRef(locale);
	localeRef.current = locale;
	const { getToken, isSignedIn } = useAuth();
	const getTokenRef = useRef(getToken);
	getTokenRef.current = getToken;

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/chat",
				fetch: async (url, init) => {
					const body = JSON.parse((init?.body as string) ?? "{}");
					body.locale = localeRef.current;
					// Truncate to last 50 messages to keep LLM context bounded
					if (Array.isArray(body.messages) && body.messages.length > 50) {
						body.messages = body.messages.slice(-50);
					}
					const token = await getTokenRef.current({ template: "convex" });
					return fetch(url, {
						...init,
						body: JSON.stringify(body),
						headers: {
							...Object.fromEntries(new Headers(init?.headers).entries()),
							...(token ? { Authorization: `Bearer ${token}` } : {}),
						},
					});
				},
			}),
		[],
	);

	const {
		messages,
		sendMessage,
		status,
		error,
		addToolApprovalResponse,
		setMessages,
	} = useChat({
		transport,
		// Only auto-send when the user has responded to all approval requests.
		// This pauses on approval-requested (shows Approve/Deny card),
		// and resumes after the user clicks (state becomes approval-responded).
		sendAutomaticallyWhen: ({ messages: msgs }) => {
			const last = msgs[msgs.length - 1];
			if (last?.role !== "assistant") return false;
			const hasPendingApproval = last.parts?.some(
				(p: any) => "state" in p && p.state === "approval-requested",
			);
			if (hasPendingApproval) return false;
			// Auto-send when all approvals are responded to
			const hasRespondedApproval = last.parts?.some(
				(p: any) => "state" in p && p.state === "approval-responded",
			);
			return !!hasRespondedApproval;
		},
	});

	const isLoading = status === "submitted" || status === "streaming";

	// Seed persisted messages once on first load
	useEffect(() => {
		if (hasSeeded.current) return;
		if (!persistedMessages) return;
		hasSeeded.current = true;
		if (persistedMessages.length === 0) return;
		const seeded = persistedMessages.map((m, i) => {
			const parts: Array<
				| { type: "text"; text: string }
				| { type: "file"; mediaType: string; url: string }
			> = [];
			const content = m.content;
			const sentinelIdx = content.indexOf(IMAGE_REFS_PREFIX);
			if (sentinelIdx !== -1) {
				const textBefore = content.slice(0, sentinelIdx).trim();
				if (textBefore) parts.push({ type: "text" as const, text: textBefore });
				try {
					const refs: CloudinaryRef[] = JSON.parse(
						content.slice(sentinelIdx + IMAGE_REFS_PREFIX.length),
					);
					for (const ref of refs) {
						parts.push({
							type: "file" as const,
							mediaType: "image/jpeg",
							url: ref.secureUrl,
						});
					}
					// Re-add sentinel as text part so it stays in message history for the API route
					parts.push({
						type: "text" as const,
						text: content.slice(sentinelIdx),
					});
				} catch {
					parts.push({ type: "text" as const, text: content });
				}
			} else {
				parts.push({ type: "text" as const, text: content });
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

	// Save assistant messages when streaming completes (authed users only)
	useEffect(() => {
		if (!isSignedIn || status !== "ready") return;
		// Find new assistant messages since last save
		for (let i = lastSavedIndexRef.current; i < messages.length; i++) {
			const msg = messages[i];
			if (msg.role === "assistant") {
				const text = getMessageText(msg);
				if (text) {
					saveMessage({ role: "assistant", content: text });
				}
			}
		}
		lastSavedIndexRef.current = messages.length;
	}, [isSignedIn, status, messages, saveMessage]);

	const scrollToBottom = useCallback((instant?: boolean) => {
		messagesEndRef.current?.scrollIntoView({
			behavior: instant ? "instant" : "smooth",
		});
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, scrollToBottom]);

	useEffect(() => {
		if (isOpen) {
			// Use instant scroll + slight delay to ensure messages are rendered
			setTimeout(() => scrollToBottom(true), 50);
			inputRef.current?.focus();
		}
	}, [isOpen, scrollToBottom]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) setIsOpen(false);
			// Auto-focus chat input when typing with chat open,
			// but only if the user isn't already focused on another input
			const active = document.activeElement;
			const isTypingElsewhere =
				active instanceof HTMLInputElement ||
				active instanceof HTMLTextAreaElement ||
				active instanceof HTMLSelectElement ||
				active?.getAttribute("contenteditable") === "true";
			if (
				isOpen &&
				e.key.length === 1 &&
				!e.metaKey &&
				!e.ctrlKey &&
				!isTypingElsewhere &&
				active !== inputRef.current
			) {
				inputRef.current?.focus();
				setInput((prev) => prev + e.key);
				e.preventDefault();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen]);

	const stage = useMemo(
		() =>
			userContext?.stage ??
			(userContext === null ? "logged_out" : "active_user"),
		[userContext],
	);
	const suggestions =
		SUGGESTIONS_BY_STAGE[stage] ?? SUGGESTIONS_BY_STAGE.active_user;

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

			const textContent = trimmed || (files.length > 0 ? "" : "");
			const sentinel =
				uploadedRefs.length > 0
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

	const handleSuggestionClick = useCallback(
		(text: string) => {
			sendMessage({ text });
			if (isSignedIn) saveMessage({ role: "user", content: text });
		},
		[isSignedIn, sendMessage, saveMessage],
	);

	const handleClearChat = useCallback(async () => {
		await clearMessages();
		setMessages([]);
		hasSeeded.current = true;
		lastSavedIndexRef.current = 0;
	}, [clearMessages, setMessages]);

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

	return (
		<>
			{/* Floating bubble */}
			{!isOpen && (
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="fixed right-4 bottom-20 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 sm:right-6 sm:bottom-6"
					style={{ backgroundColor: "var(--primary)" }}
					aria-label="Open chat with Sharry"
				>
					<MessageCircle
						className="h-5 w-5"
						style={{ color: "var(--primary-foreground)" }}
					/>
				</button>
			)}

			{/* Chat panel */}
			{isOpen && (
				<div
					role="dialog"
					aria-label="Chat with Sharry"
					className="fixed inset-0 z-50 flex flex-col sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[520px] sm:w-[400px] sm:rounded-xl sm:border sm:shadow-lg"
					style={{
						backgroundColor: "rgba(255, 255, 255, 0.97)",
						backdropFilter: "blur(12px)",
						borderColor: "var(--border)",
					}}
				>
					{/* Header */}
					<div
						className="flex items-center justify-between px-4 py-3"
						style={{ borderBottom: "1px solid var(--border)" }}
					>
						<div className="flex items-center gap-2">
							<div
								className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
								style={{
									backgroundColor: "var(--primary)",
									color: "var(--primary-foreground)",
								}}
							>
								S
							</div>
							<span
								className="font-semibold"
								style={{ color: "var(--foreground)" }}
							>
								Sharry
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										onClick={handleClearChat}
										aria-label="New chat"
										className="rounded-md p-1 transition-colors hover:bg-black/5"
									>
										<RotateCcw
											className="h-3.5 w-3.5"
											style={{ color: "var(--muted-foreground)" }}
										/>
									</button>
								</TooltipTrigger>
								<TooltipContent side="bottom">New chat</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										onClick={() => setIsOpen(false)}
										aria-label="Close chat"
										className="rounded-md p-1 transition-colors hover:bg-black/5"
									>
										<X
											className="h-4 w-4"
											style={{ color: "var(--muted-foreground)" }}
										/>
									</button>
								</TooltipTrigger>
								<TooltipContent side="bottom">Close</TooltipContent>
							</Tooltip>
						</div>
					</div>

					{/* Messages */}
					<div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
						{messages.length === 0 && (
							<>
								{/* Welcome message */}
								<div className="mb-4 flex gap-2">
									<div
										className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
										style={{
											backgroundColor: "var(--primary)",
											color: "var(--primary-foreground)",
										}}
									>
										S
									</div>
									<div
										className="rounded-lg rounded-tl-none px-3 py-2 text-sm"
										style={{
											backgroundColor: "var(--primary-foreground)",
											color: "var(--foreground)",
											lineHeight: "1.5",
										}}
									>
										Hey 👋 I&apos;m Sharry. I can help you find items, answer
										questions, approve requests, or manage your listings.
										What&apos;s on your mind?
									</div>
								</div>

								{/* Suggestions */}
								<div className="ml-8 flex flex-wrap gap-1.5">
									{suggestions.map((s) => (
										<button
											key={s}
											type="button"
											onClick={() => handleSuggestionClick(s)}
											className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-gray-50"
											style={{
												borderColor: "var(--border)",
												color: "var(--primary)",
											}}
										>
											{s}
										</button>
									))}
								</div>
							</>
						)}

						{messages.map((message) => {
							const text = getMessageText(message);
							return (
								<div
									key={message.id}
									className={`mb-3 flex ${message.role === "user" ? "justify-end" : "gap-2"}`}
								>
									{message.role === "assistant" && (
										<div
											className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
											style={{
												backgroundColor: "var(--primary)",
												color: "var(--primary-foreground)",
											}}
										>
											S
										</div>
									)}
									<div
										className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
											message.role === "user"
												? "rounded-tr-none"
												: "rounded-tl-none"
										}`}
										style={{
											...(message.role === "user"
												? {
														whiteSpace: "pre-wrap" as const,
														backgroundColor: "var(--primary)",
														color: "var(--primary-foreground)",
													}
												: {
														backgroundColor: "var(--primary-foreground)",
														color: "var(--foreground)",
													}),
										}}
									>
										{(() => {
											const hasContent = message.parts?.some(
												(p) =>
													(p.type === "text" && p.text) ||
													p.type === "file" ||
													("state" in p && p.state === "approval-requested"),
											);
											if (!hasContent) {
												return (
													<span
														className="inline-flex items-center gap-1"
														style={{ color: "var(--muted-foreground)" }}
													>
														<span className="animate-pulse">●</span>
														<span
															className="animate-pulse"
															style={{ animationDelay: "0.2s" }}
														>
															●
														</span>
														<span
															className="animate-pulse"
															style={{ animationDelay: "0.4s" }}
														>
															●
														</span>
													</span>
												);
											}
											return message.parts?.map((part, idx) => {
												// Skip sentinel text parts
												if (
													part.type === "text" &&
													part.text?.startsWith(IMAGE_REFS_PREFIX)
												) {
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
												if (part.type === "text" && part.text) {
													return (
														<div
															key={idx}
															className={
																message.role === "assistant"
																	? "chat-markdown"
																	: undefined
															}
														>
															{renderMessageContent(part.text)}
														</div>
													);
												}
												if (
													"state" in part &&
													part.state === "approval-requested" &&
													"approval" in part
												) {
													const toolName = part.type.replace("tool-", "");
													return (
														<ToolApprovalCard
															key={idx}
															toolName={toolName}
															input={(part as any).input}
															approvalId={(part as any).approval.id}
															onApprove={(id) =>
																addToolApprovalResponse({ id, approved: true })
															}
															onDeny={(id) =>
																addToolApprovalResponse({
																	id,
																	approved: false,
																	reason: "User denied",
																})
															}
														/>
													);
												}
												return null;
											});
										})()}
									</div>
								</div>
							);
						})}

						{isLoading &&
							!messages.some(
								(m) =>
									m.role === "assistant" &&
									!m.parts?.some((p) => p.type === "text" && p.text),
							) && (
								<div className="mb-3 flex gap-2">
									<div
										className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
										style={{
											backgroundColor: "var(--primary)",
											color: "var(--primary-foreground)",
										}}
									>
										S
									</div>
									<div
										className="rounded-lg rounded-tl-none px-3 py-2 text-sm"
										style={{
											backgroundColor: "var(--primary-foreground)",
											color: "var(--foreground)",
										}}
									>
										<span
											className="inline-flex items-center gap-1"
											style={{ color: "var(--muted-foreground)" }}
										>
											<span className="animate-pulse">●</span>
											<span
												className="animate-pulse"
												style={{ animationDelay: "0.2s" }}
											>
												●
											</span>
											<span
												className="animate-pulse"
												style={{ animationDelay: "0.4s" }}
											>
												●
											</span>
										</span>
									</div>
								</div>
							)}

						{error && (
							<div className="mb-3 flex gap-2">
								<div
									className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
									style={{
										backgroundColor: "var(--primary)",
										color: "var(--primary-foreground)",
									}}
								>
									S
								</div>
								<div
									className="rounded-lg rounded-tl-none px-3 py-2 text-sm"
									style={{
										backgroundColor: "var(--primary-foreground)",
										color: "var(--foreground)",
									}}
								>
									Sharry is taking a break — try again in a moment.
								</div>
							</div>
						)}

						<div ref={messagesEndRef} />
					</div>

					{/* Input */}
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
				</div>
			)}
		</>
	);
}

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
import { MessageCircle, X, Send, RotateCcw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ToolApprovalCard } from "@/components/tool-approval-card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

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
		.filter((p) => p.type === "text")
		.map((p) => p.text ?? "")
		.join("\n");
}

function renderMessageContent(text: string) {
	return (
		<Markdown
			components={{
				a: ({ href, children }) => (
					<a
						href={href}
						style={{ color: "#2D4A35", textDecoration: "underline" }}
					>
						{children}
					</a>
				),
			}}
		>
			{text}
		</Markdown>
	);
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
		const seeded = persistedMessages.map((m, i) => ({
			id: `persisted-${i}`,
			role: m.role as "user" | "assistant",
			parts: [{ type: "text" as const, text: m.content }],
		}));
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

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, scrollToBottom]);

	useEffect(() => {
		if (isOpen) inputRef.current?.focus();
	}, [isOpen]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) setIsOpen(false);
			// Auto-focus input when typing with chat open
			if (
				isOpen &&
				e.key.length === 1 &&
				!e.metaKey &&
				!e.ctrlKey &&
				document.activeElement !== inputRef.current
			) {
				inputRef.current?.focus();
				// Append the character that triggered the focus
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
			if (!trimmed || isLoading) return;
			sendMessage({ text: trimmed });
			if (isSignedIn) saveMessage({ role: "user", content: trimmed });
			setInput("");
		},
		[input, isLoading, isSignedIn, sendMessage, saveMessage],
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

	return (
		<>
			{/* Floating bubble */}
			{!isOpen && (
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="fixed right-4 bottom-20 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 sm:right-6 sm:bottom-6"
					style={{ backgroundColor: "#2D4A35" }}
					aria-label="Open chat with Sharry"
				>
					<MessageCircle className="h-5 w-5" style={{ color: "#F0EBE0" }} />
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
						borderColor: "#E0D9CE",
					}}
				>
					{/* Header */}
					<div
						className="flex items-center justify-between px-4 py-3"
						style={{ borderBottom: "1px solid #E0D9CE" }}
					>
						<div className="flex items-center gap-2">
							<div
								className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
								style={{ backgroundColor: "#2D4A35", color: "#F0EBE0" }}
							>
								S
							</div>
							<span className="font-semibold" style={{ color: "#1C1C1A" }}>
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
											style={{ color: "#7A7570" }}
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
										<X className="h-4 w-4" style={{ color: "#7A7570" }} />
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
											backgroundColor: "#2D4A35",
											color: "#F0EBE0",
										}}
									>
										S
									</div>
									<div
										className="rounded-lg rounded-tl-none px-3 py-2 text-sm"
										style={{
											backgroundColor: "#F0EBE0",
											color: "#1C1C1A",
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
												borderColor: "#E0D9CE",
												color: "#2D4A35",
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
												backgroundColor: "#2D4A35",
												color: "#F0EBE0",
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
														backgroundColor: "#2D4A35",
														color: "#F0EBE0",
													}
												: {
														backgroundColor: "#F0EBE0",
														color: "#1C1C1A",
													}),
										}}
									>
										{(() => {
											const hasContent = message.parts?.some(
												(p) =>
													(p.type === "text" && p.text) ||
													("state" in p && p.state === "approval-requested"),
											);
											if (!hasContent) {
												return (
													<span
														className="inline-flex items-center gap-1"
														style={{ color: "#7A7570" }}
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
											backgroundColor: "#2D4A35",
											color: "#F0EBE0",
										}}
									>
										S
									</div>
									<div
										className="rounded-lg rounded-tl-none px-3 py-2 text-sm"
										style={{
											backgroundColor: "#F0EBE0",
											color: "#1C1C1A",
										}}
									>
										<span
											className="inline-flex items-center gap-1"
											style={{ color: "#7A7570" }}
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
										backgroundColor: "#2D4A35",
										color: "#F0EBE0",
									}}
								>
									S
								</div>
								<div
									className="rounded-lg rounded-tl-none px-3 py-2 text-sm"
									style={{
										backgroundColor: "#F0EBE0",
										color: "#1C1C1A",
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
						style={{ borderTop: "1px solid #E0D9CE" }}
					>
						<div className="flex gap-2">
							<input
								ref={inputRef}
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="Ask Sharry anything..."
								disabled={isLoading}
								className="flex-1 rounded-full px-4 py-2 text-sm outline-none"
								style={{
									backgroundColor: "#F0EBE0",
									color: "#1C1C1A",
								}}
							/>
							<button
								type="submit"
								disabled={!input.trim() || isLoading}
								className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
								style={{ backgroundColor: "#2D4A35" }}
							>
								<Send className="h-4 w-4" style={{ color: "#F0EBE0" }} />
							</button>
						</div>
					</form>
				</div>
			)}
		</>
	);
}

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

const WELCOME_MESSAGE: Record<string, string> = {
	en: "Hey \u{1F44B} I'm Sharry. I can help you find items, answer questions, approve requests, or manage your listings. What's on your mind?",
	vi: "Xin ch\u00E0o \u{1F44B} M\u00ECnh l\u00E0 Sharry. M\u00ECnh c\u00F3 th\u1EC3 gi\u00FAp b\u1EA1n t\u00ECm \u0111\u1ED3, tr\u1EA3 l\u1EDDi c\u00E2u h\u1ECFi, duy\u1EC7t y\u00EAu c\u1EA7u ho\u1EB7c qu\u1EA3n l\u00FD danh s\u00E1ch c\u1EE7a b\u1EA1n. B\u1EA1n c\u1EA7n g\u00EC?",
	ru: "\u041F\u0440\u0438\u0432\u0435\u0442 \u{1F44B} \u042F Sharry. \u041C\u043E\u0433\u0443 \u043F\u043E\u043C\u043E\u0447\u044C \u043D\u0430\u0439\u0442\u0438 \u0432\u0435\u0449\u0438, \u043E\u0442\u0432\u0435\u0442\u0438\u0442\u044C \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441\u044B, \u043E\u0434\u043E\u0431\u0440\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0438 \u0438\u043B\u0438 \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u0432\u0430\u0448\u0438\u043C\u0438 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F\u043C\u0438. \u0427\u0435\u043C \u043F\u043E\u043C\u043E\u0447\u044C?",
};

const AI_DISCLAIMER: Record<string, string> = {
	en: "Sharry is an AI assistant and can make mistakes.",
	vi: "Sharry l\u00E0 tr\u1EE3 l\u00FD AI v\u00E0 c\u00F3 th\u1EC3 m\u1EAFc l\u1ED7i.",
	ru: "Sharry \u2014 \u044D\u0442\u043E \u0418\u0418-\u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043D\u0442 \u0438 \u043C\u043E\u0436\u0435\u0442 \u043E\u0448\u0438\u0431\u0430\u0442\u044C\u0441\u044F.",
};

const SUGGESTIONS_BY_STAGE: Record<string, Record<string, string[]>> = {
	new_user: {
		en: [
			"I want to share something",
			"Find me something to borrow",
			"What is Sharity?",
		],
		vi: [
			"T\u00F4i mu\u1ED1n chia s\u1EBB \u0111\u1ED3",
			"T\u00ECm \u0111\u1ED3 m\u01B0\u1EE3n",
			"Sharity l\u00E0 g\u00EC?",
		],
		ru: [
			"\u0425\u043E\u0447\u0443 \u043F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F \u0432\u0435\u0449\u044C\u044E",
			"\u041D\u0430\u0439\u0434\u0438 \u043C\u043D\u0435 \u0447\u0442\u043E-\u043D\u0438\u0431\u0443\u0434\u044C",
			"\u0427\u0442\u043E \u0442\u0430\u043A\u043E\u0435 Sharity?",
		],
	},
	has_items_no_activity: {
		en: ["About Sharity", "Find me something to borrow", "Show my items"],
		vi: [
			"Pro Sharity",
			"T\u00ECm \u0111\u1ED3 m\u01B0\u1EE3n",
			"Xem \u0111\u1ED3 c\u1EE7a t\u00F4i",
		],
		ru: [
			"\u041F\u0440\u043E Sharity",
			"\u041D\u0430\u0439\u0434\u0438 \u043C\u043D\u0435 \u0447\u0442\u043E-\u043D\u0438\u0431\u0443\u0434\u044C",
			"\u041F\u043E\u043A\u0430\u0436\u0438 \u043C\u043E\u0438 \u0432\u0435\u0449\u0438",
		],
	},
	has_pending_claims: {
		en: ["Show my pending requests", "Approve all requests", "Any updates?"],
		vi: [
			"Xem y\u00EAu c\u1EA7u ch\u1EDD duy\u1EC7t",
			"Duy\u1EC7t t\u1EA5t c\u1EA3",
			"C\u00F3 g\u00EC m\u1EDBi kh\u00F4ng?",
		],
		ru: [
			"\u041F\u043E\u043A\u0430\u0436\u0438 \u0437\u0430\u044F\u0432\u043A\u0438",
			"\u041E\u0434\u043E\u0431\u0440\u0438\u0442\u044C \u0432\u0441\u0435",
			"\u0415\u0441\u0442\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F?",
		],
	},
	active_user: {
		en: ["Any updates?", "Find me something to borrow", "About Sharity"],
		vi: [
			"C\u00F3 g\u00EC m\u1EDBi kh\u00F4ng?",
			"T\u00ECm \u0111\u1ED3 m\u01B0\u1EE3n",
			"Pro Sharity",
		],
		ru: [
			"\u0415\u0441\u0442\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F?",
			"\u041D\u0430\u0439\u0434\u0438 \u043C\u043D\u0435 \u0447\u0442\u043E-\u043D\u0438\u0431\u0443\u0434\u044C",
			"\u041F\u0440\u043E Sharity",
		],
	},
	logged_out: {
		en: ["What is Sharity?", "How does sharing work?", "How do I sign up?"],
		vi: [
			"Sharity l\u00E0 g\u00EC?",
			"Chia s\u1EBB ho\u1EA1t \u0111\u1ED9ng ra sao?",
			"L\u00E0m sao \u0111\u0103ng k\u00FD?",
		],
		ru: [
			"\u0427\u0442\u043E \u0442\u0430\u043A\u043E\u0435 Sharity?",
			"\u041A\u0430\u043A \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0448\u0435\u0440\u0438\u043D\u0433?",
			"\u041A\u0430\u043A \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F?",
		],
	},
};

function getMessageText(message: {
	parts?: Array<{ type: string; text?: string }>;
}): string {
	if (!message.parts) return "";
	return message.parts
		.filter((p) => p.type === "text" && p.text)
		.map((p) => {
			const text = p.text ?? "";
			const idx = text.indexOf(IMAGE_REFS_PREFIX);
			return idx >= 0 ? text.slice(0, idx).trim() : text;
		})
		.filter(Boolean)
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
	const [previewUrls, setPreviewUrls] = useState<string[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);
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

	// Save messages when streaming completes (authed users only).
	// Track which message IDs we've saved to avoid duplicates but allow
	// re-saving when a message gets updated (e.g. after tool approval).
	const savedContentRef = useRef<Map<string, string>>(new Map());

	useEffect(() => {
		if (!isSignedIn || status !== "ready") return;
		for (const msg of messages) {
			const text = getMessageText(msg);
			if (!text) continue;
			// Skip seeded messages — they're already in the DB
			if (msg.id.startsWith("persisted-")) continue;
			// Only save if content is new or changed (tool result added after approval)
			const prev = savedContentRef.current.get(msg.id);
			if (prev === text) continue;
			savedContentRef.current.set(msg.id, text);
			// Skip user messages — they're saved in handleSubmit
			if (msg.role === "user") continue;
			saveMessage({ role: "assistant", content: text });
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

	// Resize chat panel to visual viewport on iOS when keyboard opens/closes
	useEffect(() => {
		const vv = window.visualViewport;
		const panel = panelRef.current;
		if (!vv || !panel || !isOpen) return;
		const onResize = () => {
			// Only apply on mobile (sm breakpoint = 640px)
			if (window.innerWidth >= 640) return;
			panel.style.height = `${vv.height}px`;
			panel.style.top = `${vv.offsetTop}px`;
			// Scroll to bottom after keyboard resize so latest message is visible
			setTimeout(() => scrollToBottom(true), 50);
		};
		onResize();
		vv.addEventListener("resize", onResize);
		vv.addEventListener("scroll", onResize);
		return () => {
			vv.removeEventListener("resize", onResize);
			vv.removeEventListener("scroll", onResize);
			panel.style.height = "";
			panel.style.top = "";
		};
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
	const stageData =
		SUGGESTIONS_BY_STAGE[stage] ?? SUGGESTIONS_BY_STAGE.active_user;
	const suggestions = stageData[locale] ?? stageData.en;
	const welcomeText = WELCOME_MESSAGE[locale] ?? WELCOME_MESSAGE.en;
	const disclaimerText = AI_DISCLAIMER[locale] ?? AI_DISCLAIMER.en;

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

			const textContent = trimmed;
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
			previewUrls.forEach(URL.revokeObjectURL);
			setPreviewUrls([]);
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
			previewUrls,
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
		previewUrls.forEach(URL.revokeObjectURL);
		if (isSignedIn) {
			try {
				await clearMessages();
			} catch {
				/* ignore if not authed */
			}
		}
		setMessages([]);
		setPendingFiles([]);
		setUploadedRefs([]);
		setPreviewUrls([]);
		setIsUploading(false);
		savedContentRef.current.clear();
		hasSeeded.current = true;
		lastSavedIndexRef.current = 0;
	}, [clearMessages, setMessages, previewUrls, isSignedIn]);

	const processFiles = useCallback(
		async (selected: File[]) => {
			const remaining = 5 - pendingFiles.length;
			if (remaining <= 0) {
				toast.error("Maximum 5 images per message");
				return;
			}

			const valid: File[] = [];
			for (const file of selected.slice(0, remaining)) {
				if (!file.type.startsWith("image/")) continue;
				if (file.size > MAX_IMAGE_SIZE_BYTES) {
					toast.error(`${file.name} is too large (max 12 MB)`);
					continue;
				}
				valid.push(file);
			}
			if (valid.length === 0) return;

			const urls = valid.map((f) => URL.createObjectURL(f));
			setPendingFiles((prev) => [...prev, ...valid]);
			setPreviewUrls((prev) => [...prev, ...urls]);
			setIsUploading(true);

			const newRefs: (CloudinaryRef | null)[] = [];
			for (const file of valid) {
				try {
					const result = (await uploadToCloudinary(file, {
						folder: "items",
						tags: ["items"],
					})) as unknown;
					newRefs.push(toCloudinaryRef(result));
				} catch {
					toast.error(`Failed to upload ${file.name}`);
					newRefs.push(null);
				}
			}

			// Remove failed uploads and their corresponding files/urls
			const failedIndices = new Set(
				newRefs.map((r, i) => (r === null ? i : -1)).filter((i) => i >= 0),
			);
			if (failedIndices.size > 0) {
				const offset = pendingFiles.length;
				setPendingFiles((prev) =>
					prev.filter((_, i) => i < offset || !failedIndices.has(i - offset)),
				);
				setPreviewUrls((prev) => {
					const result = prev.filter(
						(_, i) => i < offset || !failedIndices.has(i - offset),
					);
					failedIndices.forEach((fi) => URL.revokeObjectURL(urls[fi]));
					return result;
				});
			}

			const successRefs = newRefs.filter((r): r is CloudinaryRef => r !== null);
			setUploadedRefs((prev) => [...prev, ...successRefs]);
			setIsUploading(false);
		},
		[pendingFiles.length, uploadToCloudinary],
	);

	const handleFileSelect = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const selected = Array.from(e.target.files ?? []);
			e.target.value = "";
			await processFiles(selected);
		},
		[processFiles],
	);

	const handleRemoveFile = useCallback(
		(index: number) => {
			URL.revokeObjectURL(previewUrls[index]);
			setPendingFiles((prev) => prev.filter((_, i) => i !== index));
			setUploadedRefs((prev) => prev.filter((_, i) => i !== index));
			setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
		},
		[previewUrls],
	);

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			if (isSignedIn) setIsDragOver(true);
		},
		[isSignedIn],
	);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		// Only hide overlay when leaving the chat panel, not its children
		if (e.currentTarget.contains(e.relatedTarget as Node)) return;
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
			if (!isSignedIn) return;
			const files = Array.from(e.dataTransfer.files);
			if (files.length > 0) await processFiles(files);
		},
		[isSignedIn, processFiles],
	);

	return (
		<>
			{/* Floating bubble */}
			{!isOpen && (
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="fixed right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 sm:right-6 sm:bottom-6"
					style={{
						backgroundColor: "var(--primary)",
						// On mobile when signed in, sit above the tab bar; otherwise
						// just respect the bottom safe-area (home indicator / URL bar).
						bottom: isSignedIn
							? "calc(5rem + env(safe-area-inset-bottom))"
							: "calc(1.5rem + env(safe-area-inset-bottom))",
					}}
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
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					ref={panelRef}
					className="fixed inset-0 z-50 flex flex-col sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[520px] sm:w-[400px] sm:rounded-xl sm:border sm:shadow-lg"
					style={{
						backgroundColor: "rgba(255, 255, 255, 0.97)",
						backdropFilter: "blur(12px)",
						borderColor: "var(--border)",
						WebkitTapHighlightColor: "transparent",
					}}
				>
					{/* Drag overlay */}
					{isDragOver && isSignedIn && (
						<div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
							<div
								className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-8 py-6"
								style={{
									borderColor: "var(--primary)",
									color: "var(--primary)",
								}}
							>
								<ImagePlus className="h-8 w-8" />
								<span className="text-sm font-medium">Drop image here</span>
							</div>
						</div>
					)}

					{/* Header */}
					<div
						className="flex items-center justify-between px-4 py-3"
						style={{ borderBottom: "1px solid var(--border)" }}
					>
						<div className="flex items-center gap-2">
							<div
								className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold sm:h-7 sm:w-7 sm:text-xs"
								style={{
									backgroundColor: "var(--primary)",
									color: "var(--primary-foreground)",
								}}
							>
								S
							</div>
							<span
								className="text-lg font-semibold sm:text-base"
								style={{ color: "var(--foreground)" }}
							>
								Sharry
							</span>
						</div>
						<div className="flex items-center gap-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										onClick={handleClearChat}
										aria-label="New chat"
										className="rounded-md p-2.5 transition-colors hover:bg-black/5 sm:p-1"
									>
										<RotateCcw
											className="h-4 w-4 sm:h-3.5 sm:w-3.5"
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
										className="rounded-md p-2.5 transition-colors hover:bg-black/5 sm:p-1"
									>
										<X
											className="h-5 w-5 sm:h-4 sm:w-4"
											style={{ color: "var(--muted-foreground)" }}
										/>
									</button>
								</TooltipTrigger>
								<TooltipContent side="bottom">Close</TooltipContent>
							</Tooltip>
						</div>
					</div>

					{/* Messages */}
					<div
						className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
						aria-live="polite"
					>
						{messages.length === 0 && (
							<>
								{/* Welcome message */}
								<div className="mb-4 flex gap-2">
									<div
										className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-6 sm:w-6 sm:text-[9px]"
										style={{
											backgroundColor: "var(--primary)",
											color: "var(--primary-foreground)",
										}}
									>
										S
									</div>
									<div
										className="rounded-lg rounded-tl-none px-3 py-2 text-base sm:text-sm"
										style={{
											backgroundColor: "var(--primary-foreground)",
											color: "var(--foreground)",
											lineHeight: "1.5",
										}}
									>
										{welcomeText}
									</div>
								</div>

								{/* Suggestions */}
								<div className="ml-8 flex flex-wrap gap-1.5">
									{suggestions.map((s) => (
										<button
											key={s}
											type="button"
											onClick={() => handleSuggestionClick(s)}
											className="rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 sm:text-xs"
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
							return (
								<div
									key={message.id}
									className={`mb-3 flex ${message.role === "user" ? "justify-end" : "gap-2"}`}
								>
									{message.role === "assistant" && (
										<div
											className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-6 sm:w-6 sm:text-[9px]"
											style={{
												backgroundColor: "var(--primary)",
												color: "var(--primary-foreground)",
											}}
										>
											S
										</div>
									)}
									<div
										className={`max-w-[85%] rounded-lg px-3 py-2 text-base sm:text-sm ${
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
													// Strip sentinel from display
													const sentinelIdx =
														part.text.indexOf(IMAGE_REFS_PREFIX);
													const displayText =
														sentinelIdx >= 0
															? part.text.slice(0, sentinelIdx).trim()
															: part.text;
													if (!displayText) return null;
													return (
														<div
															key={idx}
															className={
																message.role === "assistant"
																	? "chat-markdown"
																	: undefined
															}
														>
															{renderMessageContent(displayText)}
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
										className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-6 sm:w-6 sm:text-[9px]"
										style={{
											backgroundColor: "var(--primary)",
											color: "var(--primary-foreground)",
										}}
									>
										S
									</div>
									<div
										className="rounded-lg rounded-tl-none px-3 py-2 text-base sm:text-sm"
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
									className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-6 sm:w-6 sm:text-[9px]"
									style={{
										backgroundColor: "var(--primary)",
										color: "var(--primary-foreground)",
									}}
								>
									S
								</div>
								<div
									className="rounded-lg rounded-tl-none px-3 py-2 text-base sm:text-sm"
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
											src={previewUrls[i]}
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

						<div className="flex items-center gap-2">
							{isSignedIn && (
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									disabled={isLoading || pendingFiles.length >= 5}
									className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-40 sm:h-9 sm:w-9"
									aria-label="Attach image"
								>
									<ImagePlus
										className="h-5 w-5 sm:h-4 sm:w-4"
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
								className="h-10 flex-1 rounded-full px-4 text-base outline-none sm:h-9 sm:text-sm"
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
								className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
								style={{ backgroundColor: "var(--primary)" }}
							>
								<Send
									className="h-4 w-4"
									style={{ color: "var(--primary-foreground)" }}
								/>
							</button>
						</div>
					</form>
					<p
						className="px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center text-xs sm:pb-2 sm:text-[10px]"
						style={{ color: "var(--muted-foreground)" }}
					>
						{disclaimerText}
					</p>
				</div>
			)}
		</>
	);
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";

import { AddItemForm } from "@/components/add-item-form";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";

interface ShareItemSheetProps {
	variant?: "header" | "fab" | "tab" | "prompt";
}

export function ShareItemSheet({ variant = "header" }: ShareItemSheetProps) {
	const [open, setOpen] = useState(false);
	const t = useTranslations("Home");
	const router = useRouter();

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{variant === "prompt" ? (
				<button
					onClick={() => setOpen(true)}
					type="button"
					className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-[#2d6a5e]/20 hover:bg-[#2d6a5e]/25 transition-colors"
				>
					<Plus className="h-5 w-5 text-[#1a4a3f]" />
					<span className="text-sm font-semibold text-[#1a4a3f]">
						{t("sharePrompt")}
					</span>
				</button>
			) : variant === "tab" ? (
				<button
					onClick={() => setOpen(true)}
					type="button"
					className="flex flex-col items-center gap-1 px-3 pt-2 pb-1.5 text-muted-foreground transition-colors"
				>
					<span className="flex items-center justify-center h-6 w-6 rounded-md border-2 border-current">
						<Plus className="h-4 w-4 stroke-[2.5]" />
					</span>
					<span className="text-[11px] leading-none font-medium">
						{t("shareLabel")}
					</span>
				</button>
			) : variant === "fab" ? (
				<Button
					onClick={() => setOpen(true)}
					variant="outline"
					size="sm"
					className="w-full gap-1.5"
				>
					<Plus className="h-4 w-4" />
					{t("shareButton")}
				</Button>
			) : (
				<Button onClick={() => setOpen(true)} size="sm" className="gap-1">
					<Plus className="h-4 w-4" />
					{t("shareLabel")}
				</Button>
			)}

			<DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t("shareButton")}</DialogTitle>
					<DialogDescription className="sr-only">
						{t("shareButton")}
					</DialogDescription>
				</DialogHeader>
				<AddItemForm
					hideMyItemsLink
					onSuccess={(itemId) => {
						if (itemId) {
							router.push(`/item/${itemId}`);
						}
						setOpen(false);
					}}
				/>
			</DialogContent>
		</Dialog>
	);
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

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
	variant?: "header" | "fab" | "tab";
}

export function ShareItemSheet({ variant = "header" }: ShareItemSheetProps) {
	const [open, setOpen] = useState(false);
	const t = useTranslations("Home");

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{variant === "header" ? (
				<Button
					onClick={() => setOpen(true)}
					variant="outline"
					size="sm"
					className="gap-1.5"
				>
					<Plus className="h-4 w-4" />
					{t("shareButton")}
				</Button>
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
			) : (
				<Button
					onClick={() => setOpen(true)}
					variant="outline"
					size="sm"
					className="w-full gap-1.5"
				>
					<Plus className="h-4 w-4" />
					{t("shareButton")}
				</Button>
			)}

			<DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t("shareButton")}</DialogTitle>
					<DialogDescription className="sr-only">
						{t("shareButton")}
					</DialogDescription>
				</DialogHeader>
				<AddItemForm hideMyItemsLink onSuccess={() => setOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}

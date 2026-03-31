"use client";

import { useState } from "react";
import { Gift, Plus } from "lucide-react";
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
	variant?: "header" | "fab";
}

export function ShareItemSheet({ variant = "header" }: ShareItemSheetProps) {
	const [open, setOpen] = useState(false);
	const t = useTranslations("Home");

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{variant === "header" ? (
				<>
					{/* Desktop: icon + text */}
					<Button
						onClick={() => setOpen(true)}
						variant="ghost"
						size="sm"
						className="hidden md:inline-flex"
					>
						<Gift className="h-4 w-4 mr-1" />
						{t("shareButton")}
					</Button>
					{/* Mobile: icon only */}
					<Button
						onClick={() => setOpen(true)}
						variant="ghost"
						size="icon"
						className="md:hidden"
					>
						<Gift className="h-4 w-4" />
						<span className="sr-only">{t("shareButton")}</span>
					</Button>
				</>
			) : (
				<Button
					onClick={() => setOpen(true)}
					size="icon"
					className="md:hidden fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg"
				>
					<Plus className="h-6 w-6" />
					<span className="sr-only">{t("shareButton")}</span>
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

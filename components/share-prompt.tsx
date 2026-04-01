"use client";

import { ShareItemSheet } from "@/components/share-item-sheet";

export function SharePrompt() {
	return (
		<div className="hidden md:block">
			<ShareItemSheet variant="prompt" />
		</div>
	);
}

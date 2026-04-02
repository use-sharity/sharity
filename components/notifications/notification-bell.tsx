"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { NotificationFeed } from "./notification-feed";
import { useState, useEffect } from "react";

function useIsMobile() {
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		const check = () => setIsMobile(window.innerWidth < 768);
		check();
		window.addEventListener("resize", check);
		return () => window.removeEventListener("resize", check);
	}, []);
	return isMobile;
}

export function NotificationBell() {
	const notifications = useQuery(api.notifications.get);
	const [mounted, setMounted] = useState(false);
	const [open, setOpen] = useState(false);
	const isMobile = useIsMobile();

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setMounted(true);
	}, []);

	const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

	const bellButton = (
		<Button
			variant="ghost"
			size="icon"
			className="relative"
			onClick={isMobile ? () => setOpen(true) : undefined}
		>
			<Bell className="h-5 w-5" />
			{mounted && unreadCount > 0 && (
				<span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
			)}
			<span className="sr-only">Notifications</span>
		</Button>
	);

	if (isMobile) {
		return (
			<>
				{bellButton}
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogContent className="max-w-md max-h-[80vh] p-0 gap-0 flex flex-col overflow-hidden">
						<DialogTitle className="sr-only">Notifications</DialogTitle>
						<NotificationFeed />
					</DialogContent>
				</Dialog>
			</>
		);
	}

	return (
		<Popover>
			<PopoverTrigger asChild>{bellButton}</PopoverTrigger>
			<PopoverContent
				className="w-96 max-h-[400px] p-0 rounded-xl overflow-hidden flex flex-col"
				align="end"
				collisionPadding={16}
			>
				<NotificationFeed />
			</PopoverContent>
		</Popover>
	);
}

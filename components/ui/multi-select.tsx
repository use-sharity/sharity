"use client";

import * as React from "react";
import { CheckIcon, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

export interface MultiSelectOption {
	label: string;
	value: string;
}

interface MultiSelectProps {
	options: MultiSelectOption[];
	selected: string[];
	onChange: (values: string[]) => void;
	placeholder?: string;
	className?: string;
}

export function MultiSelect({
	options,
	selected,
	onChange,
	placeholder = "Select...",
	className,
}: MultiSelectProps) {
	const [open, setOpen] = React.useState(false);

	const handleToggle = (value: string) => {
		if (selected.includes(value)) {
			onChange(selected.filter((v) => v !== value));
		} else {
			onChange([...selected, value]);
		}
	};

	const handleRemove = (value: string, e: React.MouseEvent) => {
		e.stopPropagation();
		onChange(selected.filter((v) => v !== value));
	};

	const handleClearAll = (e: React.MouseEvent) => {
		e.stopPropagation();
		onChange([]);
	};

	const selectedLabels = selected.map(
		(v) => options.find((o) => o.value === v)?.label ?? v,
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs ring-offset-background",
						"hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						"disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
				>
					<div className="flex flex-wrap gap-1 flex-1">
						{selected.length === 0 ? (
							<span className="text-muted-foreground">{placeholder}</span>
						) : (
							selectedLabels.map((label, i) => (
								<Badge
									key={selected[i]}
									variant="secondary"
									className="text-xs px-1.5 py-0 h-5 gap-0.5"
								>
									{label}
									<span
										role="button"
										tabIndex={0}
										className="ml-0.5 rounded-full outline-none hover:bg-foreground/20 cursor-pointer"
										onPointerDown={(e) => handleRemove(selected[i], e)}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												handleRemove(
													selected[i],
													e as unknown as React.MouseEvent,
												);
											}
										}}
									>
										<X className="h-3 w-3" />
									</span>
								</Badge>
							))
						)}
					</div>
					<div className="flex items-center gap-1 ml-2 shrink-0">
						{selected.length > 0 && (
							<span
								role="button"
								tabIndex={0}
								className="rounded-full p-0.5 hover:bg-foreground/20 cursor-pointer"
								onPointerDown={handleClearAll}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										handleClearAll(e as unknown as React.MouseEvent);
									}
								}}
							>
								<X className="h-3.5 w-3.5 text-muted-foreground" />
							</span>
						)}
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					</div>
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[var(--radix-popover-trigger-width)] p-1"
				align="start"
			>
				<div className="flex flex-col">
					{options.map((option) => {
						const isSelected = selected.includes(option.value);
						return (
							<button
								key={option.value}
								type="button"
								className={cn(
									"flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer outline-none",
									"hover:bg-accent hover:text-accent-foreground",
									isSelected && "font-medium",
								)}
								onClick={() => handleToggle(option.value)}
							>
								<div
									className={cn(
										"flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
										isSelected
											? "bg-primary border-primary text-primary-foreground"
											: "border-muted-foreground/40",
									)}
								>
									{isSelected && <CheckIcon className="h-3 w-3" />}
								</div>
								{option.label}
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, HandHeart, ListChecks, RotateCcw, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
	Carousel,
	type CarouselApi,
	CarouselContent,
	CarouselItem,
} from "@/components/ui/carousel";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SlideConfig {
	id: string;
	icon: React.ElementType;
	heroBg: string;
	iconBg: string;
	iconColor: string;
	title: string;
	description: string;
	points: string[];
}

interface OnboardingCarouselProps {
	open: boolean;
	onClose: () => void;
}

export function OnboardingCarousel({ open, onClose }: OnboardingCarouselProps) {
	const t = useTranslations("Home.onboarding");
	const [api, setApi] = useState<CarouselApi>();
	const [activeSlide, setActiveSlide] = useState(0);

	const slides: SlideConfig[] = useMemo(
		() => [
			{
				id: "timeline",
				icon: ListChecks,
				heroBg: "bg-indigo-50",
				iconBg: "bg-indigo-100",
				iconColor: "text-indigo-600",
				title: t("slides.timeline.title"),
				description: t("slides.timeline.description"),
				points: [
					t("slides.timeline.point1"),
					t("slides.timeline.point2"),
					t("slides.timeline.point3"),
				],
			},
			{
				id: "lend",
				icon: HandHeart,
				heroBg: "bg-emerald-50",
				iconBg: "bg-emerald-100",
				iconColor: "text-emerald-600",
				title: t("slides.lend.title"),
				description: t("slides.lend.description"),
				points: [
					t("slides.lend.point1"),
					t("slides.lend.point2"),
					t("slides.lend.point3"),
				],
			},
			{
				id: "borrow",
				icon: Search,
				heroBg: "bg-amber-50",
				iconBg: "bg-amber-100",
				iconColor: "text-amber-600",
				title: t("slides.borrow.title"),
				description: t("slides.borrow.description"),
				points: [
					t("slides.borrow.point1"),
					t("slides.borrow.point2"),
					t("slides.borrow.point3"),
				],
			},
			{
				id: "return",
				icon: RotateCcw,
				heroBg: "bg-violet-50",
				iconBg: "bg-violet-100",
				iconColor: "text-violet-600",
				title: t("slides.return.title"),
				description: t("slides.return.description"),
				points: [
					t("slides.return.point1"),
					t("slides.return.point2"),
					t("slides.return.point3"),
				],
			},
		],
		[t],
	);

	useEffect(() => {
		if (!api) return;

		const onSelect = () => setActiveSlide(api.selectedScrollSnap());
		onSelect();
		api.on("select", onSelect);
		api.on("reInit", onSelect);

		return () => {
			api.off("select", onSelect);
			api.off("reInit", onSelect);
		};
	}, [api]);

	useEffect(() => {
		if (open) {
			setActiveSlide(0);
			api?.scrollTo(0);
		}
	}, [api, open]);

	const isLastSlide = activeSlide === slides.length - 1;

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
			<DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
				{/* Each slide includes its own hero so nothing escapes the carousel */}
				<Carousel setApi={setApi} opts={{ loop: false }} className="overflow-hidden">
					<CarouselContent>
						{slides.map((slide) => (
							<CarouselItem key={slide.id}>
								<div
									className={cn(
										"flex items-center justify-center py-8",
										slide.heroBg,
									)}
								>
									<div
										className={cn(
											"flex h-16 w-16 items-center justify-center rounded-2xl",
											slide.iconBg,
											slide.iconColor,
										)}
									>
										<slide.icon className="h-8 w-8" strokeWidth={1.5} />
									</div>
								</div>
								<div className="flex flex-col gap-3 px-6 py-5">
									<h2 className="text-lg font-semibold leading-snug">
										{slide.title}
									</h2>
									<p className="text-sm text-muted-foreground leading-relaxed">
										{slide.description}
									</p>
									<ul className="mt-1 space-y-2">
										{slide.points.map((point) => (
											<li key={point} className="flex items-start gap-2">
												<Check
													className={cn(
														"mt-0.5 h-4 w-4 shrink-0",
														slide.iconColor,
													)}
													strokeWidth={2.5}
												/>
												<span className="text-sm text-muted-foreground">
													{point}
												</span>
											</li>
										))}
									</ul>
								</div>
							</CarouselItem>
						))}
					</CarouselContent>
				</Carousel>

				{/* Footer */}
				<div className="flex items-center justify-between border-t px-6 py-4">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => api?.scrollPrev()}
						disabled={activeSlide === 0}
					>
						{t("back")}
					</Button>

					<div className="flex items-center gap-1.5">
						{slides.map((slide, index) => (
							<button
								key={slide.id}
								type="button"
								onClick={() => api?.scrollTo(index)}
								aria-label={t("goToSlide", { slide: index + 1 })}
								className={cn(
									"h-1.5 rounded-full transition-all duration-200",
									index === activeSlide
										? "w-4 bg-foreground"
										: "w-1.5 bg-muted-foreground/30",
								)}
							/>
						))}
					</div>

					{isLastSlide ? (
						<Button type="button" size="sm" onClick={onClose}>
							{t("getStarted")}
						</Button>
					) : (
						<Button type="button" size="sm" onClick={() => api?.scrollNext()}>
							{t("next")}
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

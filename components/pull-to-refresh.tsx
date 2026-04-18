"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Custom pull-to-refresh that works when body is fully scroll-locked.
 *
 * Why: iOS Safari couples native PTR with rubber-band overscroll — you can't
 * keep one without the other via CSS alone. We lock the viewport completely
 * (see .scroll-locked in globals.css) and detect the pull gesture by hand.
 *
 * Gesture rules: touch must start near the top of the viewport, be mostly
 * vertical, and exceed THRESHOLD to trigger a reload. Otherwise reset.
 */

const THRESHOLD_PX = 60;
const MAX_PULL_PX = 140;
const DAMPING = 0.7;

export function PullToRefresh() {
	const [pullDistance, setPullDistance] = useState(0);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const startYRef = useRef(0);
	const startXRef = useRef(0);
	const trackingRef = useRef(false);
	const distanceRef = useRef(0);

	useEffect(() => {
		const mql = window.matchMedia("(max-width: 767px)");
		function apply() {
			if (mql.matches) {
				// Reset scroll to 0 BEFORE locking; otherwise the viewport
				// freezes mid-scroll and hides the header.
				window.scrollTo(0, 0);
				document.documentElement.classList.add("scroll-locked");
			} else {
				document.documentElement.classList.remove("scroll-locked");
			}
		}
		apply();
		mql.addEventListener("change", apply);
		return () => {
			mql.removeEventListener("change", apply);
			document.documentElement.classList.remove("scroll-locked");
		};
	}, []);

	useEffect(() => {
		// Pointer events (not touch) so framer-motion's `setPointerCapture`
		// on card drag doesn't swallow our gesture — pointer events still
		// dispatch to document-level listeners even under capture.
		let activePointerId: number | null = null;

		function onPointerDown(e: PointerEvent) {
			if (e.pointerType === "mouse" || isRefreshing) return;
			if (activePointerId !== null) return;
			activePointerId = e.pointerId;
			startYRef.current = e.clientY;
			startXRef.current = e.clientX;
			trackingRef.current = true;
			distanceRef.current = 0;
		}

		function onPointerMove(e: PointerEvent) {
			if (!trackingRef.current || e.pointerId !== activePointerId) return;
			const dy = e.clientY - startYRef.current;
			const dx = Math.abs(e.clientX - startXRef.current);
			if (dy <= 0 || dx > dy) {
				trackingRef.current = false;
				distanceRef.current = 0;
				activePointerId = null;
				setPullDistance(0);
				return;
			}
			const damped = Math.min(dy * DAMPING, MAX_PULL_PX);
			distanceRef.current = damped;
			setPullDistance(damped);
		}

		function onPointerUp(e: PointerEvent) {
			if (e.pointerId !== activePointerId) return;
			activePointerId = null;
			if (!trackingRef.current) return;
			trackingRef.current = false;
			if (distanceRef.current >= THRESHOLD_PX) {
				setIsRefreshing(true);
				window.location.reload();
			} else {
				distanceRef.current = 0;
				setPullDistance(0);
			}
		}

		const opts = { passive: true, capture: true } as const;
		document.addEventListener("pointerdown", onPointerDown, opts);
		document.addEventListener("pointermove", onPointerMove, opts);
		document.addEventListener("pointerup", onPointerUp, opts);
		document.addEventListener("pointercancel", onPointerUp, opts);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown, opts);
			document.removeEventListener("pointermove", onPointerMove, opts);
			document.removeEventListener("pointerup", onPointerUp, opts);
			document.removeEventListener("pointercancel", onPointerUp, opts);
		};
	}, [isRefreshing]);

	const visible = pullDistance > 0 || isRefreshing;
	const progress = Math.min(pullDistance / THRESHOLD_PX, 1);
	const translate = Math.min(pullDistance, MAX_PULL_PX);

	return (
		<div
			aria-hidden
			style={{
				position: "fixed",
				top: "max(0.5rem, env(safe-area-inset-top))",
				left: 0,
				right: 0,
				display: "flex",
				justifyContent: "center",
				pointerEvents: "none",
				zIndex: 10000,
				transform: `translateY(${translate - 40}px)`,
				opacity: visible ? 1 : 0,
				transition: trackingRef.current
					? "none"
					: "transform 200ms ease, opacity 200ms ease",
			}}
		>
			<div
				style={{
					width: 32,
					height: 32,
					borderRadius: "50%",
					border: "3px solid rgba(0,0,0,0.12)",
					borderTopColor: "rgba(0,0,0,0.55)",
					transform: `rotate(${progress * 360}deg)`,
					animation: isRefreshing ? "spin 0.8s linear infinite" : undefined,
				}}
			/>
		</div>
	);
}

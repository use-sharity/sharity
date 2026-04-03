import { ImageResponse } from "next/og";

export const size = {
	width: 1200,
	height: 630,
};

export const contentType = "image/png";

export default function Image() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background:
					"linear-gradient(135deg, rgba(59,130,246,0.12), rgba(16,185,129,0.12))",
				padding: 72,
				fontFamily:
					'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
			}}
		>
			<div
				style={{
					width: "100%",
					height: "100%",
					background: "white",
					borderRadius: 32,
					border: "1px solid rgba(15, 23, 42, 0.12)",
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					padding: 72,
					gap: 24,
					boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
				}}
			>
				<div style={{ fontSize: 72, fontWeight: 800, color: "#0f172a" }}>
					Sharity
				</div>
				<div style={{ fontSize: 36, color: "rgba(15, 23, 42, 0.72)" }}>
					Foster and share items in Da Lat, Vietnam.
				</div>
				<div style={{ fontSize: 24, color: "rgba(15, 23, 42, 0.56)" }}>
					sharity-dalat.vercel.app
				</div>
			</div>
		</div>,
		{
			width: size.width,
			height: size.height,
		},
	);
}

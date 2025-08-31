import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const spaceMono = Space_Mono({
	subsets: ["latin"],
	weight: ["400", "700"],
	variable: "--font-space-mono",
	display: "swap",
});

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
	display: "swap",
});

export const metadata: Metadata = {
	title: "OP-XY Drum Builder",
	description: "Create drum rack presets for your OP-XY",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={`${inter.variable} ${spaceMono.variable} dark`}>
			<meta name="google-site-verification" content="8GG_Gw0npilqZ8NbLSdZe-rOtjPwlxjm8P8j2X7yzl0" />
			<body className="antialiased">
				<Providers>{children}</Providers>
				<Analytics />
			</body>
		</html>
	);
}

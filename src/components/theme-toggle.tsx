"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
	const [theme, setTheme] = useState<"system" | "dark" | "light">("system");

	useEffect(() => {
		// Check for saved preference
		const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
		if (savedTheme) {
			setTheme(savedTheme);
			document.documentElement.classList.toggle("dark", savedTheme === "dark");
			document.documentElement.classList.toggle(
				"light",
				savedTheme === "light",
			);
		}
	}, []);

	const toggleTheme = () => {
		const newTheme =
			theme === "system"
				? window.matchMedia("(prefers-color-scheme: dark)").matches
					? "light"
					: "dark"
				: theme === "dark"
					? "light"
					: "dark";

		setTheme(newTheme);

		if (newTheme === "system") {
			localStorage.removeItem("theme");
			document.documentElement.classList.remove("light", "dark");
		} else {
			localStorage.setItem("theme", newTheme);
			document.documentElement.classList.toggle("dark", newTheme === "dark");
			document.documentElement.classList.toggle("light", newTheme === "light");
		}
	};

	return (
		<button
			type="button"
			onClick={toggleTheme}
			className="rounded-full p-2 hover:bg-muted transition-colors"
			aria-label={
				theme === "system"
					? "Toggle theme"
					: theme === "dark"
						? "Switch to light mode"
						: "Switch to dark mode"
			}
		>
			{theme === "dark" ? (
				<Sun className="h-5 w-5 text-muted-foreground" />
			) : (
				<Moon className="h-5 w-5 text-muted-foreground" />
			)}
		</button>
	);
}

"use client";

import { Dropzone } from "@/components/dropzone";
import { SampleList } from "@/components/sample-list";
import { PianoKeys } from "@/components/piano-keys";
import { useState } from "react";
import type { Sample } from "@/lib/storage";

type DragItem = {
	type: "folder" | "sample";
	data: Sample | { path: string; samples: Sample[] };
} | null;

export default function Home() {
	const [dragItem, setDragItem] = useState<DragItem>(null);
	const [selectedSample, setSelectedSample] = useState<Sample | null>(null);

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-b">
				<div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="font-mono text-sm">
							<span className="uppercase-preserve">OP-XY</span> drum builder
						</span>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
				{/* Hero Section */}
				<section className="text-center space-y-4 py-8">
					<h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l dark:bg-gradient-to-r from-primary/10 to-primary">
						drum preset builder for{" "}
						<span className="uppercase-preserve">OP-XY</span>
					</h1>
					<p className="text-muted-foreground max-w-auto mx-auto">
						browse through samples, organize them into drum racks. <br />
						export your drum rack and copy over to
						<span className="uppercase-preserve"> OP-XY</span>.
					</p>

					{/* Guide Section */}
					<div className="mt-8 max-w-1.5xl mx-auto text-left p-4 rounded-lg border bg-card">
						<h3 className="font-mono text-sm mb-4">quick guide</h3>
						<ol className="space-y-3 text-sm text-muted-foreground">
							<li className="flex gap-2">
								<span className="font-mono text-foreground">01.</span>
								<span>
									select one or more directories where your samples are located
								</span>
							</li>
							<li className="flex gap-2">
								<span className="font-mono text-foreground">02.</span>
								<span>drag a sample onto a key in the piano roll</span>
							</li>
							<li className="flex gap-2">
								<span className="font-mono text-foreground">03.</span>
								<span>
									you can also drag an entire folder to automatically create a
									rack from a folder
								</span>
							</li>
							<li className="flex gap-2">
								<span className="font-mono text-foreground">04.</span>
								<span>
									press download to get get a zip file with your preset
								</span>
							</li>
							<li className="flex gap-2">
								<span className="font-mono text-foreground">06.</span>
								<span>
									download{" "}
									<a
										href="https://teenage.engineering/guides/fieldkit"
										target="_blank"
										rel="noopener noreferrer"
										className="text-foreground hover:underline"
									>
										field kit
									</a>{" "}
									and connect your{" "}
									<span className="uppercase-preserve">OP-XY</span> via usb-c
								</span>
							</li>
							<li className="flex gap-2">
								<span className="font-mono text-foreground">07.</span>
								<span>
									on <span className="uppercase-preserve">OP-XY</span> press
									"COM" and click M4 to enable MTP
								</span>
							</li>
							<li className="flex gap-2">
								<span className="font-mono text-foreground">07.</span>
								<span>
									unpack zip and drag the folder onto the presets folder in{" "}
									<span className="uppercase-preserve">OP-XY</span>
								</span>
							</li>
						</ol>
					</div>
				</section>

				{/* Mobile warning */}
				<div className="md:hidden text-center p-8 space-y-4 border rounded-lg bg-card">
					{/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="h-12 w-12 mx-auto text-muted-foreground/50"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>

					<h2 className="text-xl font-bold">Built for Desktop</h2>
					<p className="text-muted-foreground">
						This tool is built for desktop and filesystem use. Please switch to
						a larger screen
					</p>
				</div>

				{/* Main Content */}
				<div className="grid gap-8 hidden md:block">
					{/* Dropzone with subtle label */}
					<div className="relative">
						<span className="absolute -top-3 left-4 px-2 text-xs text-muted-foreground bg-background">
							upload
						</span>
						<Dropzone />
					</div>

					{/* Sample Browser with subtle label */}
					<div className="relative">
						<span className="absolute -top-3 left-4 px-2 text-xs text-muted-foreground bg-background">
							browser
						</span>
						<div className="h-[400px] border rounded-lg bg-card">
							<SampleList
								onDragStart={(type, data) =>
									setDragItem({ type: type as any, data })
								}
								onDragEnd={() => setDragItem(null)}
								selectedSample={selectedSample}
								onSampleSelect={setSelectedSample}
							/>
						</div>
					</div>

					{/* Piano Roll with subtle label */}
					<div className="relative">
						<span className="absolute -top-3 left-4 px-2 text-xs text-muted-foreground bg-background">
							mapping
						</span>
						<div className="border rounded-lg p-4">
							<PianoKeys
								dragItem={dragItem}
								selectedSample={selectedSample}
								onSampleSelect={setSelectedSample}
							/>
						</div>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t">
				<div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
					<div className="text-xs text-muted-foreground">
						<a href="/terms" className="hover:text-foreground">
							Terms of Service
						</a>
					</div>
					<div>
						<div className="text-xs text-muted-foreground flex items-center">
							<a
								href="https://github.com/niekert"
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center ml-1 hover:text-foreground"
								aria-label="GitHub Profile"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="w-3 h-3"
									role="img"
									aria-labelledby="github-icon"
								>
									<title id="github-icon">GitHub</title>
									<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
									<path d="M9 18c-4.51 2-5-2-7-2" />
								</svg>
							</a>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}

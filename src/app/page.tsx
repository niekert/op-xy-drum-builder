"use client";

import { Dropzone } from "@/components/dropzone";
import { SampleList } from "@/components/sample-list";
import { PianoKeys } from "@/components/piano-keys";
import { useState } from "react";
import type { Sample } from "@/components/sample-list";

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
					<h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l dark:bg-gradient-to-r from-primary/30 to-primary">
						drum preset builder for{" "}
						<span className="uppercase-preserve">OP-XY</span>
					</h1>
					<p className="text-muted-foreground max-w-2xl mx-auto">
						drag and drop samples, organize them into drum racks. <br />
						export your drum rack and copy over to
						<span className="uppercase-preserve"> OP-XY</span>.
					</p>

					{/* Guide Section */}
					<div className="mt-8 max-w-xl mx-auto text-left p-4 rounded-lg border bg-card">
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
								<span>drag samples onto keys in the piano roll</span>
							</li>
							<li className="flex gap-2">
								<span className="font-mono text-foreground">03.</span>
								<span>
									you can also drag an entire folder to automatically create a
									rack
								</span>
							</li>
							<li className="flex gap-2">
								<span className="font-mono text-foreground">04.</span>
								<span>press download to get get a zip file</span>
							</li>
							<li className="flex gap-2">
								<span className="font-mono text-foreground">05.</span>
								<span>unpack the downloaded zip file</span>
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
									drag the folder onto the presets folder in{" "}
									<span className="uppercase-preserve">OP-XY</span>
								</span>
							</li>
						</ol>
					</div>
				</section>

				{/* Main Content */}
				<div className="grid gap-8">
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
								onDragStart={(type, data) => setDragItem({ type, data })}
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
				</div>
			</footer>
		</div>
	);
}

"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Sample } from "@/lib/storage";
import { storage } from "@/lib/storage";

interface SampleDetailProps {
	sample: Sample | null;
}

export function SampleDetail({ sample }: SampleDetailProps) {
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!sample) return;

		const analyzeSample = async () => {
			try {
				// Get the file from the directory
				const file = await storage.getFile(sample.filePath, sample.directoryId);
				await storage.updateSampleDetails(
					file,
					sample.filePath,
					sample.directoryId,
				);

				// Invalidate samples query to refresh the data
				queryClient.invalidateQueries({ queryKey: ["samples"] });
			} catch (error) {
				console.error("Error analyzing sample:", error);
			}
		};

		analyzeSample();
	}, [sample, queryClient]);

	if (!sample) {
		return (
			<div className="p-4 text-sm text-muted-foreground">
				No sample selected
			</div>
		);
	}

	return (
		<div className="p-4 space-y-4">
			<div className="space-y-2">
				<h2 className="text-lg font-semibold">{sample.name}</h2>
				<p className="text-sm text-muted-foreground">{sample.filePath}</p>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-1">
					<p className="text-sm font-medium">Duration</p>
					<p className="text-sm text-muted-foreground">
						{sample.duration
							? `${sample.duration.toFixed(2)}s`
							: "Analyzing..."}
					</p>
				</div>
				<div className="space-y-1">
					<p className="text-sm font-medium">Channels</p>
					<p className="text-sm text-muted-foreground">
						{sample.channels ?? "Analyzing..."}
					</p>
				</div>
				<div className="space-y-1">
					<p className="text-sm font-medium">Sample Rate</p>
					<p className="text-sm text-muted-foreground">
						{sample.sampleRate ? `${sample.sampleRate}Hz` : "Analyzing..."}
					</p>
				</div>
				<div className="space-y-1">
					<p className="text-sm font-medium">RMS Level</p>
					<p className="text-sm text-muted-foreground">
						{sample.rmsLevel
							? `${sample.rmsLevel.toFixed(1)}dB`
							: "Analyzing..."}
					</p>
				</div>
			</div>

			{sample.peaks && (
				<div className="h-32 w-full bg-muted/10 rounded-lg p-4">
					<svg
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						className="h-full w-full"
						aria-label="Waveform visualization"
					>
						<title>Waveform visualization</title>
						<path
							d={`M ${sample.peaks
								.map(
									(peak: number, i: number) =>
										`${i} ${50 - peak * 40} L ${i} ${50 + peak * 40}`,
								)
								.join(" M ")}`}
							stroke="currentColor"
							strokeWidth="0.5"
							fill="none"
							className="text-primary"
						/>
					</svg>
				</div>
			)}
		</div>
	);
}

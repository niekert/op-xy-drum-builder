"use client";

import { useCallback, startTransition, RefObject } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Tone from "tone";
import { DirectoryBrowser, DirectoryBrowserRef } from "./directory-browser";
import { storage } from "@/lib/storage";
import type { Sample } from "@/lib/storage";

type WaveformData = {
	peaks: number[];
	duration: number;
};

type SampleListProps = {
	onDragStart: (
		type: "folder" | "sample",
		data: Sample | { path: string; samples: Sample[] },
	) => void;
	onDragEnd: () => void;
	selectedSample: Sample | null;
	onSampleSelect: (sample: Sample | null) => void;
	ref: RefObject<DirectoryBrowserRef | null>;
};

export function SampleList({
	onDragStart,
	onDragEnd,
	selectedSample,
	onSampleSelect,
	ref,
}: SampleListProps) {
	const queryClient = useQueryClient();

	// Query for directories
	const { data: directories = [] } = useQuery({
		queryKey: ["directories"],
		queryFn: () => storage.getDirectories(),
	});

	// Query for samples
	const { data: samples = [], isLoading } = useQuery({
		queryKey: ["samples"],
		queryFn: async () => {
			const allSamples: Sample[] = [];
			for (const dir of directories) {
				const dirSamples = await storage.getSamples(dir.id);
				allSamples.push(...dirSamples);
			}
			return allSamples;
		},
		enabled: directories.length > 0,
	});

	// Query for waveform data
	const { data: waveform } = useQuery<WaveformData | null>({
		queryKey: ["waveform"],
		queryFn: () => null,
		enabled: false, // This query is only updated through cache manipulation
	});

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: async (sample: Sample) => {
			await storage.removeSample(sample.id);

			// Clear selected sample if it was deleted
			if (selectedSample?.id === sample.id) {
				onSampleSelect(null);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["samples"] });
			queryClient.invalidateQueries({ queryKey: ["directories"] });
		},
	});

	const analyzeSample = useCallback(
		async (sample: Sample | null) => {
			if (!sample) return;

			try {
				// Start transition for UI updates
				startTransition(() => {
					onSampleSelect(sample);
				});

				// Get the file from the file system
				const file = await storage.getFile(sample.filePath, sample.directoryId);
				const buffer = await file.arrayBuffer();
				const audioContext = await storage.getAudioContext();
				const audioBuffer = await audioContext.decodeAudioData(buffer);

				// Calculate peaks for waveform
				const channelData = audioBuffer.getChannelData(0);
				const peaks: number[] = [];
				const blockSize = Math.floor(channelData.length / 100);

				for (let i = 0; i < 100; i++) {
					const start = blockSize * i;
					let peak = 0;

					for (let j = 0; j < blockSize; j++) {
						const value = Math.abs(channelData[start + j]);
						peak = Math.max(peak, value);
					}

					peaks.push(peak);
				}

				// Calculate RMS (volume) level
				let rmsSum = 0;
				for (let i = 0; i < channelData.length; i++) {
					rmsSum += channelData[i] * channelData[i];
				}
				const rmsLevel = Math.sqrt(rmsSum / channelData.length);
				const rmsDb = 20 * Math.log10(rmsLevel);

				// Update sample with audio details
				await storage.updateSample(sample.id, {
					duration: audioBuffer.duration,
					channels: audioBuffer.numberOfChannels,
					sampleRate: audioBuffer.sampleRate,
					rmsLevel: rmsDb,
				});

				// Update the UI with the new details
				startTransition(() => {
					onSampleSelect({
						...sample,
						duration: audioBuffer.duration,
						channels: audioBuffer.numberOfChannels,
						sampleRate: audioBuffer.sampleRate,
						rmsLevel: rmsDb,
					});
				});
			} catch (error) {
				console.error("Error analyzing sample:", error);
			}
		},
		[onSampleSelect],
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<svg
					className="animate-spin h-4 w-4 text-muted-foreground"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					aria-label="Loading samples"
				>
					<title>Loading samples</title>
					<circle
						className="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="4"
					/>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
			</div>
		);
	}

	if (samples.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-2 text-center">
				<svg
					className="h-4 w-4 text-muted-foreground"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
					aria-label="No samples"
				>
					<title>No samples</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
					/>
				</svg>
				<span className="text-sm text-muted-foreground">
					use the upload area above to add samples
				</span>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 h-full divide-x">
			<div className="overflow-auto">
				<DirectoryBrowser
					samples={samples}
					onSampleSelect={analyzeSample}
					selectedSample={selectedSample}
					onDragStart={onDragStart}
					onDragEnd={onDragEnd}
					ref={ref}
				/>
			</div>

			<div className="p-4 overflow-auto">
				{selectedSample ? (
					<div className="space-y-4">
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-medium">{selectedSample.name}</h3>
								<button
									type="button"
									className="rounded-full hover:bg-destructive/10 p-2 transition-colors"
									onClick={() => deleteMutation.mutate(selectedSample)}
								>
									<svg
										className="h-4 w-4 text-destructive"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-label="Delete sample"
									>
										<title>Delete sample</title>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
							<div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
								<div>
									<span className="block font-mono">duration</span>
									<span>{selectedSample.duration?.toFixed(2)}s</span>
								</div>
								<div>
									<span className="block font-mono">channels</span>
									<span>{selectedSample.channels || "-"}</span>
								</div>
								<div>
									<span className="block font-mono">sample rate</span>
									<span>
										{selectedSample.sampleRate
											? `${(selectedSample.sampleRate / 1000).toFixed(1)}kHz`
											: "-"}
									</span>
								</div>
								<div>
									<span className="block font-mono">level</span>
									<span>
										{selectedSample.rmsLevel
											? `${selectedSample.rmsLevel.toFixed(1)}dB`
											: "-"}
									</span>
								</div>
							</div>
							<p className="text-xs text-muted-foreground">
								Directory: {selectedSample.directoryPath}
							</p>
						</div>
						{waveform && (
							<div className="h-32 w-full bg-muted/10 rounded-lg p-4">
								<svg
									viewBox="0 0 100 100"
									preserveAspectRatio="none"
									className="h-full w-full"
									aria-label="Waveform visualization"
								>
									<title>Waveform visualization</title>
									<path
										d={`M ${waveform.peaks
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
				) : (
					<div className="flex items-center justify-center h-full">
						<p className="text-sm text-muted-foreground">Select a sample</p>
					</div>
				)}
			</div>
		</div>
	);
}

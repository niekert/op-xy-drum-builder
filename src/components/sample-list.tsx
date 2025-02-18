"use client";

import type { RefObject } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	DirectoryBrowser,
	type DirectoryBrowserRef,
} from "./directory-browser";
import { storage } from "@/lib/storage";
import type { Sample } from "@/lib/storage";
import { SampleDetail } from "./sample-detail";

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
	const { data: samples = {}, isLoading } = useQuery({
		queryKey: ["samples"],
		queryFn: async () => {
			const samplesById: Record<string, Sample> = {};

			for (const dir of directories) {
				const dirSamples = await storage.getSamples(dir.id);
				for (const sample of dirSamples) {
					samplesById[sample.id] = sample;
				}
			}

			return samplesById;
		},
		enabled: directories.length > 0,
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

	if (Object.values(samples).length === 0) {
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
					onSampleSelect={onSampleSelect}
					selectedSample={selectedSample}
					onDragStart={onDragStart}
					onDragEnd={onDragEnd}
					ref={ref}
				/>
			</div>

			<div className="overflow-auto">
				{selectedSample ? (
					<div className="flex flex-col">
						<SampleDetail sample={selectedSample} />
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

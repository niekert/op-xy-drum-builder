"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { storage } from "@/lib/storage";
import type { Sample } from "@/lib/storage";
import { Button } from "./ui/button";

type ProcessStatus = {
	total: number;
	completed: number;
};

const ALLOWED_EXTENSIONS = [".wav", ".aif", ".aiff", ".mp3"];

export function Dropzone() {
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<ProcessStatus | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	const [audioContext] = useState(() =>
		typeof AudioContext !== "undefined" ? new AudioContext() : null,
	);

	const processMutation = useMutation({
		mutationFn: async (file: {
			file: File;
			path: string;
			directoryId: string;
		}) => {
			try {
				if (!audioContext) {
					throw new Error("AudioContext is not supported");
				}

				const arrayBuffer = await file.file.arrayBuffer();

				const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

				// Create Tone.js buffer from the decoded audio data

				// Add sample to IndexedDB
				await storage.upsertSample(file.file, file.path, file.directoryId, {
					duration: audioBuffer.duration,
					channels: audioBuffer.numberOfChannels,
					sampleRate: audioBuffer.sampleRate,
				});

				return { fileName: file.file.name };
			} catch (error) {
				console.error("Error processing file:", error);
				throw error;
			}
		},
	});

	const handleDirectorySelect = async () => {
		try {
			setIsProcessing(true);
			setError(null);

			// Request directory access
			const directory = await storage.addDirectory();
			if (!directory) {
				// User cancelled or permission denied
				setError("Directory access was denied or cancelled");
				return;
			}

			// Scan directory for audio files
			const entries = await storage.scanDirectory(directory.handle);
			const audioFiles = entries.filter(
				(entry) => entry.handle.kind === "file",
			);

			setStatus({ total: audioFiles.length, completed: 0 });

			// Process each file
			const errors: string[] = [];
			for (const entry of audioFiles) {
				try {
					if (entry.handle.kind !== "file") continue;

					const file = await entry.handle.getFile();
					await processMutation.mutateAsync({
						file,
						path: entry.path,
						directoryId: directory.id,
					});

					// Invalidate queries after each successful file process
					await Promise.all([
						queryClient.invalidateQueries({ queryKey: ["samples"] }),
						queryClient.invalidateQueries({ queryKey: ["directories"] }),
					]);

					setStatus((prev) =>
						prev ? { ...prev, completed: prev.completed + 1 } : null,
					);
				} catch (error) {
					console.error("Error processing file:", entry.name, error);
					errors.push(
						`${entry.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
				}
			}

			// Final query invalidation to ensure everything is up to date
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["samples"] }),
				queryClient.invalidateQueries({ queryKey: ["directories"] }),
			]);

			if (errors.length > 0) {
				setError(`Failed to process some files: ${errors.length} errors`);
			}
		} catch (error) {
			console.error("Error processing directory:", error);
			setError("Failed to process directory");
		} finally {
			setIsProcessing(false);
			setStatus(null);
			// One final invalidation in case of any errors
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["samples"] }),
				queryClient.invalidateQueries({ queryKey: ["directories"] }),
			]);
		}
	};

	return (
		<div className="space-y-4">
			<Button
				onClick={handleDirectorySelect}
				disabled={isProcessing}
				className="w-full p-8 border-2 border-dashed rounded-lg hover:bg-primary/5 transition-colors h-[150px] bg-primary/0"
			>
				<div className="flex flex-col items-center justify-center space-y-4 text-center">
					<div className="rounded-full bg-muted p-4">
						<FolderOpen className="h-6 w-6 text-muted-foreground" />
					</div>
					<div className="space-y-1">
						<p className="text-sm font-medium text-foreground">
							{status
								? `Processing ${status.completed} of ${status.total} files...`
								: "Select Samples Directory"}
						</p>
						{error ? (
							<p className="text-xs text-destructive">{error}</p>
						) : (
							<>
								<p className="text-xs text-muted-foreground">
									WAV, AIF/AIFF, or MP3 files
								</p>
							</>
						)}
					</div>
					{/* Progress */}
					{status && (
						<div className="w-full max-w-xs space-y-2">
							<div className="h-1 bg-muted rounded-full overflow-hidden">
								<div
									className="h-full bg-primary transition-all duration-200"
									style={{
										width: `${(status.completed / status.total) * 100}%`,
									}}
								/>
							</div>
						</div>
					)}
				</div>
			</Button>
		</div>
	);
}

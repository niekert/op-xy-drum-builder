"use client";

import { useCallback, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { storage } from "@/lib/storage";
import type { Sample } from "@/lib/storage";
import { Button } from "./ui/button";

type ProcessStatus = {
	type: "scanning" | "processing";
	detectedCount?: number;
	total?: number;
	processed?: number;
};

export function Dropzone() {
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<ProcessStatus | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	// Set up progress listener
	useEffect(() => {
		const progressListener = (state: ProcessStatus) => {
			setStatus(state);
		};

		storage.addProgressListener(progressListener);

		return () => {
			storage.removeProgressListener(progressListener);
		};
	}, []);

	const handleDirectorySelect = async () => {
		try {
			setIsProcessing(true);
			setError(null);
			setStatus(null);

			// Request directory access
			const directory = await storage.addDirectory();
			if (!directory) {
				// User cancelled or permission denied
				setError("Directory access was denied or cancelled");
				return;
			}

			// Invalidate queries after processing is complete
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["samples"] }),
				queryClient.invalidateQueries({ queryKey: ["directories"] }),
			]);
		} catch (error) {
			console.error("Error processing directory:", error);
			setError("Failed to process directory");
		} finally {
			setIsProcessing(false);
			setStatus(null);
		}
	};

	return (
		<div className="space-y-4">
			<Button
				onClick={handleDirectorySelect}
				disabled={isProcessing}
				className="w-full p-8 border-t-2 border-x-2 border-dashed rounded-t-lg hover:bg-primary/5 transition-colors h-[150px] bg-primary/0"
			>
				<div className="flex flex-col items-center justify-center space-y-4 text-center">
					<div className="rounded-full bg-muted p-4">
						<FolderOpen className="h-6 w-6 text-muted-foreground" />
					</div>
					<div className="space-y-1">
						<p className="text-sm font-medium text-foreground">
							{status
								? status.type === "scanning"
									? `Scanning directory... Found ${status.detectedCount || 0} drum samples`
									: `Processing ${status.processed || 0} of ${status.total || 0} samples...`
								: "Select Samples Directory"}
						</p>
						{error ? (
							<p className="text-xs text-destructive">{error}</p>
						) : (
							<>
								<p className="text-xs text-muted-foreground">
									drumbuilder will scan for one-shot .wav files in the selected{" "}
									<br />
									directory and subdirectories
								</p>
							</>
						)}
					</div>
					{/* Progress */}
					{status && (
						<div className="w-full max-w-xs space-y-2">
							<div className="h-1 bg-muted rounded-full overflow-hidden">
								<div
									className={`h-full bg-primary transition-all duration-200 ${
										status.type === "scanning" ? "animate-indeterminate" : ""
									}`}
									style={{
										width:
											status.type === "scanning"
												? "100%"
												: `${((status.processed || 0) / (status.total || 1)) * 100}%`,
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

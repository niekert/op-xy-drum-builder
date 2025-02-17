"use client";

import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { FolderUp, Upload } from "lucide-react";

type UploadError = {
	message: string;
	code?: string;
	details?: string;
};

const ALLOWED_EXTENSIONS = [".wav", ".aif", ".aiff", ".mp3"];

export function Dropzone() {
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);
	const directoryInputRef = useRef<HTMLInputElement>(null);

	const uploadMutation = useMutation({
		mutationFn: async (file: File) => {
			// Check file extension
			const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
			if (!ALLOWED_EXTENSIONS.includes(ext)) {
				// Silently ignore unsupported files
				return;
			}

			// Extract directory path from file
			const fullPath = file.webkitRelativePath || file.name;
			const pathParts = fullPath.split("/");
			const fileName = pathParts.pop() || file.name;
			const directory = pathParts.join("/");

			// Generate a unique storage filename while keeping the extension
			const uniqueId = nanoid();
			const storageFileName = directory
				? `${directory}/${uniqueId}${ext}`
				: `${uniqueId}${ext}`;

			// Upload file with unique name
			const { error: uploadError } = await supabase.storage
				.from("samples")
				.upload(storageFileName, file);

			if (uploadError) {
				throw uploadError;
			}

			// Get the public URL
			const {
				data: { publicUrl } = {},
			} = supabase.storage.from("samples").getPublicUrl(storageFileName);

			// Create a record in the samples table with original filename and directory
			const { error: dbError } = await supabase.from("samples").insert({
				name: fileName,
				url: publicUrl,
				storage_path: storageFileName,
				directory: directory || "/",
				duration: 0, // TODO: Get actual duration from audio file
			});

			if (dbError) {
				// If database insert fails, clean up the uploaded file
				await supabase.storage.from("samples").remove([storageFileName]);
				throw dbError;
			}
		},
		onError: (error: UploadError) => {
			console.error("Error uploading file:", error);
			setError(error.message || "Failed to upload file");
		},
		onSuccess: () => {
			setError(null);
			queryClient.invalidateQueries({ queryKey: ["samples"] });
		},
	});

	const onDrop = useCallback(
		async (acceptedFiles: File[]) => {
			setError(null);
			// Upload files sequentially to avoid overwhelming the server
			for (const file of acceptedFiles) {
				await uploadMutation.mutateAsync(file);
			}
		},
		[uploadMutation],
	);

	const handleDirectorySelect = (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = Array.from(event.target.files || []);
		onDrop(files);
	};

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			"audio/wav": [".wav"],
			"audio/aiff": [".aif", ".aiff"],
			"audio/mpeg": [".mp3"],
		},
		disabled: uploadMutation.isPending,
		multiple: true,
	});

	return (
		<div className="space-y-4">
			<div
				{...getRootProps()}
				className={`
					border-2 border-dashed rounded-lg p-8
					transition-colors duration-200 ease-in-out
					cursor-pointer
					${uploadMutation.isPending ? "opacity-50 cursor-not-allowed" : ""}
					${error ? "border-destructive bg-destructive/5" : ""}
					${
						isDragActive && !error
							? "border-primary bg-primary/5"
							: "border-muted-foreground/25 hover:border-primary/50"
					}
				`}
			>
				<input {...getInputProps()} />
				<div className="flex flex-col items-center justify-center space-y-4 text-center">
					<div className="rounded-full bg-muted p-4">
						<Upload className="h-6 w-6 text-muted-foreground" />
					</div>
					<div className="space-y-1">
						<p className="text-sm font-medium text-foreground">
							{uploadMutation.isPending
								? "Uploading..."
								: "Drop audio samples here"}
						</p>
						{error ? (
							<p className="text-xs text-destructive">{error}</p>
						) : (
							<p className="text-xs text-muted-foreground">
								WAV, AIF/AIFF, or MP3 up to 10MB
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Directory Upload Button */}
			<div className="flex justify-center">
				<button
					type="button"
					onClick={() => directoryInputRef.current?.click()}
					className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
					disabled={uploadMutation.isPending}
				>
					<FolderUp className="h-4 w-4" />
					<span className="text-sm">Select Folder</span>
				</button>
				<input
					type="file"
					ref={directoryInputRef}
					onChange={handleDirectorySelect}
					className="hidden"
					webkitdirectory=""
					directory=""
					multiple
				/>
			</div>
		</div>
	);
}

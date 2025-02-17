"use client";

import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase, getDeviceId } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { FolderUp, Upload } from "lucide-react";

type UploadError = {
	message: string;
	code?: string;
	details?: string;
};

type UploadStatus = {
	total: number;
	completed: number;
};

const ALLOWED_EXTENSIONS = [".wav", ".aif", ".aiff", ".mp3"];

export function Dropzone() {
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);
	const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
	const directoryInputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	const uploadMutation = useMutation({
		mutationFn: async (file: { file: File; path: string[] }) => {
			const deviceId = getDeviceId();
			const fileName = file.file.name;
			const directory =
				file.path.length > 0 ? file.path.join("/").replace(/\s+/g, "_") : "";

			// Generate unique filename while keeping extension
			const ext = `.${fileName.split(".").pop()?.toLowerCase()}`;
			const storageFileName = `${nanoid()}${ext}`;

			// Upload file to storage
			const { error: uploadError, data } = await supabase.storage
				.from("samples")
				.upload(
					directory
						? `${deviceId}/${directory}/${storageFileName}`
						: `${deviceId}/${storageFileName}`,
					file.file,
					{
						cacheControl: "3600",
						upsert: false,
					},
				);

			if (uploadError) throw uploadError;

			// Get public URL
			const {
				data: { publicUrl },
			} = supabase.storage.from("samples").getPublicUrl(data.path);

			// Create a record in the samples table with original filename and directory
			const { error: dbError } = await supabase.from("samples").insert({
				name: fileName,
				url: publicUrl,
				storage_path: storageFileName,
				directory: file.path.length > 0 ? file.path.join("/") : "/",
				device_id: deviceId,
				duration: 0,
			});

			if (dbError) throw dbError;

			// Ensure sample list is updated
			queryClient.invalidateQueries({ queryKey: ["samples", getDeviceId()] });

			return { fileName, publicUrl };
		},
	});

	const onDrop = useCallback(
		async (acceptedFiles: File[]) => {
			setError(null);

			// Filter valid files first
			const validFiles = acceptedFiles.filter((file) => {
				const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
				return ALLOWED_EXTENSIONS.includes(ext);
			});

			// Initialize upload status with valid files count
			setUploadStatus({ total: validFiles.length, completed: 0 });

			// Upload files sequentially to avoid overwhelming the server
			for (const file of validFiles) {
				try {
					await uploadMutation.mutateAsync({ file, path: [] });
					// Update progress after successful upload
					setUploadStatus((prev) =>
						prev ? { ...prev, completed: prev.completed + 1 } : null,
					);
				} catch (error) {
					console.error("Error uploading", file.name, error);
					setError(`Failed to upload ${file.name}`);
				}
			}

			// Clear upload status when done
			setUploadStatus(null);
		},
		[uploadMutation],
	);

	const handleDirectoryUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const allFiles = Array.from(event.target.files || []);
		setUploading(true);

		// Filter valid files first
		const validFiles = allFiles.filter((file) => {
			const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
			return ALLOWED_EXTENSIONS.includes(ext);
		});

		setUploadStatus({ total: validFiles.length, completed: 0 });

		try {
			for (const file of validFiles) {
				const path = file.webkitRelativePath.split("/").slice(0, -1);
				await uploadMutation.mutateAsync({ file, path });
				setUploadStatus((prev) => {
					if (!prev) return { total: validFiles.length, completed: 1 };
					return {
						total: prev.total,
						completed: prev.completed + 1,
					};
				});
			}
		} catch (error) {
			console.error("Error uploading files:", error);
			setError("Failed to upload files");
		}

		setUploading(false);
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

	const { data: samples, isLoading } = useQuery({
		queryKey: ["samples", getDeviceId()],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("samples")
				.select("*")
				.eq("device_id", getDeviceId())
				.order("created_at", { ascending: false });

			if (error) throw error;
			return data;
		},
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
							{uploadStatus
								? `Uploading ${uploadStatus.completed} of ${uploadStatus.total} files...`
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
					{/* Upload Progress */}
					{uploadStatus && (
						<div className="w-full max-w-xs space-y-2">
							<div className="h-1 bg-muted rounded-full overflow-hidden">
								<div
									className="h-full bg-primary transition-all duration-200"
									style={{
										width: `${(uploadStatus.completed / uploadStatus.total) * 100}%`,
									}}
								/>
							</div>
						</div>
					)}
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
					onChange={handleDirectoryUpload}
					className="hidden"
					{...({
						webkitdirectory: "",
						mozdirectory: "",
						directory: "",
						multiple: true,
					} as any)}
				/>
			</div>
		</div>
	);
}

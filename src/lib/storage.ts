import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import { tree } from "next/dist/build/templates/app-page";

// Add type definitions for the File System Access API
interface FileSystemHandle {
	kind: "file" | "directory";
	name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
	kind: "file";
	getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
	kind: "directory";
	values(): AsyncIterableIterator<
		FileSystemFileHandle | FileSystemDirectoryHandle
	>;
	getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle>;
	getFileHandle(name: string): Promise<FileSystemFileHandle>;
	queryPermission(descriptor: {
		mode: "read" | "readwrite";
	}): Promise<PermissionState>;
}

declare global {
	interface Window {
		showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
	}
}

interface DirectoryEntry {
	handle: FileSystemFileHandle | FileSystemDirectoryHandle;
	name: string;
	path: string;
}

export type DirectoryPermission = {
	handle: FileSystemDirectoryHandle;
	id: string;
	path: string;
};

interface SampleMetadata {
	id: string;
	name: string;
	filePath: string;
	directoryId: string;
	directoryPath: string;
	duration: number;
	channels: number;
	sampleRate: number;
	rmsLevel: number;
	createdAt: number;
}

export type Sample = SampleMetadata;

interface DirectoryMetadata {
	id: string;
	name: string;
	path: string;
	lastAccessed: number;
	handle: FileSystemDirectoryHandle;
}

export interface DrumRack {
	id: string;
	name: string;
	configuration: {
		keys: {
			note: string;
			sample?: Sample;
			isBlack: boolean;
		}[];
	};
	createdAt: number;
	updatedAt?: number;
}

interface SampleDB extends DBSchema {
	directories: {
		key: string;
		value: DirectoryMetadata;
		indexes: { "by-path": string };
	};
	samples: {
		key: string;
		value: SampleMetadata;
		indexes: { "by-directory": string };
	};
	drumRacks: {
		key: string;
		value: DrumRack;
		indexes: { "by-name": string };
	};
}

class StorageService {
	private db: IDBPDatabase<SampleDB> | null = null;
	private directoryHandles: Map<string, FileSystemDirectoryHandle> = new Map();
	private directoryPermissions: Map<string, boolean> = new Map();
	private static instance: StorageService;

	private constructor() {
		void this.initDB();
	}

	static getInstance(): StorageService {
		if (!StorageService.instance) {
			StorageService.instance = new StorageService();
		}
		return StorageService.instance;
	}

	private async initDB(): Promise<void> {
		if (typeof indexedDB === "undefined") return;

		this.db = await openDB<SampleDB>("samples-db", 1, {
			upgrade(db: IDBPDatabase<SampleDB>) {
				// Directories store
				const dirStore = db.createObjectStore("directories", { keyPath: "id" });
				dirStore.createIndex("by-path", "path", { unique: true });

				// Samples store
				const sampleStore = db.createObjectStore("samples", { keyPath: "id" });
				sampleStore.createIndex("by-directory", "directoryId");

				// Drum racks store
				const drumRackStore = db.createObjectStore("drumRacks", {
					keyPath: "id",
				});
				drumRackStore.createIndex("by-name", "name");
			},
		});
	}

	// Directory methods
	async getDirectories(): Promise<
		(DirectoryMetadata & { hasPermission: boolean })[]
	> {
		if (!this.db) await this.initDB();
		if (!this.db) throw new Error("Failed to initialize database");
		const directories = await this.db.getAll("directories");

		// Check actual permissions for each directory
		const directoriesWithPermissions = await Promise.all(
			directories.map(async (dir) => {
				try {
					const handle = dir.handle;
					const permission = await handle.queryPermission({ mode: "read" });
					const hasPermission = permission === "granted";

					// Update our cache
					this.directoryHandles.set(dir.id, handle);
					this.directoryPermissions.set(dir.id, hasPermission);

					return {
						...dir,
						hasPermission,
					};
				} catch (error) {
					console.warn(
						`Failed to check permissions for directory ${dir.name}:`,
						error,
					);
					return {
						...dir,
						hasPermission: false,
					};
				}
			}),
		);

		return directoriesWithPermissions;
	}

	async requestDirectoryPermission(directoryId: string): Promise<boolean> {
		if (!this.db) await this.initDB();
		if (!this.db) throw new Error("Failed to initialize database");

		try {
			const directory = await this.db.get("directories", directoryId);
			if (!directory) return false;

			const handle = await window.showDirectoryPicker();
			const permission = await handle.queryPermission({ mode: "read" });

			if (permission === "granted") {
				this.directoryHandles.set(directoryId, handle);
				this.directoryPermissions.set(directoryId, true);
				await this.db.put("directories", {
					...directory,
					lastAccessed: Date.now(),
					handle,
				});

				// Get all current file paths in the directory
				const entries = await this.scanDirectory(handle);
				const currentPaths = new Set(entries.map((e) => e.path));

				// Get existing samples and remove ones that no longer exist
				const existingSamples = await this.getSamples(directoryId);
				const tx = this.db.transaction("samples", "readwrite");
				for (const sample of existingSamples) {
					if (!currentPaths.has(sample.filePath)) {
						await tx.store.delete(sample.id);
					}
				}
				await tx.done;

				// Upsert all current samples
				for (const entry of entries) {
					if (entry.handle.kind === "file") {
						const file = await entry.handle.getFile();
						await this.upsertSample(file, entry.path, directoryId, {
							duration: undefined,
							channels: undefined,
							sampleRate: undefined,
						});
					}
				}

				return true;
			}
			return false;
		} catch (error) {
			console.error("Error requesting directory permission:", error);
			return false;
		}
	}

	async addDirectory(): Promise<DirectoryMetadata | null> {
		if (!this.db) await this.initDB();
		if (!this.db) throw new Error("Failed to initialize database");

		try {
			const handle = await window.showDirectoryPicker();
			const id = crypto.randomUUID();

			const directory: DirectoryMetadata = {
				id,
				name: handle.name,
				path: handle.name,
				lastAccessed: Date.now(),
				handle,
			};

			this.directoryHandles.set(id, handle);
			this.directoryPermissions.set(id, true);
			await this.db.put("directories", directory);

			// Scan for samples since we have permission
			const entries = await this.scanDirectory(handle);
			for (const entry of entries) {
				if (entry.handle.kind === "file") {
					const file = await entry.handle.getFile();
					await this.upsertSample(file, entry.path, id, {
						duration: undefined,
						channels: undefined,
						sampleRate: undefined,
					});
				}
			}

			return directory;
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				// User cancelled the directory picker
				return null;
			}
			console.error("Error adding directory:", error);
			return null;
		}
	}

	async removeDirectory(id: string): Promise<void> {
		if (!this.db) await this.initDB();
		if (!this.db) throw new Error("Failed to initialize database");

		// Delete all samples in this directory
		const samples = await this.getSamples(id);
		const tx = this.db.transaction(["samples", "directories"], "readwrite");

		for (const sample of samples) {
			await tx.objectStore("samples").delete(sample.id);
		}

		await tx.objectStore("directories").delete(id);
		this.directoryHandles.delete(id);
		this.directoryPermissions.delete(id);
		await tx.done;
	}

	// Sample methods
	async getSamples(directoryId: string): Promise<SampleMetadata[]> {
		if (!this.db) await this.initDB();
		if (!this.db) throw new Error("Failed to initialize database");
		return this.db.getAllFromIndex("samples", "by-directory", directoryId);
	}

	async addSample(
		file: File,
		filePath: string,
		directoryId: string,
		audioDetails: {
			duration?: number;
			channels?: number;
			sampleRate?: number;
		},
	): Promise<void> {
		if (!this.db) throw new Error("Database not initialized");

		const sample: SampleMetadata = {
			id: crypto.randomUUID(),
			name: file.name,
			filePath,
			directoryId,
			directoryPath: filePath.split("/").slice(0, -1).join("/"),
			duration: audioDetails.duration ?? 0,
			channels: audioDetails.channels ?? 0,
			sampleRate: audioDetails.sampleRate ?? 0,
			rmsLevel: 0,
			createdAt: Date.now(),
		};

		await this.db.put("samples", sample);
	}

	async removeSample(id: string): Promise<void> {
		if (!this.db) throw new Error("Database not initialized");
		await this.db.delete("samples", id);
	}

	async updateSample(
		id: string,
		updates: Partial<{
			duration: number;
			channels: number;
			sampleRate: number;
			rmsLevel: number;
		}>,
	): Promise<void> {
		if (!this.db) throw new Error("Database not initialized");

		const sample = await this.db.get("samples", id);
		if (!sample) throw new Error("Sample not found");

		await this.db.put("samples", {
			...sample,
			...updates,
		});
	}

	// Drum rack methods
	async getDrumRacks(): Promise<DrumRack[]> {
		if (!this.db) await this.initDB();
		if (!this.db) throw new Error("Database not initialized");
		return this.db.getAll("drumRacks");
	}

	async addDrumRack(
		name: string,
		configuration: DrumRack["configuration"],
	): Promise<DrumRack> {
		if (!this.db) throw new Error("Database not initialized");

		const drumRack: DrumRack = {
			id: crypto.randomUUID(),
			name,
			configuration,
			createdAt: Date.now(),
		};

		await this.db.put("drumRacks", drumRack);
		return drumRack;
	}

	async updateDrumRack(
		id: string,
		configuration: DrumRack["configuration"],
	): Promise<void> {
		if (!this.db) throw new Error("Database not initialized");

		const drumRack = await this.db.get("drumRacks", id);
		if (!drumRack) throw new Error("Drum rack not found");

		await this.db.put("drumRacks", {
			...drumRack,
			configuration,
			updatedAt: Date.now(),
		});
	}

	async removeDrumRack(id: string): Promise<void> {
		if (!this.db) await this.initDB();
		if (!this.db) throw new Error("Database not initialized");
		await this.db.delete("drumRacks", id);
	}

	// File system methods
	async getFile(filePath: string, directoryHandleId: string): Promise<File> {
		const dirHandle = this.directoryHandles.get(directoryHandleId);
		if (!dirHandle) {
			throw new Error("Directory handle not found");
		}

		const pathParts = filePath
			.split("/")
			.filter(Boolean)
			// Ignore the first path cause thats the actualk directory handle.
			.slice(1);

		let current: FileSystemDirectoryHandle = dirHandle;

		// Navigate through subdirectories
		for (let i = 0; i < pathParts.length - 1; i++) {
			current = await current.getDirectoryHandle(pathParts[i]);
		}

		// Get the file
		const fileHandle = await current.getFileHandle(
			pathParts[pathParts.length - 1],
		);
		return fileHandle.getFile();
	}

	async verifyPermissions() {
		const stored = localStorage.getItem("directory-permissions") || "[]";
		const permissions = JSON.parse(stored);

		// Clear existing handles
		this.directoryHandles.clear();

		// Re-request permissions for stored directories
		for (const perm of permissions) {
			try {
				const handle = await window.showDirectoryPicker();
				this.directoryHandles.set(perm.id, handle);
			} catch (error) {
				console.error("Failed to restore permission:", error);
			}
		}
	}

	async scanDirectory(
		handle: FileSystemDirectoryHandle,
		parentPath = "",
	): Promise<DirectoryEntry[]> {
		const entries: DirectoryEntry[] = [];
		const currentPath = parentPath
			? `${parentPath}/${handle.name}`
			: handle.name;

		for await (const entry of handle.values()) {
			if (entry.kind === "file") {
				// Check if file has an allowed audio extension
				if (entry.name.match(/\.(wav|mp3|aiff?|m4a)$/i)) {
					entries.push({
						handle: entry,
						name: entry.name,
						path: `${currentPath}/${entry.name}`,
					});
				}
			} else if (entry.kind === "directory") {
				// Recursively scan subdirectories
				const subEntries = await this.scanDirectory(entry, currentPath);
				entries.push(...subEntries);
			}
		}

		return entries;
	}

	async upsertSample(
		file: File,
		filePath: string,
		directoryId: string,
		audioDetails: {
			duration?: number;
			channels?: number;
			sampleRate?: number;
		},
	): Promise<void> {
		if (!this.db) throw new Error("Database not initialized");

		// Try to find existing sample with same path in this directory
		const tx = this.db.transaction("samples", "readwrite");
		const index = tx.store.index("by-directory");
		const existingSamples = await index.getAll(directoryId);
		const existingSample = existingSamples.find((s) => s.filePath === filePath);

		const sample: SampleMetadata = {
			id: existingSample?.id ?? crypto.randomUUID(),
			name: file.name,
			filePath,
			directoryId,
			directoryPath: filePath.split("/").slice(0, -1).join("/"),
			duration: audioDetails.duration ?? existingSample?.duration ?? 0,
			channels: audioDetails.channels ?? existingSample?.channels ?? 0,
			sampleRate: audioDetails.sampleRate ?? existingSample?.sampleRate ?? 0,
			rmsLevel: existingSample?.rmsLevel ?? 0,
			createdAt: existingSample?.createdAt ?? Date.now(),
		};

		await tx.store.put(sample);
		await tx.done;
	}
}

export const storage = StorageService.getInstance();

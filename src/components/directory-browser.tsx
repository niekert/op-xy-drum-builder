"use client";

import {
	useState,
	useMemo,
	useRef,
	useEffect,
	useCallback,
	Fragment,
	memo,
} from "react";
import { ChevronRight, ChevronDown, Folder, Music, Lock } from "lucide-react";
import * as Tone from "tone";
import { storage } from "@/lib/storage";
import type { Sample } from "@/lib/storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

type DirectoryBrowserProps = {
	samples: Sample[];
	onSampleSelect: (sample: Sample | null) => void;
	selectedSample: Sample | null;
	onDragStart: (
		type: "folder" | "sample",
		data: Sample | { path: string; samples: Sample[] },
	) => void;
	onDragEnd: () => void;
};

type FolderNode = {
	type: "folder";
	name: string;
	path: string;
	children: Node[];
	samples: Sample[];
};

type SampleNode = {
	type: "sample";
	name: string;
	path: string;
	sample: Sample;
};

type Node = FolderNode | SampleNode;

// Add the SampleRow component before the DirectoryBrowser component
const SampleRow = memo(function SampleRow({
	sample,
	path,
	level,
	isSelected,
	showHighlight,
	needsPermission,
	onSelect,
	onDragStart,
	onDragEnd,
	selectedSampleRef,
	onDelete,
	isDeleting,
}: {
	sample: Sample;
	path: string;
	level: number;
	isSelected: boolean;
	showHighlight: boolean;
	needsPermission: boolean;
	onSelect: (sample: Sample) => void;
	onDragStart: (e: React.DragEvent, sample: Sample) => void;
	onDragEnd: () => void;
	selectedSampleRef: React.RefObject<HTMLDivElement | null>;
	onDelete: (sample: Sample) => void;
	isDeleting: boolean;
}) {
	return (
		<ContextMenu>
			<ContextMenuTrigger>
				<div
					ref={isSelected ? selectedSampleRef : null}
					draggable={!needsPermission}
					onDragStart={(e) => onDragStart(e, sample)}
					onDragEnd={onDragEnd}
					key={path}
					style={{ marginLeft: `${level * 16}px` }}
					className={`
						flex items-center gap-2 p-1 rounded-md outline-none
						${showHighlight ? "bg-primary/10" : "hover:bg-muted/50"}
						${isSelected && !showHighlight ? "bg-muted/30" : ""}
						${needsPermission ? "opacity-50 cursor-not-allowed" : ""}
					`}
					onClick={() => onSelect(sample)}
					onKeyDown={(e) => {
						if (!needsPermission && (e.key === "Enter" || e.key === " ")) {
							e.preventDefault();
							onSelect(sample);
						}
					}}
					role="treeitem"
					tabIndex={isSelected ? 0 : -1}
					aria-selected={isSelected}
				>
					<div className="w-4 flex-shrink-0" />
					<Music className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
					<span className="text-sm truncate">{sample.name}</span>
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem
					className="text-destructive focus:text-destructive"
					onSelect={() => onDelete(sample)}
					disabled={isDeleting}
				>
					{isDeleting ? (
						<>
							<span className="mr-2">Deleting...</span>
							<svg
								className="animate-spin h-4 w-4"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								aria-label="Loading..."
							>
								<title>Loading...</title>
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
						</>
					) : (
						"Delete Sample"
					)}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
});

export function DirectoryBrowser({
	samples,
	onSampleSelect,
	selectedSample,
	onDragStart,
	onDragEnd,
}: DirectoryBrowserProps) {
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
		new Set(),
	);
	const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
	const [requestingPermission, setRequestingPermission] = useState<Set<string>>(
		new Set(),
	);
	const playerRef = useRef<Tone.Player | null>(null);
	const nodesRef = useRef<Map<string, Node>>(new Map());
	const containerRef = useRef<HTMLDivElement>(null);
	const [selectedPath, setSelectedPath] = useState<string>("/");
	const queryClient = useQueryClient();

	// Add a ref to track the selected sample element
	const selectedSampleRef = useRef<HTMLDivElement>(null);
	// Add ref to track if sample was selected via direct click
	const wasClickedRef = useRef(false);

	// Query for directory permissions
	const { data: directories = [] } = useQuery({
		queryKey: ["directories"],
		queryFn: () => storage.getDirectories(),
	});

	// Clean up player on unmount
	useEffect(() => {
		return () => {
			if (playerRef.current) {
				playerRef.current.dispose();
			}
		};
	}, []);

	// Modify the play sample effect to only play on direct clicks
	useEffect(() => {
		const playSample = async () => {
			if (
				!selectedSample?.filePath ||
				!selectedSample?.directoryId ||
				!wasClickedRef.current
			)
				return;

			try {
				// Stop and dispose previous player
				if (playerRef.current) {
					playerRef.current.stop();
					playerRef.current.dispose();
				}

				// Get the file from the file system
				const file = await storage.getFile(
					selectedSample.filePath,
					selectedSample.directoryId,
				);
				const arrayBuffer = await file.arrayBuffer();

				// Decode the audio data first
				const audioContext = new AudioContext();
				const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

				// Create Tone.js buffer from the decoded audio data
				const buffer = new Tone.ToneAudioBuffer();
				buffer.fromArray(audioBuffer.getChannelData(0));

				// Create new player with the buffer
				const player = new Tone.Player(buffer).toDestination();
				playerRef.current = player;

				// Make sure context is running
				if (Tone.context.state !== "running") {
					await Tone.start();
				}

				// Play the sample
				player.start();
			} catch (error) {
				console.error("Error playing sample:", error);
			} finally {
				// Reset the click flag after playing
				wasClickedRef.current = false;
			}
		};

		playSample();
	}, [selectedSample]);

	// Effect to handle expanding folders and scrolling when a sample is selected
	useEffect(() => {
		if (selectedSample) {
			// Find the sample's path in the tree
			const sampleNode = Array.from(nodesRef.current.values()).find(
				(n) => n.type === "sample" && n.sample.id === selectedSample.id,
			);

			if (sampleNode) {
				// Get all parent folders
				const pathParts = sampleNode.path.split("/").filter(Boolean);
				const parentPaths = pathParts.reduce<string[]>((paths, part, index) => {
					const path = index === 0 ? part : `${paths[index - 1]}/${part}`;
					paths.push(path);
					return paths;
				}, []);

				// Expand all parent folders
				setExpandedFolders((prev) => {
					const next = new Set(prev);
					for (const path of parentPaths) {
						next.add(path);
					}
					return next;
				});

				// Wait for the DOM to update after expanding folders
				setTimeout(() => {
					if (selectedSampleRef.current && containerRef.current) {
						selectedSampleRef.current.scrollIntoView({
							behavior: "smooth",
							block: "nearest",
						});
					}
				}, 100);
			}
		}
	}, [selectedSample]);

	// Build tree structure from flat samples array
	const tree = useMemo(() => {
		nodesRef.current.clear();
		const root: FolderNode = {
			type: "folder",
			name: "",
			path: "/",
			children: [],
			samples: [],
		};
		nodesRef.current.set("/", root);

		// Create a function to ensure a path exists and return its node
		const ensurePath = (path: string): FolderNode => {
			if (path === "/" || path === "") return root;

			const parts = path.split("/").filter(Boolean);
			let current = root;

			for (const part of parts) {
				let child = current.children.find(
					(c): c is FolderNode => c.type === "folder" && c.name === part,
				);

				if (!child) {
					child = {
						type: "folder",
						name: part,
						path: current.path === "/" ? part : `${current.path}/${part}`,
						children: [],
						samples: [],
					};
					current.children.push(child);
					nodesRef.current.set(child.path, child);
				}

				current = child;
			}

			return current;
		};

		// Add all samples to the tree
		for (const sample of samples) {
			const directory =
				sample.directoryPath === "/" ? "" : sample.directoryPath;
			const parent = ensurePath(directory);
			const node: SampleNode = {
				type: "sample",
				name: sample.name,
				path: `${parent.path === "/" ? "" : parent.path}/${sample.name}`,
				sample: sample,
			};
			parent.samples.push(sample);
			parent.children.push(node);
			nodesRef.current.set(node.path, node);
		}

		// Sort function: directories first, then alphabetically
		const sortNodes = (a: Node, b: Node) => {
			if (a.type !== b.type) {
				return a.type === "folder" ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		};

		// Sort all levels of the tree
		const sortTree = (node: FolderNode) => {
			node.children.sort(sortNodes);
			for (const child of node.children) {
				if (child.type === "folder") {
					sortTree(child);
				}
			}
		};

		sortTree(root);
		return root;
	}, [samples]);

	const toggleFolder = useCallback((path: string) => {
		setExpandedFolders((prev) => {
			const next = new Set(prev);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	}, []);

	const getVisibleNodes = useCallback(() => {
		const visibleNodes: Node[] = [];

		const addVisibleNodes = (node: Node) => {
			if (node.path === "/" && node.type === "folder") {
				// For root, only process children
				for (const child of node.children) {
					addVisibleNodes(child);
				}
				return;
			}

			visibleNodes.push(node);

			// Add children if it's an expanded directory
			if (node.type === "folder" && expandedFolders.has(node.path)) {
				for (const child of node.children) {
					addVisibleNodes(child);
				}
			}
		};

		// Start from root
		addVisibleNodes(tree);
		return visibleNodes;
	}, [expandedFolders, tree]);

	// Add global keyboard handler
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Find current node based on either selected sample or selected path
			const currentNode = Array.from(nodesRef.current.values()).find(
				(n) =>
					(n.type === "sample" && n.sample?.id === selectedSample?.id) ||
					(n.type === "folder" && n.path === selectedPath),
			);

			if (!currentNode) return;

			switch (e.key) {
				case "ArrowDown": {
					e.preventDefault();
					const visibleNodes = getVisibleNodes();
					const currentIndex = visibleNodes.findIndex(
						(n) => n.path === currentNode.path,
					);
					const nextNode = visibleNodes[currentIndex + 1];
					if (nextNode) {
						if (nextNode.type === "sample" && nextNode.sample) {
							onSampleSelect(nextNode.sample);
							setSelectedPath("");
						} else {
							setSelectedPath(nextNode.path);
							// Clear sample selection when selecting a directory
							queryClient.setQueryData(["selectedSample"], null);
						}
					}
					break;
				}
				case "ArrowUp": {
					e.preventDefault();
					const visibleNodes = getVisibleNodes();
					const currentIndex = visibleNodes.findIndex(
						(n) => n.path === currentNode.path,
					);
					const prevNode = visibleNodes[currentIndex - 1];
					if (prevNode) {
						if (prevNode.type === "sample" && prevNode.sample) {
							onSampleSelect(prevNode.sample);
							setSelectedPath("");
						} else {
							setSelectedPath(prevNode.path);
							// Clear sample selection when selecting a directory
							queryClient.setQueryData(["selectedSample"], null);
						}
					}
					break;
				}
				case "ArrowRight": {
					e.preventDefault();
					if (currentNode.type === "folder") {
						if (!expandedFolders.has(currentNode.path)) {
							toggleFolder(currentNode.path);
							// Select first child if available
							const firstChild = currentNode.children[0];
							if (firstChild) {
								if (firstChild.type === "sample" && firstChild.sample) {
									onSampleSelect(firstChild.sample);
								} else {
									setSelectedPath(firstChild.path);
								}
							}
						}
					} else {
						const parentPath = currentNode.path
							.split("/")
							.slice(0, -1)
							.join("/");
						const parent = nodesRef.current.get(parentPath);
						if (
							parent?.type === "folder" &&
							!expandedFolders.has(parent.path)
						) {
							toggleFolder(parent.path);
						}
					}
					break;
				}
				case "ArrowLeft": {
					e.preventDefault();
					if (currentNode.type === "folder") {
						if (expandedFolders.has(currentNode.path)) {
							toggleFolder(currentNode.path);
						} else {
							// Go to parent directory
							const parentPath = currentNode.path
								.split("/")
								.slice(0, -1)
								.join("/");
							const parent = nodesRef.current.get(parentPath);
							if (parent?.type === "folder" && parent.path !== "/") {
								setSelectedPath(parent.path);
							}
						}
					} else {
						// For samples, go to parent directory
						const parentPath = currentNode.path
							.split("/")
							.slice(0, -1)
							.join("/");
						const parent = nodesRef.current.get(parentPath);
						if (parent?.type === "folder" && parent.path !== "/") {
							setSelectedPath(parent.path);
						}
					}
					break;
				}
				case "Enter":
				case " ": {
					e.preventDefault();
					if (currentNode.type === "folder") {
						toggleFolder(currentNode.path);
					} else if (currentNode.sample) {
						onSampleSelect(currentNode.sample);
					}
					break;
				}
			}
		};

		const container = containerRef.current;
		if (container) {
			container.addEventListener("keydown", handleKeyDown);
			return () => container.removeEventListener("keydown", handleKeyDown);
		}
	}, [
		selectedSample,
		selectedPath,
		expandedFolders,
		onSampleSelect,
		getVisibleNodes,
		toggleFolder,
		queryClient,
	]);

	const handleSampleSelect = useCallback(
		(sample: Sample) => {
			onSampleSelect(sample);
			setSelectedPath("");
		},
		[onSampleSelect],
	);

	const handleSampleDragStart = useCallback(
		(e: React.DragEvent, sample: Sample) => {
			e.stopPropagation();
			onDragStart("sample", sample);
			e.dataTransfer.setData("application/json", JSON.stringify(sample));

			// Create drag preview
			const dragPreview = document.createElement("div");
			dragPreview.className =
				"fixed left-0 top-0 bg-background border rounded-md p-2 pointer-events-none flex items-center gap-2 text-xs";
			dragPreview.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 2v20M2 12h20" />
			</svg>
			<span class="font-mono">audio</span>
		`;
			document.body.appendChild(dragPreview);
			e.dataTransfer.setDragImage(dragPreview, 20, 20);
			setTimeout(() => document.body.removeChild(dragPreview), 0);
		},
		[onDragStart],
	);

	const handleFolderDragStart = (e: React.DragEvent, node: Node) => {
		e.stopPropagation();
		const folderData = {
			path: node.path,
			samples: getAllSamplesInFolder(node),
		};
		onDragStart("folder", folderData);
		e.dataTransfer.setData(
			"application/json",
			JSON.stringify({
				type: "folder",
				...folderData,
			}),
		);

		// Create drag preview
		const dragPreview = document.createElement("div");
		dragPreview.className =
			"fixed left-0 top-0 bg-background border rounded-md p-2 pointer-events-none flex items-center gap-2 text-xs";
		dragPreview.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
			</svg>
			<span class="font-mono">${node.name}</span>
		`;
		document.body.appendChild(dragPreview);
		e.dataTransfer.setDragImage(dragPreview, 20, 20);
		setTimeout(() => document.body.removeChild(dragPreview), 0);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	const handleDeleteSample = useCallback(
		async (sample: Sample) => {
			try {
				setDeletingItems((prev) => new Set(prev).add(sample.id));

				// Delete the sample from IndexedDB
				await storage.removeSample(sample.id);

				// Invalidate samples query to refresh the list
				queryClient.invalidateQueries({ queryKey: ["samples"] });
			} catch (error) {
				console.error("Error deleting sample:", error);
			} finally {
				setDeletingItems((prev) => {
					const next = new Set(prev);
					next.delete(sample.id);
					return next;
				});
			}
		},
		[deletingItems, onSampleSelect, queryClient],
	);

	const handleDeleteFolder = async (path: string, samples: Sample[]) => {
		try {
			setDeletingItems((prev) => new Set(prev).add(path));

			// Find the directory in our list
			const directory = directories.find((d) => d.path === path);
			if (!directory) {
				console.error("Directory not found:", path);
				return;
			}

			// Remove the directory and all its samples
			await storage.removeDirectory(directory.id);

			// Remove folder from expanded state
			setExpandedFolders((prev) => {
				const next = new Set(prev);
				next.delete(path);
				return next;
			});

			// Refresh the directories list
			queryClient.invalidateQueries({ queryKey: ["directories"] });
			queryClient.invalidateQueries({ queryKey: ["samples"] });
		} catch (error) {
			console.error("Error deleting folder:", error);
		} finally {
			setDeletingItems((prev) => {
				const next = new Set(prev);
				next.delete(path);
				return next;
			});
		}
	};

	const handleRequestPermission = async (directoryId: string) => {
		try {
			setRequestingPermission((prev) => new Set(prev).add(directoryId));
			const granted = await storage.requestDirectoryPermission(directoryId);
			if (granted) {
				// Refresh directories list
				queryClient.invalidateQueries({ queryKey: ["directories"] });
				queryClient.invalidateQueries({ queryKey: ["samples"] });
			}
		} catch (error) {
			console.error("Error requesting permission:", error);
		} finally {
			setRequestingPermission((prev) => {
				const next = new Set(prev);
				next.delete(directoryId);
				return next;
			});
		}
	};

	const renderNode = (node: Node) => {
		const isExpanded = expandedFolders.has(node.path);
		const isSelected =
			node.type === "sample"
				? node.sample?.id === selectedSample?.id
				: node.path === selectedPath;
		const showHighlight = node.type === "sample" && isSelected;

		if (
			node.path === "/" &&
			node.type === "folder" &&
			node.children.length > 0
		) {
			return (
				<div className="space-y-1">
					{node.children.map((child) => renderNode(child))}
				</div>
			);
		}

		const level = node.path.split("/").length - 1;
		const directory = directories.find((d) => d.path === node.path);
		const needsPermission = directory && !directory.hasPermission;
		const isRequestingPermission =
			directory && requestingPermission.has(directory.id);

		if (node.type === "sample") {
			return (
				<SampleRow
					key={node.sample.id}
					sample={node.sample}
					path={node.path}
					level={level}
					isSelected={isSelected}
					showHighlight={showHighlight}
					needsPermission={!!needsPermission}
					onSelect={handleSampleSelect}
					onDragStart={handleSampleDragStart}
					onDragEnd={onDragEnd}
					selectedSampleRef={selectedSampleRef}
					onDelete={handleDeleteSample}
					isDeleting={deletingItems.has(node.sample.id)}
				/>
			);
		}

		// At this point, node must be a folder
		return (
			<Fragment key={node.path}>
				<ContextMenu>
					<ContextMenuTrigger>
						<div
							draggable={!needsPermission}
							onDragStart={(e) => handleFolderDragStart(e, node)}
							onDragEnd={onDragEnd}
							key={node.path}
							style={{ marginLeft: `${level * 16}px` }}
							className={`
								flex flex-col gap-1
								${showHighlight ? "bg-primary/10" : "hover:bg-muted/50"}
								${isSelected && !showHighlight ? "bg-muted/30" : ""}
								${needsPermission ? "opacity-50" : ""}
							`}
						>
							<div
								className="flex items-center gap-2 p-1 rounded-md outline-none"
								onClick={() => {
									if (needsPermission && directory) {
										handleRequestPermission(directory.id);
									} else {
										setSelectedPath(node.path);
										queryClient.setQueryData(["selectedSample"], null);
										toggleFolder(node.path);
									}
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										if (needsPermission && directory) {
											handleRequestPermission(directory.id);
										} else {
											setSelectedPath(node.path);
											toggleFolder(node.path);
										}
									}
								}}
								role="treeitem"
								tabIndex={isSelected ? 0 : -1}
								aria-selected={isSelected}
								aria-expanded={isExpanded}
							>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										if (!needsPermission) {
											toggleFolder(node.path);
										}
									}}
									className="p-0.5 hover:bg-muted rounded"
									aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.name} folder`}
								>
									{isExpanded ? (
										<ChevronDown className="h-4 w-4 text-muted-foreground" />
									) : (
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									)}
								</button>
								<div className="flex items-center gap-2 cursor-pointer">
									{needsPermission ? (
										<Lock className="h-4 w-4 text-muted-foreground" />
									) : (
										<Folder className="h-4 w-4 text-muted-foreground" />
									)}
									<span className="text-sm">{node.name}</span>
									{isRequestingPermission && (
										<svg
											className="animate-spin h-4 w-4 text-muted-foreground"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											aria-label="Requesting permission..."
										>
											<title>Requesting permission...</title>
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
									)}
								</div>
							</div>
						</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						{needsPermission && directory ? (
							<>
								<ContextMenuItem
									onSelect={() => handleRequestPermission(directory.id)}
									disabled={isRequestingPermission}
								>
									Request Permission
								</ContextMenuItem>
								<ContextMenuItem
									className="text-destructive focus:text-destructive"
									onSelect={() => handleDeleteFolder(node.path, samples)}
									disabled={deletingItems.has(node.path)}
								>
									{deletingItems.has(node.path) ? (
										<>
											<span className="mr-2">Deleting...</span>
											<svg
												className="animate-spin h-4 w-4"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												aria-label="Deleting folder..."
											>
												<title>Deleting folder...</title>
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
										</>
									) : (
										"Remove Directory"
									)}
								</ContextMenuItem>
							</>
						) : (
							<ContextMenuItem
								className="text-destructive focus:text-destructive"
								onSelect={() => handleDeleteFolder(node.path, samples)}
								disabled={deletingItems.has(node.path)}
							>
								{deletingItems.has(node.path) ? (
									<>
										<span className="mr-2">Deleting...</span>
										<svg
											className="animate-spin h-4 w-4"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											aria-label="Deleting folder..."
										>
											<title>Deleting folder...</title>
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
									</>
								) : (
									"Delete Folder"
								)}
							</ContextMenuItem>
						)}
					</ContextMenuContent>
				</ContextMenu>
				{isExpanded && !needsPermission && (
					<div className="space-y-1">
						{node.children.map((child) => renderNode(child))}
					</div>
				)}
			</Fragment>
		);
	};

	const getAllSamplesInFolder = (node: Node): Sample[] => {
		const samples: Sample[] = [];

		const traverse = (node: Node) => {
			if (node.type === "sample") {
				samples.push(node.sample);
			} else {
				node.children.forEach(traverse);
			}
		};

		traverse(node);
		return samples;
	};

	return (
		<div
			ref={containerRef}
			className="p-2 focus:outline-none"
			role="tree"
			aria-label="Sample browser"
		>
			{renderNode(tree)}
		</div>
	);
}

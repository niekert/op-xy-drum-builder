"use client";

import {
	useState,
	useMemo,
	useRef,
	useEffect,
	useCallback,
	Fragment,
} from "react";
import { ChevronRight, ChevronDown, Folder, Music } from "lucide-react";
import * as Tone from "tone";
import type { Sample } from "./sample-list";
import { useQueryClient } from "@tanstack/react-query";

type TreeNode = {
	name: string;
	path: string;
	type: "directory" | "sample";
	children: TreeNode[];
	sample?: Sample;
};

type DirectoryBrowserProps = {
	samples: Sample[];
	onSampleSelect: (sample: Sample) => void;
	selectedSample: Sample | null;
	onDragStart: (
		type: "folder" | "sample",
		data: Sample | { path: string; samples: Sample[] },
	) => void;
	onDragEnd: () => void;
};

export function DirectoryBrowser({
	samples,
	onSampleSelect,
	selectedSample,
	onDragStart,
	onDragEnd,
}: DirectoryBrowserProps) {
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
	const playerRef = useRef<Tone.Player | null>(null);
	const nodesRef = useRef<Map<string, TreeNode>>(new Map());
	const containerRef = useRef<HTMLDivElement>(null);
	const [selectedPath, setSelectedPath] = useState<string>("/");
	const queryClient = useQueryClient();

	// Clean up player on unmount
	useEffect(() => {
		return () => {
			if (playerRef.current) {
				playerRef.current.dispose();
			}
		};
	}, []);

	// Play sample when selection changes
	useEffect(() => {
		const playSample = async () => {
			if (!selectedSample?.url) return;

			try {
				// Stop and dispose previous player
				if (playerRef.current) {
					playerRef.current.stop();
					playerRef.current.dispose();
				}

				// Create new player
				const player = new Tone.Player(selectedSample.url).toDestination();
				playerRef.current = player;

				await player.load(selectedSample.url);

				// Make sure context is running
				if (Tone.context.state !== "running") {
					await Tone.start();
				}

				// Play the sample
				player.start();
			} catch (error) {
				console.error("Error playing sample:", error);
			}
		};

		playSample();
	}, [selectedSample]);

	// Build tree structure from flat samples array
	const tree = useMemo(() => {
		nodesRef.current.clear();
		const root: TreeNode = {
			name: "",
			path: "/",
			type: "directory",
			children: [],
		};
		nodesRef.current.set("/", root);

		// Helper function to ensure a directory path exists
		const ensurePath = (path: string) => {
			if (path === "/" || !path) return root;

			const parts = path.split("/").filter(Boolean);
			let current = root;

			for (const part of parts) {
				let child = current.children.find((c) => c.name === part);
				if (!child) {
					child = {
						name: part,
						path: current.path === "/" ? part : `${current.path}/${part}`,
						type: "directory",
						children: [],
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
			const directory = sample.directory === "/" ? "" : sample.directory;
			const parent = ensurePath(directory);
			const node: TreeNode = {
				name: sample.name,
				path: `${parent.path === "/" ? "" : parent.path}/${sample.name}`,
				type: "sample" as const,
				children: [],
				sample,
			};
			parent.children.push(node);
			nodesRef.current.set(node.path, node);
		}

		// Sort function: directories first, then alphabetically
		const sortNodes = (a: TreeNode, b: TreeNode) => {
			if (a.type !== b.type) {
				return a.type === "directory" ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		};

		// Sort all levels of the tree
		const sortTree = (node: TreeNode) => {
			node.children.sort(sortNodes);
			node.children.forEach(sortTree);
		};

		sortTree(root);
		return root;
	}, [samples]);

	const toggleExpand = useCallback((path: string) => {
		setExpandedPaths((prev) => {
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
		const visibleNodes: TreeNode[] = [];

		const addVisibleNodes = (node: TreeNode) => {
			if (node.path === "/") {
				// For root, only process children
				node.children.forEach(addVisibleNodes);
				return;
			}

			visibleNodes.push(node);

			// Add children if it's an expanded directory
			if (node.type === "directory" && expandedPaths.has(node.path)) {
				node.children.forEach(addVisibleNodes);
			}
		};

		// Start from root
		addVisibleNodes(tree);
		return visibleNodes;
	}, [expandedPaths, tree]);

	// Add global keyboard handler
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Find current node based on either selected sample or selected path
			const currentNode = Array.from(nodesRef.current.values()).find(
				(n) =>
					(n.type === "sample" && n.sample?.id === selectedSample?.id) ||
					(n.type === "directory" && n.path === selectedPath),
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
					if (currentNode.type === "directory") {
						if (!expandedPaths.has(currentNode.path)) {
							toggleExpand(currentNode.path);
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
							parent?.type === "directory" &&
							!expandedPaths.has(parent.path)
						) {
							toggleExpand(parent.path);
						}
					}
					break;
				}
				case "ArrowLeft": {
					e.preventDefault();
					if (currentNode.type === "directory") {
						if (expandedPaths.has(currentNode.path)) {
							toggleExpand(currentNode.path);
						} else {
							// Go to parent directory
							const parentPath = currentNode.path
								.split("/")
								.slice(0, -1)
								.join("/");
							const parent = nodesRef.current.get(parentPath);
							if (parent?.type === "directory" && parent.path !== "/") {
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
						if (parent?.type === "directory" && parent.path !== "/") {
							setSelectedPath(parent.path);
						}
					}
					break;
				}
				case "Enter":
				case " ": {
					e.preventDefault();
					if (currentNode.type === "directory") {
						toggleExpand(currentNode.path);
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
		expandedPaths,
		onSampleSelect,
		getVisibleNodes,
		toggleExpand,
		queryClient,
	]);

	const handleSampleDragStart = (e: React.DragEvent, sample: Sample) => {
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
	};

	const handleFolderDragStart = (e: React.DragEvent, node: TreeNode) => {
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

	const renderNode = (node: TreeNode) => {
		const isExpanded = expandedPaths.has(node.path);
		const isSelected =
			node.type === "sample"
				? node.sample?.id === selectedSample?.id
				: node.path === selectedPath;
		const showHighlight = node.type === "sample" && isSelected;

		if (node.path === "/" && node.children.length > 0) {
			return (
				<div className="space-y-1">
					{node.children.map((child) => renderNode(child))}
				</div>
			);
		}

		const level = node.path.split("/").length - 1;

		console.log("node", node);

		if (node.type === "sample") {
			return (
				<div
					draggable
					onDragStart={(e) =>
						node.sample && handleSampleDragStart(e, node.sample)
					}
					onDragEnd={onDragEnd}
					key={node.path}
					style={{ marginLeft: `${level * 16}px` }}
					className={`
						flex items-center gap-2 p-1 rounded-md outline-none
						${showHighlight ? "bg-primary/10" : "hover:bg-muted/50"}
						${isSelected && !showHighlight ? "bg-muted/30" : ""}
					`}
					onClick={(e) => {
						if (node.type === "directory") {
							e.stopPropagation();
							setSelectedPath(node.path);
							// Clear sample selection when selecting a directory
							queryClient.setQueryData(["selectedSample"], null);
							toggleExpand(node.path);
						} else if (node.sample) {
							onSampleSelect(node.sample);
							setSelectedPath("");
						}
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							if (node.type === "directory") {
								setSelectedPath(node.path);
								toggleExpand(node.path);
							} else if (node.sample) {
								onSampleSelect(node.sample);
							}
						}
					}}
					role="treeitem"
					tabIndex={isSelected ? 0 : -1}
					aria-selected={isSelected}
				>
					<div className="w-4 flex-shrink-0" /> {/* Spacing for alignment */}
					<Music className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
					<span className="text-sm truncate">{node.name}</span>
				</div>
			);
		}

		return (
			<Fragment key={node.path}>
				<div
					draggable
					onDragStart={(e) => handleFolderDragStart(e, node)}
					onDragEnd={onDragEnd}
					key={node.path}
					style={{ marginLeft: `${level * 16}px` }}
					className={`
					flex flex-col gap-1
					${showHighlight ? "bg-primary/10" : "hover:bg-muted/50"}
					${isSelected && !showHighlight ? "bg-muted/30" : ""}
				`}
				>
					<div
						className="flex items-center gap-2 p-1 rounded-md outline-none"
						onClick={(e) => {
							if (node.type === "directory") {
								e.stopPropagation();
								setSelectedPath(node.path);
								// Clear sample selection when selecting a directory
								queryClient.setQueryData(["selectedSample"], null);
								toggleExpand(node.path);
							} else if (node.sample) {
								onSampleSelect(node.sample);
								setSelectedPath("");
							}
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								if (node.type === "directory") {
									setSelectedPath(node.path);
									toggleExpand(node.path);
								} else if (node.sample) {
									onSampleSelect(node.sample);
								}
							}
						}}
						role="treeitem"
						tabIndex={isSelected ? 0 : -1}
						aria-selected={isSelected}
						aria-expanded={node.type === "directory" ? isExpanded : undefined}
					>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								toggleExpand(node.path);
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
						<div className="flex items-center gap-2 cursor-grab active:cursor-grabbing">
							<Folder className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm">{node.name}</span>
						</div>
					</div>
				</div>
				{isExpanded && (
					<div className="space-y-1">
						{node.children.map((child) => renderNode(child))}
					</div>
				)}
			</Fragment>
		);
	};

	const getAllSamplesInFolder = (node: TreeNode): Sample[] => {
		const samples: Sample[] = [];

		const traverse = (node: TreeNode) => {
			if (node.type === "sample" && node.sample) {
				samples.push(node.sample);
			}
			node.children.forEach(traverse);
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

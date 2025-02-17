"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import * as Tone from "tone";
import type { Sample } from "./sample-list";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Save, FolderOpen } from "lucide-react";
import JSZip from "jszip";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";

type Key = {
	note: string;
	sample?: Sample;
	isBlack: boolean;
	isLoading?: boolean;
};

type DrumRack = {
	id: string;
	name: string;
	configuration: {
		keys: Key[];
	};
	created_at: string;
};

const INITIAL_KEYS: Key[] = [
	{ note: "C2", isBlack: false },
	{ note: "C#2", isBlack: true },
	{ note: "D2", isBlack: false },
	{ note: "D#2", isBlack: true },
	{ note: "E2", isBlack: false },
	{ note: "F2", isBlack: false },
	{ note: "F#2", isBlack: true },
	{ note: "G2", isBlack: false },
	{ note: "G#2", isBlack: true },
	{ note: "A2", isBlack: false },
	{ note: "A#2", isBlack: true },
	{ note: "B2", isBlack: false },
	{ note: "C3", isBlack: false },
	{ note: "C#3", isBlack: true },
	{ note: "D3", isBlack: false },
	{ note: "D#3", isBlack: true },
	{ note: "E3", isBlack: false },
	{ note: "F3", isBlack: false },
	{ note: "F#3", isBlack: true },
	{ note: "G3", isBlack: false },
	{ note: "G#3", isBlack: true },
	{ note: "A3", isBlack: false },
	{ note: "A#3", isBlack: true },
	{ note: "B3", isBlack: false },
	{ note: "C4", isBlack: false },
];

// Default patch settings matching the example
const DEFAULT_PATCH = {
	engine: {
		bendrange: 8191,
		highpass: 0,
		modulation: {
			aftertouch: { amount: 21953, target: 18022 },
			modwheel: { amount: 32767, target: 0 },
			pitchbend: { amount: 16710, target: 0 },
			velocity: { amount: 16384, target: 0 },
		},
		params: [16384, 16384, 16384, 16384, 16384, 16384, 16384, 16384],
		playmode: "mono",
		"portamento.amount": 128,
		"portamento.type": 32767,
		transpose: 0,
		"tuning.root": 0,
		"tuning.scale": 3045,
		"velocity.sensitivity": 6879,
		volume: 24901,
		width: 0,
	},
	envelope: {
		amp: { attack: 0, decay: 0, release: 0, sustain: 32767 },
		filter: {},
	},
	fx: {
		active: false,
		params: [0, 3276, 11120, 5632, 0, 32767, 0, 0],
		type: "svf",
	},
	lfo: {
		active: false,
		params: [23095, 16384, 15889, 16000, 0, 0, 0, 0],
		type: "tremolo",
	},
	octave: 0,
	platform: "OP-XY",
	type: "drum",
	version: 4,
};

export function PianoKeys() {
	const queryClient = useQueryClient();
	const [keys, setKeys] = useState<Key[]>(INITIAL_KEYS);
	const [activeKey, setActiveKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoadOpen, setIsLoadOpen] = useState(false);
	const [isSaveOpen, setIsSaveOpen] = useState(false);
	const [rackName, setRackName] = useState("");
	const [drumRacks, setDrumRacks] = useState<DrumRack[]>([]);
	const [currentRack, setCurrentRack] = useState<DrumRack | null>(null);
	const playersRef = useRef<Record<string, Tone.Player>>({});
	const buffersRef = useRef<Record<string, Tone.ToneAudioBuffer>>({});

	// Fetch drum racks
	useEffect(() => {
		const fetchDrumRacks = async () => {
			const { data, error } = await supabase
				.from("drum_racks")
				.select("*")
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Error fetching drum racks:", error);
				return;
			}

			setDrumRacks(data || []);
		};

		fetchDrumRacks();
	}, []);

	// Initialize Tone.js
	useEffect(() => {
		const initTone = async () => {
			await Tone.start();
		};
		initTone();

		return () => {
			// Cleanup players and buffers
			for (const player of Object.values(playersRef.current)) {
				player.dispose();
			}
			for (const buffer of Object.values(buffersRef.current)) {
				buffer.dispose();
			}
		};
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent, targetNote: string) => {
			e.preventDefault();
			setError(null);

			try {
				const sample = JSON.parse(
					e.dataTransfer.getData("application/json"),
				) as Sample;

				// Mark key as loading
				setKeys((prev) =>
					prev.map((key) =>
						key.note === targetNote ? { ...key, isLoading: true } : key,
					),
				);

				// Clean up old resources
				if (playersRef.current[targetNote]) {
					playersRef.current[targetNote].dispose();
					delete playersRef.current[targetNote];
				}
				if (buffersRef.current[targetNote]) {
					buffersRef.current[targetNote].dispose();
					delete buffersRef.current[targetNote];
				}

				// Load new buffer
				const buffer = await Tone.Buffer.fromUrl(sample.url);
				buffersRef.current[targetNote] = buffer;

				// Create new player
				const player = new Tone.Player(buffer).toDestination();
				playersRef.current[targetNote] = player;

				// Update key state
				setKeys((prev) =>
					prev.map((key) =>
						key.note === targetNote
							? { ...key, sample, isLoading: false }
							: key,
					),
				);
			} catch (error) {
				console.error("Failed to handle sample:", error);
				setError(typeof error === "string" ? error : "Failed to load sample");
				setKeys((prev) =>
					prev.map((key) =>
						key.note === targetNote ? { ...key, isLoading: false } : key,
					),
				);

				// Clean up on error
				if (playersRef.current[targetNote]) {
					playersRef.current[targetNote].dispose();
					delete playersRef.current[targetNote];
				}
				if (buffersRef.current[targetNote]) {
					buffersRef.current[targetNote].dispose();
					delete buffersRef.current[targetNote];
				}
			}
		},
		[],
	);

	const handleKeyClick = useCallback(
		async (note: string) => {
			setActiveKey(note);
			setError(null);

			const player = playersRef.current[note];
			const buffer = buffersRef.current[note];
			const key = keys.find((k) => k.note === note);

			if (player && buffer && key?.sample) {
				try {
					// Make sure context is running
					if (Tone.context.state !== "running") {
						await Tone.start();
					}

					// Make sure the buffer is loaded
					if (!buffer.loaded) {
						setError("Sample is still loading...");
						return;
					}

					// Stop and restart the player immediately
					player.stop().start();

					// Update the selected sample in the cache
					queryClient.setQueryData(["selectedSample"], key.sample);

					// Analyze the sample for waveform
					const audioBuffer = buffer.get();
					if (audioBuffer) {
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

						queryClient.setQueryData(["waveform"], {
							peaks,
							duration: audioBuffer.duration,
						});
					}
				} catch (error) {
					console.error("Error playing sample:", error);
					setError("Failed to play sample");
				}
			}
			// Reset active key after 100ms
			setTimeout(() => setActiveKey(null), 100);
		},
		[keys, queryClient],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
	}, []);

	const handleDownload = useCallback(async () => {
		// Create a new zip file
		const zip = new JSZip();

		// Get all mapped samples
		const mappedKeys = keys.filter((key) => key.sample);

		// Create regions array for patch.json
		const regions = mappedKeys.map((key) => {
			// Convert note to MIDI note number (e.g., "C3" -> 48)
			const midiNote = getMidiNoteNumber(key.note);

			return {
				"fade.in": 0,
				"fade.out": 0,
				framecount: 0, // We don't have this info
				hikey: midiNote,
				lokey: midiNote,
				pan: 0,
				"pitch.keycenter": 60,
				playmode: "oneshot",
				reverse: false,
				sample: key.sample?.name ?? "",
				"sample.end": 0, // We don't have this info
				transpose: 0,
				tune: 0,
			};
		});

		// Create patch.json
		const patch = {
			...DEFAULT_PATCH,
			regions,
		};

		// Add patch.json to zip
		zip.file("patch.json", JSON.stringify(patch, null, 2));

		// Add all mapped samples to the zip
		const downloadPromises = mappedKeys.map(async (key) => {
			if (!key.sample?.url) return;

			try {
				// Fetch the sample file
				const response = await fetch(key.sample.url);
				const blob = await response.blob();

				// Add to zip with original filename
				zip.file(key.sample.name, blob);
			} catch (error) {
				console.error(`Failed to download ${key.sample.name}:`, error);
			}
		});

		try {
			// Wait for all downloads to complete
			await Promise.all(downloadPromises);

			// Generate the zip file
			const content = await zip.generateAsync({ type: "blob" });

			// Create download link and trigger download
			const url = URL.createObjectURL(content);
			const a = document.createElement("a");
			a.href = url;
			a.download = "OP-XY-patch.zip";
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Failed to create zip file:", error);
			setError("Failed to create download");
		}
	}, [keys]);

	const handleSave = async () => {
		if (!rackName.trim() && !currentRack) {
			setError("Please enter a name for the drum rack");
			return;
		}

		try {
			const configuration = {
				keys: keys.map(({ note, sample, isBlack }) => ({
					note,
					sample,
					isBlack,
				})),
			};

			let error: PostgrestError | null;
			if (currentRack) {
				// Update existing rack
				({ error } = await supabase
					.from("drum_racks")
					.update({
						configuration,
						updated_at: new Date().toISOString(),
					})
					.eq("id", currentRack.id));
			} else {
				// Create new rack
				({ error } = await supabase.from("drum_racks").insert({
					name: rackName.trim(),
					configuration,
				}));
			}

			if (error) throw error;

			// Refresh drum racks list
			const { data: updatedRacks } = await supabase
				.from("drum_racks")
				.select("*")
				.order("created_at", { ascending: false });

			setDrumRacks(updatedRacks || []);
			if (!currentRack) {
				setIsSaveOpen(false);
				setRackName("");
			}
			setError(null);
		} catch (error) {
			console.error("Error saving drum rack:", error);
			setError("Failed to save drum rack");
		}
	};

	const handleLoad = async (rack: DrumRack) => {
		try {
			// Clean up existing players and buffers
			for (const player of Object.values(playersRef.current)) {
				player.dispose();
			}
			for (const buffer of Object.values(buffersRef.current)) {
				buffer.dispose();
			}
			playersRef.current = {};
			buffersRef.current = {};

			// Load new configuration
			setKeys(rack.configuration.keys);
			setCurrentRack(rack);
			setRackName(rack.name);
			setIsLoadOpen(false);
			setError(null);

			// Load samples
			for (const key of rack.configuration.keys) {
				if (key.sample?.url) {
					try {
						const buffer = await Tone.Buffer.fromUrl(key.sample.url);
						buffersRef.current[key.note] = buffer;
						const player = new Tone.Player(buffer).toDestination();
						playersRef.current[key.note] = player;
					} catch (error) {
						console.error(`Failed to load sample for ${key.note}:`, error);
					}
				}
			}
		} catch (error) {
			console.error("Error loading drum rack:", error);
			setError("Failed to load drum rack");
		}
	};

	// Helper function to convert note name to MIDI note number
	function getMidiNoteNumber(note: string): number {
		const noteMap: Record<string, number> = {
			C: 0,
			"C#": 1,
			D: 2,
			"D#": 3,
			E: 4,
			F: 5,
			"F#": 6,
			G: 7,
			"G#": 8,
			A: 9,
			"A#": 10,
			B: 11,
		};

		const noteName = note.slice(0, -1); // Remove octave number
		const octave = Number.parseInt(note.slice(-1), 10); // Get octave number

		return noteMap[noteName] + (octave + 1) * 12;
	}

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{currentRack && (
						<span className="text-sm text-muted-foreground">
							Current Rack:{" "}
							<span className="font-medium text-foreground">
								{currentRack.name}
							</span>
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						className="gap-2"
						onClick={() => {
							setKeys(INITIAL_KEYS);
							setCurrentRack(null);
							setRackName("");
							// Clean up existing players and buffers
							for (const player of Object.values(playersRef.current)) {
								player.dispose();
							}
							for (const buffer of Object.values(buffersRef.current)) {
								buffer.dispose();
							}
							playersRef.current = {};
							buffersRef.current = {};
						}}
						disabled={!currentRack && !keys.some((k) => k.sample)}
					>
						<span>Clear</span>
					</Button>

					<Popover open={isLoadOpen} onOpenChange={setIsLoadOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="gap-2"
								disabled={drumRacks.length === 0}
							>
								<FolderOpen className="h-4 w-4" />
								<span>Load</span>
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-80">
							<div className="space-y-2">
								<h4 className="font-medium">Load Drum Rack</h4>
								<div className="max-h-[300px] overflow-auto space-y-2">
									{drumRacks.map((rack) => (
										<div key={rack.id} className="flex items-center gap-2">
											<Button
												variant="ghost"
												className="flex-1 justify-start font-normal"
												onClick={() => handleLoad(rack)}
											>
												{rack.name}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0 text-destructive hover:text-destructive"
												onClick={async () => {
													try {
														const { error } = await supabase
															.from("drum_racks")
															.delete()
															.eq("id", rack.id);

														if (error) throw error;

														// Refresh drum racks list
														const { data: updatedRacks } = await supabase
															.from("drum_racks")
															.select("*")
															.order("created_at", { ascending: false });

														setDrumRacks(updatedRacks || []);

														// If this was the current rack, clear it
														if (currentRack?.id === rack.id) {
															setCurrentRack(null);
															setRackName("");
														}
													} catch (error) {
														console.error("Error deleting drum rack:", error);
														setError("Failed to delete drum rack");
													}
												}}
											>
												<svg
													className="h-4 w-4"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
													aria-label="Delete drum rack"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
												</svg>
											</Button>
										</div>
									))}
								</div>
							</div>
						</PopoverContent>
					</Popover>

					<Popover open={isSaveOpen} onOpenChange={setIsSaveOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="gap-2"
								disabled={!keys.some((key) => key.sample)}
								onClick={() => {
									if (currentRack) {
										// If we have a current rack, save immediately
										handleSave();
									}
									// Otherwise, open the popover to enter a name
								}}
							>
								<Save className="h-4 w-4" />
								<span>{currentRack ? "Update" : "Save"}</span>
							</Button>
						</PopoverTrigger>
						{!currentRack && (
							<PopoverContent className="w-80">
								<div className="space-y-4">
									<h4 className="font-medium">Save Drum Rack</h4>
									<div className="space-y-2">
										<Input
											placeholder="Enter name..."
											value={rackName}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												setRackName(e.target.value)
											}
										/>
										<Button
											className="w-full"
											onClick={handleSave}
											disabled={!rackName.trim()}
										>
											Save
										</Button>
									</div>
								</div>
							</PopoverContent>
						)}
					</Popover>

					<Button
						variant="default"
						size="sm"
						className="gap-2"
						onClick={handleDownload}
						disabled={!keys.some((key) => key.sample)}
					>
						<Download className="h-4 w-4" />
						<span>Download</span>
					</Button>
				</div>
			</div>
			{error && (
				<div className="rounded-md bg-destructive/10 p-3">
					<p className="text-sm text-destructive">{error}</p>
				</div>
			)}
			<div className="h-48 w-full overflow-x-auto rounded-lg bg-card">
				<div className="relative h-full">
					{/* White keys */}
					<div
						className="grid h-full absolute inset-0"
						style={{
							gridTemplateColumns: `repeat(${keys.filter((k) => !k.isBlack).length * 8}, 1fr)`,
						}}
					>
						{keys
							.filter((k) => !k.isBlack)
							.map((key, index) => (
								<button
									key={key.note}
									type="button"
									style={{
										gridColumn: `${index * 8 + 1} / span 8`,
									}}
									className={`
									relative select-none h-full
									${activeKey === key.note ? "ring-2 ring-primary ring-offset-2" : ""}
								`}
									onClick={() => handleKeyClick(key.note)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											handleKeyClick(key.note);
										}
									}}
								>
									<div
										className={`
										absolute inset-0 flex flex-col items-center justify-end p-1
										transition-colors duration-100
										bg-background text-foreground border border-border
										${key.sample ? "bg-primary/10" : ""}
										${key.isLoading ? "animate-pulse" : ""}
										hover:bg-primary/20 cursor-pointer
									`}
										onDragOver={handleDragOver}
										onDrop={(e) => handleDrop(e, key.note)}
									>
										<div className="text-center space-y-1">
											{key.sample && (
												<div className="w-1.5 h-1.5 rounded-full bg-primary mx-auto" />
											)}
											<span className="text-[10px] font-mono">{key.note}</span>
										</div>
									</div>
								</button>
							))}
					</div>

					{/* Black keys */}
					<div
						className="grid h-3/5 absolute inset-x-0"
						style={{
							gridTemplateColumns: `repeat(${keys.filter((k) => !k.isBlack).length * 8}, 1fr)`,
						}}
					>
						{keys
							.filter((k) => k.isBlack)
							.map((key) => {
								// Find the index of this black key in the original array
								const keyIndex = keys.findIndex((k) => k.note === key.note);
								// Find the previous white key
								const prevWhiteKey = keys
									.slice(0, keyIndex)
									.reverse()
									.find((k) => !k.isBlack);
								// Get the index of the previous white key among white keys
								const prevWhiteKeyIndex = keys
									.filter((k) => !k.isBlack)
									.findIndex((k) => k.note === prevWhiteKey?.note);

								// Position black key between white keys
								const startColumn = prevWhiteKeyIndex * 8 + 7;

								return (
									<button
										key={key.note}
										type="button"
										style={{
											gridColumn: `${startColumn} / span 4`,
										}}
										className={`
											relative select-none h-full
											${activeKey === key.note ? "ring-2 ring-primary ring-offset-2" : ""}
										`}
										onClick={() => handleKeyClick(key.note)}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												handleKeyClick(key.note);
											}
										}}
									>
										<div
											className={`
												absolute inset-0 flex flex-col items-center justify-end p-1
												transition-colors duration-100
												bg-foreground text-background
												${key.sample ? "bg-primary/10" : ""}
												${key.isLoading ? "animate-pulse" : ""}
												hover:bg-primary/20 cursor-pointer
											`}
											onDragOver={handleDragOver}
											onDrop={(e) => handleDrop(e, key.note)}
										>
											<div className="text-center space-y-1">
												{key.sample && (
													<div className="w-1.5 h-1.5 rounded-full bg-primary mx-auto" />
												)}
												<span className="text-[10px] font-mono">
													{key.note}
												</span>
											</div>
										</div>
									</button>
								);
							})}
					</div>
				</div>
			</div>
		</div>
	);
}

"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import * as Tone from "tone";
import { storage } from "@/lib/storage";
import type { Sample, DrumRack } from "@/lib/storage";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Save, FolderOpen, HelpCircle } from "lucide-react";
import JSZip from "jszip";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Key = {
	note: string;
	sample?: Sample;
	isBlack: boolean;
	isLoading?: boolean;
};

const INITIAL_KEYS: Key[] = [
	{ note: "F2", isBlack: false },
	{ note: "F#2", isBlack: true },
	{ note: "G2", isBlack: false },
	{ note: "G#2", isBlack: true },
	{ note: "A3", isBlack: false },
	{ note: "A#3", isBlack: true },
	{ note: "B3", isBlack: false },
	{ note: "C3", isBlack: false },
	{ note: "C#3", isBlack: true },
	{ note: "D3", isBlack: false },
	{ note: "D#3", isBlack: true },
	{ note: "E3", isBlack: false },
	{ note: "F3", isBlack: false },
	{ note: "F#3", isBlack: true },
	{ note: "G3", isBlack: false },
	{ note: "G#3", isBlack: true },
	{ note: "A4", isBlack: false },
	{ note: "A#4", isBlack: true },
	{ note: "B4", isBlack: false },
	{ note: "C4", isBlack: false },
	{ note: "C#4", isBlack: true },
	{ note: "D4", isBlack: false },
	{ note: "D#4", isBlack: true },
	{ note: "E4", isBlack: false },
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

type DragItem = {
	type: "folder" | "sample";
	data: Sample | { path: string; samples: Sample[] };
} | null;

type PianoKeysProps = {
	dragItem: DragItem;
	selectedSample: Sample | null;
	onSampleSelect: (sample: Sample | null) => void;
};

export function PianoKeys({
	dragItem,
	selectedSample,
	onSampleSelect,
}: PianoKeysProps) {
	const queryClient = useQueryClient();
	const [keys, setKeys] = useState<Key[]>(INITIAL_KEYS);
	const [activeKey, setActiveKey] = useState<string | null>(null);
	const [hoverKey, setHoverKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoadOpen, setIsLoadOpen] = useState(false);
	const [isSaveOpen, setIsSaveOpen] = useState(false);
	const [rackName, setRackName] = useState("");
	const [drumRacks, setDrumRacks] = useState<DrumRack[]>([]);
	const [currentRack, setCurrentRack] = useState<DrumRack | null>(null);
	const playersRef = useRef<Record<string, Tone.Player>>({});
	const buffersRef = useRef<Record<string, Tone.ToneAudioBuffer>>({});
	const [presetName, setPresetName] = useState("");
	const [isDownloadOpen, setIsDownloadOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Fetch drum racks
	useEffect(() => {
		const fetchDrumRacks = async () => {
			try {
				const racks = await storage.getDrumRacks();
				setDrumRacks(racks);
			} catch (error) {
				console.error("Error fetching drum racks:", error);
			}
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

	// Focus input when popover opens
	useEffect(() => {
		if (isDownloadOpen) {
			// Small delay to ensure the popover is rendered
			setTimeout(() => inputRef.current?.focus(), 100);
		}
	}, [isDownloadOpen]);

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

				// Get the file from the file system
				const file = await storage.getFile(sample.filePath, sample.directoryId);
				const arrayBuffer = await file.arrayBuffer();

				// Decode the audio data first
				const audioContext = new AudioContext();
				const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

				// Create Tone.js buffer from the decoded audio data
				const buffer = new Tone.ToneAudioBuffer();
				buffer.fromArray(audioBuffer.getChannelData(0));

				// Create new player with the buffer
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

					// Update the selected sample
					onSampleSelect(key.sample);

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

						queryClient.setQueriesData(
							{ queryKey: ["waveform"] },
							{
								peaks,
								duration: audioBuffer.duration,
							},
						);
					}
				} catch (error) {
					console.error("Error playing sample:", error);
					setError("Failed to play sample");
				}
			}
			// Reset active key after 100ms
			setTimeout(() => setActiveKey(null), 100);
		},
		[keys, onSampleSelect, queryClient],
	);

	const categorizeSample = useCallback((filename: string): string => {
		const name = filename.toLowerCase();
		if (name.includes("kick")) return "kick";
		if (name.includes("snare")) return "snare";
		if (name.includes("rim") || name.includes("clap")) return "rim_clap";
		if (name.includes("hihat") || name.includes("hh") || name.includes("hat")) {
			if (name.includes("open")) return "open_hihat";
			return "closed_hihat";
		}
		if (name.includes("shaker")) return "closed_hihat";
		if (name.includes("tom")) return "tom";
		if (
			name.includes("cymbal") ||
			name.includes("crash") ||
			name.includes("ride")
		)
			return "cymbal";
		if (name.includes("perc")) return "perc";
		return "other";
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent, note: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
		setHoverKey(note);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setHoverKey(null);
	}, []);

	const handleDownloadClick = () => {
		if (currentRack) {
			// If we have a current rack, use its name and download directly
			setPresetName(currentRack.name);
			handleDownload();
			return;
		}

		if (!presetName) {
			setIsDownloadOpen(true);
			return;
		}
		handleDownload();
	};

	const handleDownload = useCallback(async () => {
		// First save the preset if we don't have a current rack
		if (!currentRack) {
			try {
				const configuration = {
					keys: keys.map(({ note, sample, isBlack }) => ({
						note,
						sample,
						isBlack,
					})),
				};

				const newRack = await storage.addDrumRack(
					presetName.trim(),
					configuration,
				);
				setDrumRacks(await storage.getDrumRacks());
				setCurrentRack(newRack);
				setRackName(newRack.name);
			} catch (error) {
				console.error("Error saving drum rack:", error);
				setError("Failed to save drum rack");
				return;
			}
		}

		// Create a new zip file
		const zip = new JSZip();

		// Create folder structure
		const drumbuilderFolder = zip.folder("drumbuilder");
		if (!drumbuilderFolder) return;

		const presetFolder = drumbuilderFolder.folder(`${presetName}.preset`);
		if (!presetFolder) return;

		// Get all mapped samples
		const mappedKeys = keys.filter((key) => key.sample);

		// Add each sample file to the zip
		for (const key of mappedKeys) {
			if (!key.sample) continue;

			try {
				const file = await storage.getFile(
					key.sample.filePath,
					key.sample.directoryId,
				);

				// Add file to zip
				presetFolder.file(key.sample.name, file);
			} catch (error) {
				console.error("Error adding file to zip:", error);
				setError("Failed to add file to zip");
				return;
			}
		}

		// Create patch.json
		const regions = mappedKeys.map((key) => {
			const midiNote = getMidiNoteNumber(key.note);
			return {
				"fade.in": 0,
				"fade.out": 0,
				framecount: Math.floor(
					(key.sample?.duration || 0) * (key.sample?.sampleRate || 44100),
				),
				hikey: midiNote,
				lokey: midiNote,
				pan: 0,
				"pitch.keycenter": 60,
				playmode: "oneshot",
				reverse: false,
				sample: key.sample?.name,
				"sample.end": Math.floor(
					(key.sample?.duration || 0) * (key.sample?.sampleRate || 44100),
				),
				transpose: 0,
				tune: 0,
			};
		});

		const presetData = {
			...DEFAULT_PATCH,
			regions,
		};

		presetFolder.file("patch.json", JSON.stringify(presetData, null, 2));

		try {
			// Generate zip file
			const content = await zip.generateAsync({ type: "blob" });

			// Create download link
			const url = URL.createObjectURL(content);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${presetName}.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			setIsDownloadOpen(false);
			setPresetName("");
		} catch (error) {
			console.error("Error generating zip:", error);
			setError("Failed to generate zip file");
		}
	}, [keys, presetName, currentRack]);

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

			if (currentRack) {
				// Update existing rack
				await storage.updateDrumRack(currentRack.id, configuration);
			} else {
				// Create new rack
				await storage.addDrumRack(rackName.trim(), configuration);
			}

			// Refresh drum racks list
			const updatedRacks = await storage.getDrumRacks();
			setDrumRacks(updatedRacks);

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
				if (key.sample?.filePath && key.sample?.directoryId) {
					try {
						// Get the file from the file system
						const file = await storage.getFile(
							key.sample.filePath,
							key.sample.directoryId,
						);

						const note = key.note;

						const arrayBuffer = await file.arrayBuffer();

						// Decode the audio data first
						const audioContext = new AudioContext();
						const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

						// Create Tone.js buffer from the decoded audio data
						const buffer = new Tone.ToneAudioBuffer();
						buffer.fromArray(audioBuffer.getChannelData(0));

						// Create new player with the buffer
						buffersRef.current[note] = buffer;
						const player = new Tone.Player(buffer).toDestination();
						playersRef.current[note] = player;
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
		// Create a fixed mapping for our 24 keys starting from F2 (53)
		const noteMap: Record<string, number> = {
			F2: 53,
			"F#2": 54,
			G2: 55,
			"G#2": 56,
			A3: 57,
			"A#3": 58,
			B3: 59,
			C3: 60,
			"C#3": 61,
			D3: 62,
			"D#3": 63,
			E3: 64,
			F3: 65,
			"F#3": 66,
			G3: 67,
			"G#3": 68,
			A4: 69,
			"A#4": 70,
			B4: 71,
			C4: 72,
			"C#4": 73,
			D4: 74,
			"D#4": 75,
			E4: 76,
		};

		return noteMap[note] || 60; // Default to middle C if note not found
	}

	// Helper function to convert AudioBuffer to WAV format
	function audioBufferToWav(buffer: AudioBuffer): Blob {
		const numOfChan = buffer.numberOfChannels;
		const length = buffer.length * numOfChan * 2;
		const buffer2 = new ArrayBuffer(44 + length);
		const view = new DataView(buffer2);
		const channels = [];
		let sample = 0;
		let offset = 0;
		let pos = 0;

		// write WAVE header
		setUint32(0x46464952); // "RIFF"
		setUint32(36 + length); // file length - 8
		setUint32(0x45564157); // "WAVE"
		setUint32(0x20746d66); // "fmt " chunk
		setUint32(16); // length = 16
		setUint16(1); // PCM (uncompressed)
		setUint16(numOfChan);
		setUint32(buffer.sampleRate);
		setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
		setUint16(numOfChan * 2); // block-align
		setUint16(16); // 16-bit
		setUint32(0x61746164); // "data" - chunk
		setUint32(length);

		// write interleaved data
		for (let i = 0; i < buffer.numberOfChannels; i++) {
			channels.push(buffer.getChannelData(i));
		}

		while (pos < buffer.length) {
			for (let i = 0; i < numOfChan; i++) {
				sample = Math.max(-1, Math.min(1, channels[i][pos]));
				sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
				view.setInt16(44 + offset, sample, true);
				offset += 2;
			}
			pos++;
		}

		// helper functions
		function setUint16(data: number) {
			view.setUint16(pos, data, true);
			pos += 2;
		}
		function setUint32(data: number) {
			view.setUint32(pos, data, true);
			pos += 4;
		}

		return new Blob([buffer2], { type: "audio/wav" });
	}

	const handleFolderDrop = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();
			setError(null);

			try {
				// First try to parse as a folder from our browser
				const data = JSON.parse(e.dataTransfer.getData("application/json"));
				if (data.type === "folder") {
					// Process samples from our browser
					const samples = data.samples.map((sample: Sample) => ({
						file: sample,
						category: categorizeSample(sample.name),
					}));

					if (samples.length === 0) {
						setError("No samples found in folder");
						return;
					}

					// Sort samples by category
					const categorizedSamples = {
						kick: samples.filter(
							(s: { file: Sample; category: string }) => s.category === "kick",
						),
						snare: samples.filter(
							(s: { file: Sample; category: string }) => s.category === "snare",
						),
						rim_clap: samples.filter(
							(s: { file: Sample; category: string }) =>
								s.category === "rim_clap",
						),
						closed_hihat: samples.filter(
							(s: { file: Sample; category: string }) =>
								s.category === "closed_hihat",
						),
						open_hihat: samples.filter(
							(s: { file: Sample; category: string }) =>
								s.category === "open_hihat",
						),
						perc: samples.filter(
							(s: { file: Sample; category: string }) => s.category === "perc",
						),
						tom: samples.filter(
							(s: { file: Sample; category: string }) => s.category === "tom",
						),
						cymbal: samples.filter(
							(s: { file: Sample; category: string }) =>
								s.category === "cymbal",
						),
						other: samples.filter(
							(s: { file: Sample; category: string }) => s.category === "other",
						),
					};

					// Map samples to keys
					const newKeys = [...keys];
					const usedSamples = new Set<string>();

					const assignSample = async (
						keyIndex: number,
						categories: string[],
						fallbackCategory = "other",
					) => {
						const availableSamples = categories
							.flatMap(
								(cat) =>
									categorizedSamples[cat as keyof typeof categorizedSamples],
							)
							.filter((s) => !usedSamples.has(s.file.name));

						if (availableSamples.length > 0) {
							const sample =
								availableSamples[
									Math.floor(Math.random() * availableSamples.length)
								];
							usedSamples.add(sample.file.name);

							try {
								// Get the file from the file system
								const file = await storage.getFile(
									sample.file.filePath,
									sample.file.directoryId,
								);

								const note = newKeys[keyIndex].note;

								const arrayBuffer = await file.arrayBuffer();

								// Decode the audio data first
								const audioContext = new AudioContext();
								const audioBuffer =
									await audioContext.decodeAudioData(arrayBuffer);

								// Create Tone.js buffer from the decoded audio data
								const buffer = new Tone.ToneAudioBuffer();
								buffer.fromArray(audioBuffer.getChannelData(0));

								// Create new player with the buffer
								const player = new Tone.Player(buffer).toDestination();

								buffersRef.current[note] = buffer;
								playersRef.current[note] = player;

								// Update key state
								newKeys[keyIndex] = {
									...newKeys[keyIndex],
									sample: sample.file,
								};
							} catch (error) {
								console.error(
									`Failed to load sample ${sample.file.name}:`,
									error,
								);
							}
						} else if (fallbackCategory && categories[0] !== fallbackCategory) {
							await assignSample(keyIndex, [fallbackCategory]);
						}
					};

					// Assign samples based on the mapping
					await Promise.all([
						// Kicks
						assignSample(0, ["kick"]), // F2
						assignSample(1, ["kick"]), // F#2
						// Snares
						assignSample(2, ["snare"]), // G2
						assignSample(3, ["snare"]), // G#2
						// Rims/Claps
						assignSample(4, ["rim_clap"]), // A2
						assignSample(5, ["rim_clap"]), // A#2
						// Closed hihats/shakers
						assignSample(6, ["closed_hihat"]), // B2
						assignSample(7, ["closed_hihat"]), // C3
						assignSample(8, ["closed_hihat"]), // C#3
						assignSample(9, ["closed_hihat"]), // D3
						// Open hihat
						assignSample(10, ["open_hihat"]), // D#3
						// Perc
						assignSample(11, ["perc"]), // E3
						// Toms
						...[12, 13, 14, 15, 16, 17].map((i) => assignSample(i, ["tom"])), // F3 to B3
						// Cymbals
						...[13, 14, 15, 16, 17].map((i) => assignSample(i, ["cymbal"])), // F#3 to A#3
						// Random percs for the rest
						...Array.from({ length: 6 }, (_, i) =>
							assignSample(18 + i, ["perc", "other"]),
						),
					]);

					setKeys(newKeys);
					return;
				}
			} catch (error) {
				console.error("Error processing browser folder:", error);
			}

			// If we get here, try to process as a native file system folder
			// ... rest of the existing native folder drop code ...
		},
		[keys, categorizeSample],
	);

	const handleRandomRack = useCallback(async () => {
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

			// Fetch all samples from all directories
			const directories = await storage.getDirectories();
			const allSamples: Sample[] = [];
			for (const dir of directories) {
				const dirSamples = await storage.getSamples(dir.id);
				// Only include samples under 3 seconds
				allSamples.push(
					...dirSamples
						.filter((s) => s.duration && s.duration < 3)
						.map((s) => ({
							...s,
							duration: s.duration || 0,
							channels: s.channels || 0,
							sampleRate: s.sampleRate || 0,
							rmsLevel: s.rmsLevel || 0,
						})),
				);
			}

			if (allSamples.length === 0) {
				setError("No samples found");
				return;
			}

			// Categorize samples
			const samples = allSamples.map((sample) => ({
				file: sample,
				category: categorizeSample(sample.name),
			}));

			// Sort samples by category
			const categorizedSamples = {
				kick: samples.filter((s) => s.category === "kick"),
				snare: samples.filter((s) => s.category === "snare"),
				rim_clap: samples.filter((s) => s.category === "rim_clap"),
				closed_hihat: samples.filter((s) => s.category === "closed_hihat"),
				open_hihat: samples.filter((s) => s.category === "open_hihat"),
				perc: samples.filter((s) => s.category === "perc"),
				tom: samples.filter((s) => s.category === "tom"),
				cymbal: samples.filter((s) => s.category === "cymbal"),
				other: samples.filter((s) => s.category === "other"),
			};

			// Map samples to keys
			const newKeys = [...keys];
			const usedSamples = new Set<string>();

			const assignSample = async (
				keyIndex: number,
				categories: string[],
				fallbackCategory = "other",
			) => {
				const availableSamples = categories
					.flatMap(
						(cat) => categorizedSamples[cat as keyof typeof categorizedSamples],
					)
					.filter((s) => !usedSamples.has(s.file.name));

				if (availableSamples.length > 0) {
					const sample =
						availableSamples[
							Math.floor(Math.random() * availableSamples.length)
						];
					usedSamples.add(sample.file.name);

					try {
						// Get the file from the file system
						const file = await storage.getFile(
							sample.file.filePath,
							sample.file.directoryId,
						);

						const note = newKeys[keyIndex].note;

						const arrayBuffer = await file.arrayBuffer();

						// Decode the audio data first
						const audioContext = new AudioContext();
						const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

						// Create Tone.js buffer from the decoded audio data
						const buffer = new Tone.ToneAudioBuffer();
						buffer.fromArray(audioBuffer.getChannelData(0));

						// Create new player with the buffer
						const player = new Tone.Player(buffer).toDestination();

						buffersRef.current[note] = buffer;
						playersRef.current[note] = player;

						// Update key state
						newKeys[keyIndex] = {
							...newKeys[keyIndex],
							sample: sample.file,
						};
					} catch (error) {
						console.error(`Failed to load sample ${sample.file.name}:`, error);
					}
				} else if (fallbackCategory && categories[0] !== fallbackCategory) {
					await assignSample(keyIndex, [fallbackCategory]);
				}
			};

			// Assign samples based on the mapping
			await Promise.all([
				// Kicks
				assignSample(0, ["kick"]), // F2
				assignSample(1, ["kick"]), // F#2
				// Snares
				assignSample(2, ["snare"]), // G2
				assignSample(3, ["snare"]), // G#2
				// Rims/Claps
				assignSample(4, ["rim_clap"]), // A2
				assignSample(5, ["rim_clap"]), // A#2
				// Closed hihats/shakers
				assignSample(6, ["closed_hihat"]), // B2
				assignSample(7, ["closed_hihat"]), // C3
				assignSample(8, ["closed_hihat"]), // C#3
				assignSample(9, ["closed_hihat"]), // D3
				// Open hihat
				assignSample(10, ["open_hihat"]), // D#3
				// Perc
				assignSample(11, ["perc"]), // E3
				// Toms
				...[12, 13, 14, 15, 16, 17].map((i) => assignSample(i, ["tom"])), // F3 to B3
				// Cymbals
				...[13, 14, 15, 16, 17].map((i) => assignSample(i, ["cymbal"])), // F#3 to A#3
				// Random percs for the rest
				...Array.from({ length: 6 }, (_, i) =>
					assignSample(18 + i, ["perc", "other"]),
				),
			]);

			setKeys(newKeys);
			setCurrentRack(null);
			setRackName("");
		} catch (error) {
			console.error("Error creating random rack:", error);
			setError("Failed to create random rack");
		}
	}, [keys, categorizeSample]);

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
						onClick={handleRandomRack}
					>
						<span>Random Rack</span>
					</Button>

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
										<div
											key={rack.id}
											className="flex items-center justify-between p-2 hover:bg-accent rounded-md"
										>
											<button
												type="button"
												className="flex-1 text-left"
												onClick={() => {
													setCurrentRack(rack);
													setRackName(rack.name);
													setKeys(
														INITIAL_KEYS.map((key) => {
															const mappedKey = rack.configuration.keys.find(
																(k) => k.note === key.note,
															);
															return mappedKey || key;
														}),
													);
													setIsLoadOpen(false);
												}}
											>
												{rack.name}
											</button>
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0 text-destructive hover:text-destructive"
												onClick={async () => {
													try {
														await storage.removeDrumRack(rack.id);

														// Refresh drum racks list
														const updatedRacks = await storage.getDrumRacks();
														setDrumRacks(updatedRacks);

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
													role="img"
													aria-label="Delete drum rack"
												>
													<title>Delete drum rack</title>
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

					<Popover open={isDownloadOpen} onOpenChange={setIsDownloadOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="default"
								size="sm"
								className="gap-2"
								onClick={handleDownloadClick}
								disabled={!keys.some((key) => key.sample)}
							>
								<Download className="h-4 w-4" />
								<span>Download</span>
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-80">
							<div className="space-y-4">
								<div>
									<h4 className="font-medium mb-2">Name your preset</h4>
									<p className="text-sm text-muted-foreground mb-4">
										Enter a name for your preset. This will be used as the
										folder name and saved to your presets.
									</p>
								</div>
								<div className="space-y-2">
									<Input
										ref={inputRef}
										placeholder="Enter preset name..."
										value={presetName}
										onChange={(e) => setPresetName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && presetName.trim()) {
												handleDownload();
											}
										}}
									/>
									<div className="flex justify-end">
										<Button
											onClick={handleDownload}
											disabled={!presetName.trim()}
										>
											Download
										</Button>
									</div>
								</div>
							</div>
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
								<HelpCircle className="h-4 w-4" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-80">
							<div className="space-y-2">
								<h4 className="font-medium">How to install</h4>
								<ol className="space-y-2 text-sm text-muted-foreground">
									<li className="flex gap-2">
										<span className="font-mono text-foreground">1.</span>
										<span>Download and unzip the file</span>
									</li>
									<li className="flex gap-2">
										<span className="font-mono text-foreground">2.</span>
										<span>
											Connect your{" "}
											<span className="uppercase-preserve">OP-XY</span> via
											USB-C
										</span>
									</li>
									<li className="flex gap-2">
										<span className="font-mono text-foreground">3.</span>
										<span>
											Open{" "}
											<a
												href="https://teenage.engineering/guides/fieldkit"
												target="_blank"
												rel="noopener noreferrer"
												className="text-foreground hover:underline"
											>
												field kit
											</a>
										</span>
									</li>
									<li className="flex gap-2">
										<span className="font-mono text-foreground">4.</span>
										<span>
											Drag the unzipped folder to the presets folder in{" "}
											<span className="uppercase-preserve">OP-XY</span>
										</span>
									</li>
								</ol>
							</div>
						</PopoverContent>
					</Popover>
				</div>
			</div>
			{error && (
				<div className="rounded-md bg-destructive/10 p-3">
					<p className="text-sm text-destructive">{error}</p>
				</div>
			)}
			<div
				className={`h-48 w-full overflow-x-auto rounded-lg bg-card relative transition-all duration-150 ${
					dragItem?.type === "folder"
						? "ring-2 ring-primary ring-offset-2 bg-primary/5"
						: ""
				}`}
				onDragOver={(e) => {
					e.preventDefault();
					e.dataTransfer.dropEffect = "copy";
				}}
				onDragLeave={handleDragLeave}
				onDrop={dragItem?.type === "folder" ? handleFolderDrop : undefined}
			>
				<div className="relative h-full">
					{dragItem?.type === "folder" && (
						<div className="absolute inset-0 bg-primary/10 flex items-center justify-center z-10 backdrop-blur-[1px]">
							<div className="text-center space-y-2">
								<FolderOpen className="h-8 w-8 mx-auto text-primary" />
								<span className="text-sm font-medium">
									Drop folder to create drum rack
								</span>
							</div>
						</div>
					)}
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
										${hoverKey === key.note ? "bg-primary/20 ring-2 ring-primary ring-offset-2" : ""}
										hover:bg-primary/20 cursor-pointer
									`}
										onDragOver={(e) => handleDragOver(e, key.note)}
										onDragLeave={handleDragLeave}
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
												${hoverKey === key.note ? "bg-primary/20 ring-2 ring-primary ring-offset-2" : ""}
												hover:bg-primary/20 cursor-pointer
											`}
											onDragOver={(e) => handleDragOver(e, key.note)}
											onDragLeave={handleDragLeave}
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

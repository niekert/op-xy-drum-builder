"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import * as Tone from "tone";
import type { Sample } from "./sample-list";
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
import { supabase, getDeviceId } from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

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
	data: any;
} | null;

type PianoKeysProps = {
	dragItem: DragItem;
};

export function PianoKeys({ dragItem }: PianoKeysProps) {
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
	const [presetName, setPresetName] = useState("");
	const [isDownloadOpen, setIsDownloadOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const [editParams, setEditParams] = useState<
		Record<
			string,
			{
				startTime: number;
				endTime: number;
				gain: number;
				fadeIn: number;
				fadeOut: number;
				isNormalized: boolean;
				isReversed: boolean;
			}
		>
	>({});

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

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
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

				const { error } = await supabase.from("drum_racks").insert({
					name: presetName.trim(),
					configuration,
					device_id: getDeviceId(),
				});

				if (error) throw error;

				// Refresh drum racks list
				const { data: updatedRacks } = await supabase
					.from("drum_racks")
					.select("*")
					.order("created_at", { ascending: false });

				setDrumRacks(updatedRacks || []);

				// Find the newly created rack and set it as current
				const newRack = updatedRacks?.find((rack) => rack.name === presetName);
				if (newRack) {
					setCurrentRack(newRack);
					setRackName(newRack.name);
				}
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

		// Create regions array for patch.json
		const regions = await Promise.all(
			mappedKeys.map(async (key) => {
				if (!key.sample) return null;

				// Convert note to MIDI note number
				const midiNote = getMidiNoteNumber(key.note);
				const params = editParams[key.sample.id];

				// Fetch and process the sample if it has edit parameters
				if (params) {
					try {
						const response = await fetch(key.sample.url);
						const originalArrayBuffer = await response.arrayBuffer();

						// Clone the array buffer for audio decoding
						const audioArrayBuffer = originalArrayBuffer.slice(0);
						const audioContext = new AudioContext();
						const audioBuffer =
							await audioContext.decodeAudioData(audioArrayBuffer);
						const framecount = audioBuffer.length;

						// Create a new buffer for the edited audio
						const sampleRate = audioBuffer.sampleRate;
						const startSample = Math.floor(params.startTime * sampleRate);
						const endSample = Math.floor(params.endTime * sampleRate);
						const length = endSample - startSample;

						const newBuffer = audioContext.createBuffer(
							audioBuffer.numberOfChannels,
							length,
							sampleRate,
						);

						// Process each channel
						for (
							let channel = 0;
							channel < audioBuffer.numberOfChannels;
							channel++
						) {
							const inputData = audioBuffer.getChannelData(channel);
							const outputData = newBuffer.getChannelData(channel);

							// Copy the trimmed section
							for (let i = 0; i < length; i++) {
								outputData[i] = inputData[startSample + i];
							}

							// Apply gain
							const gain = params.isNormalized
								? params.gain / Math.max(...outputData.map(Math.abs))
								: params.gain;
							for (let i = 0; i < length; i++) {
								outputData[i] *= gain;
							}

							// Apply fade in
							const fadeInSamples = Math.floor(params.fadeIn * sampleRate);
							for (let i = 0; i < fadeInSamples; i++) {
								const factor = i / fadeInSamples;
								outputData[i] *= factor;
							}

							// Apply fade out
							const fadeOutSamples = Math.floor(params.fadeOut * sampleRate);
							for (let i = 0; i < fadeOutSamples; i++) {
								const factor = 1 - i / fadeOutSamples;
								outputData[length - 1 - i] *= factor;
							}

							// Reverse if needed
							if (params.isReversed) {
								outputData.reverse();
							}
						}

						// Convert the buffer to WAV
						const wavData = audioBufferToWav(newBuffer);
						presetFolder.file(key.sample.name, wavData);

						return {
							"fade.in": 0,
							"fade.out": 0,
							framecount: length,
							hikey: midiNote,
							lokey: midiNote,
							pan: 0,
							"pitch.keycenter": 60,
							playmode: "oneshot",
							reverse: false,
							sample: key.sample.name,
							"sample.end": length,
							transpose: 0,
							tune: 0,
						};
					} catch (error) {
						console.error(`Failed to process ${key.sample.name}:`, error);
						return null;
					}
				}

				// If no edit parameters or processing failed, use the original file
				try {
					const response = await fetch(key.sample.url);
					const originalArrayBuffer = await response.arrayBuffer();

					// Clone the array buffer for audio decoding
					const audioArrayBuffer = originalArrayBuffer.slice(0);
					const audioContext = new AudioContext();
					const audioBuffer =
						await audioContext.decodeAudioData(audioArrayBuffer);
					const framecount = audioBuffer.length;

					// Use the original array buffer for the WAV file
					presetFolder.file(
						key.sample.name,
						new Uint8Array(originalArrayBuffer),
					);

					return {
						"fade.in": 0,
						"fade.out": 0,
						framecount: framecount,
						hikey: midiNote,
						lokey: midiNote,
						pan: 0,
						"pitch.keycenter": 60,
						playmode: "oneshot",
						reverse: false,
						sample: key.sample.name,
						"sample.end": framecount,
						transpose: 0,
						tune: 0,
					};
				} catch (error) {
					console.error(`Failed to download ${key.sample.name}:`, error);
					return null;
				}
			}),
		);

		// Create patch.json
		const patch = {
			...DEFAULT_PATCH,
			regions: regions.filter(Boolean),
		};

		// Add patch.json to zip
		presetFolder.file("patch.json", JSON.stringify(patch, null, 2));

		try {
			// Generate the zip file
			const content = await zip.generateAsync({ type: "blob" });

			// Create download link and trigger download
			const url = URL.createObjectURL(content);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${presetName}.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			// Close popover and reset name if this was a new preset
			setIsDownloadOpen(false);
		} catch (error) {
			console.error("Failed to create zip file:", error);
			setError("Failed to create download");
		}
	}, [keys, presetName, currentRack, editParams]);

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

		// Adjust octave to match OP-XY mapping
		return noteMap[noteName] + (octave + 2) * 12;
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
								// Load into Tone.js
								const buffer = await Tone.Buffer.fromUrl(sample.file.url);
								const note = newKeys[keyIndex].note;

								buffersRef.current[note] = buffer;
								const player = new Tone.Player(buffer).toDestination();
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
				onDragOver={handleDragOver}
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

import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
	throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
	throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Get or create a device ID for namespacing
export function getDeviceId() {
	if (typeof window === "undefined") {
		return "unknown";
	}

	const key = "opxy-device-id";
	let deviceId = localStorage.getItem(key);
	if (!deviceId) {
		deviceId = nanoid();
		localStorage.setItem(key, deviceId);
	}
	return deviceId;
}

export const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

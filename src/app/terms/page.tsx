"use client";

export default function TermsPage() {
	return (
		<div className="min-h-screen bg-background">
			<header className="border-b">
				<div className="mx-auto max-w-3xl px-6 py-4">
					<h1 className="text-2xl font-mono">Terms of Service</h1>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-6 py-8 space-y-8">
				<section className="space-y-4">
					<h2 className="text-xl font-mono">1. Local Storage</h2>
					<div className="space-y-2 text-muted-foreground">
						<p>OP-XY Drum Builder is a local-first application. This means:</p>
						<ul className="list-disc pl-6 space-y-2">
							<li>All files and data remain on your local file system</li>
							<li>No files are uploaded to any server or cloud storage</li>
							<li>You are responsible for backing up your files and presets</li>
						</ul>
					</div>
				</section>

				<section className="space-y-4">
					<h2 className="text-xl font-mono">2. Content & Copyright</h2>
					<div className="space-y-2 text-muted-foreground">
						<p>
							Users of OP-XY Drum Builder are solely responsible for the audio
							samples they use within the service. By using this service, you
							agree to:
						</p>
						<ul className="list-disc pl-6 space-y-2">
							<li>
								Only use audio samples that you own or have explicit permission
								to use
							</li>
							<li>
								Not use copyrighted material without proper licensing or
								permission
							</li>
							<li>
								Accept full responsibility for any copyright infringement or
								legal issues arising from your used content
							</li>
						</ul>
					</div>
				</section>

				<section className="space-y-4">
					<h2 className="text-xl font-mono">3. Hardware Disclaimer</h2>
					<div className="space-y-2 text-muted-foreground">
						<p>
							OP-XY Drum Builder is not affiliated with Teenage Engineering. You
							acknowledge that:
						</p>
						<ul className="list-disc pl-6 space-y-2">
							<li>
								We take no responsibility for any issues that may arise from
								using our presets on your OP-XY
							</li>
							<li>
								You are responsible for ensuring your presets are compatible
								with your device
							</li>
							<li>
								We recommend backing up your OP-XY before transferring any
								presets
							</li>
						</ul>
					</div>
				</section>

				<section className="space-y-4">
					<h2 className="text-xl font-mono">4. Disclaimer</h2>
					<div className="space-y-2 text-muted-foreground">
						<p>OP-XY Drum Builder is not responsible for:</p>
						<ul className="list-disc pl-6 space-y-2">
							<li>Loss of data or files on your local system</li>
							<li>Copyright infringement by users</li>
							<li>The content of used samples</li>
							<li>
								Any issues arising from the use of presets on your OP-XY or
								other devices
							</li>
						</ul>
						<p>
							We reserve the right to modify this service at any time without
							notice.
						</p>
					</div>
				</section>
			</main>
		</div>
	);
}

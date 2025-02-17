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
					<h2 className="text-xl font-mono">1. Content & Copyright</h2>
					<div className="space-y-2 text-muted-foreground">
						<p>
							Users of OP-XY Drum Builder are solely responsible for the audio
							samples they upload and use within the service. By using this
							service, you agree to:
						</p>
						<ul className="list-disc pl-6 space-y-2">
							<li>
								Only upload audio samples that you own or have explicit
								permission to use
							</li>
							<li>
								Not upload copyrighted material without proper licensing or
								permission
							</li>
							<li>
								Accept full responsibility for any copyright infringement or
								legal issues arising from your uploaded content
							</li>
						</ul>
					</div>
				</section>

				<section className="space-y-4">
					<h2 className="text-xl font-mono">2. Personal Use</h2>
					<div className="space-y-2 text-muted-foreground">
						<p>This service is intended for personal use only. You agree to:</p>
						<ul className="list-disc pl-6 space-y-2">
							<li>Use the service for creating personal drum racks</li>
							<li>Not distribute copyrighted samples through the service</li>
							<li>
								Not use the service for commercial purposes without proper
								licensing of all samples
							</li>
						</ul>
					</div>
				</section>

				<section className="space-y-4">
					<h2 className="text-xl font-mono">3. Disclaimer</h2>
					<div className="space-y-2 text-muted-foreground">
						<p>OP-XY Drum Builder is not responsible for:</p>
						<ul className="list-disc pl-6 space-y-2">
							<li>Copyright infringement by users</li>
							<li>The content of uploaded samples</li>
							<li>
								Any legal issues arising from the use of samples in your
								projects
							</li>
						</ul>
						<p>
							We reserve the right to remove any content that violates copyright
							laws or these terms of service.
						</p>
					</div>
				</section>
			</main>
		</div>
	);
}

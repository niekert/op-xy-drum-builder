import { Dropzone } from "@/components/dropzone";
import { SampleList } from "@/components/sample-list";
import { PianoKeys } from "@/components/piano-keys";
import { ThemeToggle } from "@/components/theme-toggle";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

export default function Home() {
	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-b">
				<div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="font-mono text-sm">
							<span className="uppercase-preserve">OP-XY</span> drum racks
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Popover>
							<PopoverTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<HelpCircle className="h-4 w-4" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-[340px]" align="end">
								<div className="space-y-4">
									<h3 className="font-mono text-sm">instructions</h3>
									<ol className="space-y-3 text-sm text-muted-foreground">
										<li className="flex gap-2">
											<span className="font-mono text-foreground">01.</span>
											<span>upload your samples using the upload area</span>
										</li>
										<li className="flex gap-2">
											<span className="font-mono text-foreground">02.</span>
											<span>drag samples onto keys in the piano roll</span>
										</li>
										<li className="flex gap-2">
											<span className="font-mono text-foreground">03.</span>
											<span>optionally save your configuration</span>
										</li>
										<li className="flex gap-2">
											<span className="font-mono text-foreground">04.</span>
											<span>press download to get your zip file</span>
										</li>
										<li className="flex gap-2">
											<span className="font-mono text-foreground">05.</span>
											<span>unpack the downloaded zip file</span>
										</li>
										<li className="flex gap-2">
											<span className="font-mono text-foreground">06.</span>
											<span>
												download{" "}
												<a
													href="https://teenage.engineering/guides/fieldkit"
													target="_blank"
													rel="noopener noreferrer"
													className="text-foreground hover:underline"
												>
													field kit
												</a>{" "}
												and connect your{" "}
												<span className="uppercase-preserve">OP-XY</span> via
												usb-c
											</span>
										</li>
										<li className="flex gap-2">
											<span className="font-mono text-foreground">07.</span>
											<span>
												drag the folder onto the presets folder in{" "}
												<span className="uppercase-preserve">OP-XY</span>
											</span>
										</li>
									</ol>
								</div>
							</PopoverContent>
						</Popover>
						<ThemeToggle />
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
				{/* Hero Section */}
				<section className="text-center space-y-4 py-8">
					<h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/50">
						build drum racks for{" "}
						<span className="uppercase-preserve">OP-XY</span>
					</h1>
					<p className="text-muted-foreground max-w-2xl mx-auto">
						drag and drop samples, organize them into drum racks. <br />
						export your drum rack and copy over to
						<span className="uppercase-preserve"> OP-XY</span>.
					</p>
				</section>

				{/* Main Content */}
				<div className="grid gap-8">
					{/* Dropzone with subtle label */}
					<div className="relative">
						<span className="absolute -top-3 left-4 px-2 text-xs text-muted-foreground bg-background">
							upload
						</span>
						<Dropzone />
					</div>

					{/* Sample Browser with subtle label */}
					<div className="relative">
						<span className="absolute -top-3 left-4 px-2 text-xs text-muted-foreground bg-background">
							browser
						</span>
						<div className="h-[400px] border rounded-lg bg-card">
							<SampleList />
						</div>
					</div>

					{/* Piano Roll with subtle label */}
					<div className="relative">
						<span className="absolute -top-3 left-4 px-2 text-xs text-muted-foreground bg-background">
							mapping
						</span>
						<div className="border rounded-lg p-4">
							<PianoKeys />
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}

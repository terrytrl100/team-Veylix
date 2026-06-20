import { GetStartedButton } from "@/components/get-started-button";

/**
 * Landing page — intentionally an empty canvas.
 *
 * Per the current brief the landing holds nothing but a single "Get Started"
 * button in the top-right that opens the wallet-connect flow. No wordmark,
 * pill, hero copy, legend, or footer (those were removed deliberately).
 */
export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <div className="flex w-full justify-end p-4">
        <GetStartedButton />
      </div>
    </main>
  );
}

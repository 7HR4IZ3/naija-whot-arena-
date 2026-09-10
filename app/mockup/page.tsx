import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Whot Arena · Design mockup",
  description: "Responsive design directions for the Nigerian Whot Arena experience.",
};

export default function MockupPage() {
  return (
    <main className="mockup-route">
      <iframe
        className="mockup-iframe"
        src="/mockup.html"
        title="Whot Arena design mockup"
      />
    </main>
  );
}

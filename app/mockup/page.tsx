import type { Metadata } from "next";
import { ResponsivePreview } from "@/components/responsive-preview";

export const metadata: Metadata = {
  title: "Whot Arena · Design mockup",
  description: "Responsive design directions for the Nigerian Whot Arena experience.",
};

export default function MockupPage() {
  return (
    <ResponsivePreview />
  );
}

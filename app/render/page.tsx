import { Suspense } from "react";
import type { Metadata } from "next";
import { VizRoom } from "@/app/components/VizRoom";

export const metadata: Metadata = {
  title: "IFC AI render prompt",
  description:
    "IFC viewer with an editable AI render prompt for photorealistic architectural scenes."
};

export default function RendersPage() {
  return (
    <Suspense fallback={null}>
      <VizRoom />
    </Suspense>
  );
}


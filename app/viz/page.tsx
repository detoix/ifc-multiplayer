import { Suspense } from "react";
import { VizRoom } from "@/app/components/VizRoom";

export default function VizPage() {
  return (
      <Suspense fallback={null}>
        <VizRoom />
      </Suspense>
  );
}

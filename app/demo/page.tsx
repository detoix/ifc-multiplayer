import { Suspense } from "react";
import { DemoRoom } from "@/app/components/DemoRoom";

export default function DemoPage() {
  return (
    <main className="main">
      <Suspense fallback={null}>
        <DemoRoom />
      </Suspense>
    </main>
  );
}

"use client";

import { Suspense } from "react";
import { Room } from "@/app/components/Room";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Room />
    </Suspense>
  );
}

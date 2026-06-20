"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GetStartedButton() {
  const router = useRouter();

  return (
    <Button
      onClick={() => router.push("/app")}
      className="bg-accent text-[#0a0e14] hover:bg-accent/90 px-5 py-2.5 text-sm font-semibold sm:px-6 sm:py-3 sm:text-base"
    >
      Get Started
    </Button>
  );
}

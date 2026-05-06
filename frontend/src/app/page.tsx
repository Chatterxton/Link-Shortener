"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authStore } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    if (authStore.token()) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);
  return null;
}

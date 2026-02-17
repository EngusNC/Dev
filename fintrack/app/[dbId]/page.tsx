"use client";
import FinFlow from "@/components/FinFlow";

export default function AppPage({ params }: { params: { dbId: string } }) {
  return <FinFlow dbId={params.dbId} />;
}

"use client";
import { Suspense, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Review } from "../Review";

export default function BuddyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense><Inner id={id} /></Suspense>;
}

// ?s= approval status (0 waiting, 1 approved, 2 rejected) and ?a= active flag come from the list/search that linked here.
function Inner({ id }: { id: string }) {
  const q = useSearchParams();
  const status = Number(q.get("s") ?? 1) as 0 | 1 | 2, active = Number(q.get("a") ?? 1);
  return (
    <>
      <div className="hint"><Link href={`/buddies?tab=${status}`}>Admin / Buddies</Link></div>
      <section className="box"><Review id={id} known={{ status, active }} /></section>
    </>
  );
}

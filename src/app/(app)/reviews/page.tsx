"use client";
import { Star } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { date } from "@/lib/format";
import { PageHead, Empty, LoadError } from "@/components/ui";

type Review = { _id: string; rating: number; feedBack?: string; createdAt?: string; name?: string };

// There's no admin reviews API yet, so this reads the reviews the public home feed shows. Hiding a review needs
// that API. Text is always shown as plain text.
export default function Reviews() {
  const { data, error, reload, loading } = useLoad(() => api<{ reviews?: Review[] }>("user/homepage").then((r) => r.data.reviews ?? []));
  return (
    <>
      <PageHead title="Reviews" sub="Ratings customers leave after a job." />
      <section className="box">
        {error ? <LoadError message={error} retry={reload} /> : loading ? <div className="skeleton" style={{ height: 120, margin: 18 }} /> : data?.length ? (
          <table className="stack">
            <thead><tr><th>Customer</th><th>Rating</th><th>Review</th><th className="hs">Date</th></tr></thead>
            <tbody>{data.map((r) => (
              <tr key={r._id}><td>{r.name ?? "—"}</td>
                <td><span aria-label={`${r.rating} of 5`} style={{ color: "var(--amber)", letterSpacing: 1 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span></td>
                <td>{r.feedBack}</td><td className="hs">{r.createdAt ? date(r.createdAt) : "—"}</td></tr>
            ))}</tbody>
          </table>
        ) : <Empty icon={Star} title="No reviews yet" />}
        <p className="hint" style={{ padding: "10px 18px" }}>These are the reviews shown on the home page. Every review, and hiding one, needs the admin reviews API (A-15).</p>
      </section>
    </>
  );
}

"use client";
import { use, useState } from "react";
import Link from "next/link";
import { Prohibit } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { bookingState, fullName, initials, money, phone, when } from "@/lib/format";
import type { Booking, Person } from "@/lib/types";
import { LoadError, StateChip } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";

type Detail = Person & { address?: { street?: string; city?: string; state?: string }; postalCode?: string; isActive?: number; createdAt?: string };

// ponytail: we find this customer's bookings by loading each status list and filtering here. That is fine at today's
// volume. Once there are thousands of bookings, switch to a customerId filter on list-bookings.
async function load(id: string) {
  const [d, ...lists] = await Promise.all([
    api<Detail | Detail[]>("admin/customer-management/user-details", { query: { customerId: id } }),
    ...[1, 2, 3, 4].map((st) => api<Booking[]>("admin/booking-management/list-bookings", { query: { status: st, limit: 200 } }).then((r) => (r.data || []).map((b) => ({ ...b, status: st })))),
  ]);
  const c = Array.isArray(d.data) ? d.data[0] : d.data;
  return { c, bookings: lists.flat().filter((b) => b.userDetails?._id === id) };
}

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const { data, error, reload } = useLoad(() => load(id), [id]);
  const [block, setBlock] = useState(false);
  if (error) return <LoadError message={error} retry={reload} />;
  const c = data?.c, name = fullName(c);
  const spent = data?.bookings.filter((b) => b.status === 3).reduce((a, b) => a + b.price, 0) ?? 0;

  async function toggle() {
    try { await api("admin/customer-management/update-status", { method: "PATCH", body: { customerId: id } }); toast(c?.isActive === 0 ? `${name} unblocked` : `${name} blocked`); setBlock(false); reload(); }
    catch (e) { toast((e as Error).message); }
  }

  return (
    <>
      <div className="hint"><Link href="/customers">Admin / Customers</Link></div>
      <section className="box" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        {!c ? <div className="skeleton" style={{ height: 160 }} /> : <>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span className="av" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(name)}</span>
            <div><h1 style={{ fontSize: "var(--fs-h3)" }}>{name}</h1><span className="muted">{c.email}</span></div>
            <button className="btn d" style={{ marginLeft: "auto" }} onClick={() => setBlock(true)}><Prohibit size={16} />{c.isActive === 0 ? "Unblock" : "Block"}</button>
          </div>
          <dl className="kv">
            <dt>Phone</dt><dd>{phone(c.phone, c.countryCode)}</dd>
            <dt>Address</dt><dd>{c.address?.city ? [c.address.street, c.address.city, c.address.state, c.postalCode].filter(Boolean).join(", ") : "Not added"}</dd>
            <dt>Status</dt><dd>{c.isActive === 0 ? <span className="chip c-bad">Blocked</span> : <span className="chip c-ok">Active</span>}</dd>
            <dt>Spent</dt><dd>{money(spent)} on {data!.bookings.filter((b) => b.status === 3).length} completed jobs</dd>
          </dl>
          <section><h2 style={{ marginBottom: 10 }}>Bookings · {data!.bookings.length}</h2>
            {data!.bookings.length ? <div className="sum-rows">{data!.bookings.map((b) => (
              <div key={b._id}><Link href={`/bookings?open=${b._id}`}><span className="mono">{b.bookingId}</span> · {b.serviceName} · {when(b.scheduledDate, b.selectedSlot)}</Link><span style={{ display: "flex", gap: 10, alignItems: "center" }}>{money(b.price)}<StateChip state={bookingState(b as Booking & { status: number })} /></span></div>
            ))}</div> : <p className="muted">No bookings yet.</p>}
          </section>
        </>}
      </section>
      {block && c && (
        <Modal title={c.isActive === 0 ? `Unblock ${name}` : `Block ${name}`} onClose={() => setBlock(false)}
          footer={<><button className="btn" onClick={() => setBlock(false)}>Back</button><button className={`btn ${c.isActive === 0 ? "p" : "ds"}`} onClick={toggle}>{c.isActive === 0 ? "Unblock" : "Block"}</button></>}>
          <p>{c.isActive === 0 ? `${name.split(" ")[0]} can sign in and book again.` : `${name.split(" ")[0]} can't sign in or book. Past bookings stay as they are.`}</p>
        </Modal>
      )}
    </>
  );
}

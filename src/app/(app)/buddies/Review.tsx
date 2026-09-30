"use client";
import { useState } from "react";
import { Check, IdentificationCard, FileText, Warning, ArrowSquareOut, Prohibit } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { clock, fullName, initials, money, phone } from "@/lib/format";
import type { Buddy } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ReasonDialog } from "@/components/ReasonDialog";
import s from "./buddies.module.css";

type Detail = { ProviderDetails: Buddy & { availability?: { day: number; isOpen: boolean; from: string; to: string }[]; averageRating?: number; totalRatings?: number; totalEarning?: number }; categories?: { categoryName: string }[] };
type Offer = { _id: string; serviceName: string; price: number; durationType: number };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // backend day 0 = Sunday (moment .day())
const DOCS: [keyof Buddy, string, React.ElementType][] = [["IdProofFront", "Photo ID, front", IdentificationCard], ["IdProofBack", "Photo ID, back", IdentificationCard], ["certificate", "Trade licence", FileText], ["additionalDoc", "Insurance", FileText]];
export const docCount = (b: Buddy) => DOCS.filter(([k]) => !!b[k]).length;

/** One Buddy: documents, services with their own prices, hours; decide (waiting) or block (approved). */
// The detail reply has no verificationStatus / isActive (backend BUG-100), so callers pass what the list knows.
export function Review({ id, known, onDecided }: { id: string; known: { status: 0 | 1 | 2; active: number }; onDecided?: (id: string, status: 1 | 2) => void }) {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(async () => {
    const [d, o] = await Promise.all([
      api<Detail>("admin/service-provider/detail", { query: { serviceProviderId: id } }),
      api<Offer[]>("admin/service-provider/list-services", { query: { serviceProviderId: id } }).catch(() => ({ data: [] as Offer[] })),
    ]);
    return { ...d.data, offers: o.data || [] };
  }, [id]);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState(false);
  const [decidedNow, setDecidedNow] = useState<0 | 1 | 2>();
  const [activeNow, setActiveNow] = useState<number>();

  if (error) return <div className={s.review}><p className="err">{error}</p><button className="btn sm" onClick={reload}>Try again</button></div>;
  if (loading || !data) return <div className={s.review}><div className="skeleton" style={{ height: 48, width: "60%" }} /><div className="skeleton" style={{ height: 160 }} /></div>;
  const b = { ...data.ProviderDetails, isActive: activeNow ?? known.active }, name = fullName(b), status = decidedNow ?? known.status;
  const canApprove = !!b.IdProofFront && !!b.IdProofBack;

  // Reject throws so ReasonDialog shows the error inside itself; approve reports by toast.
  async function send(st: 1 | 2, reason = "") {
    await api("admin/service-provider/update-verification-status", { method: "PATCH", body: { serviceProviderId: id, status: st, reason: reason || undefined } });
    toast(st === 1 ? `${name} approved · they can take bookings now` : `${name} rejected · email sent`);
    setRejecting(false);
    setDecidedNow(st);
    onDecided?.(id, st);
  }
  async function approve() {
    setBusy(true);
    try { await send(1); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }
  async function toggleActive() {
    setBusy(true);
    try {
      await api("admin/service-provider/set-status", { method: "PATCH", body: { serviceProviderId: id } });
      toast(b.isActive === 1 ? `${name} blocked` : `${name} unblocked`);
      setActiveNow(b.isActive === 1 ? 0 : 1);
      setBlock(false);
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className={s.review}>
      <div className={s.hd}>
        <span className={`${s.av} ${s.lg}`}>{initials(name)}</span>
        <div style={{ minWidth: 0 }}><h2 style={{ fontSize: "var(--fs-h3)" }}>{name}</h2><span className="muted">{b.email}{/^pw-test-auth-/.test(b.email ?? "") && <span className="flag"> · automated-test sign-up</span>}</span></div>
        <div className={s.acts}>
          {status === 0 && <>
            <button className="btn d" type="button" id="reject" onClick={() => setRejecting(true)} disabled={busy}>Reject <kbd>R</kbd></button>
            <button className="btn p" type="button" id="approve" onClick={approve} disabled={busy || !canApprove} title={canApprove ? "" : "Photo ID required"}><Check size={16} weight="bold" />Approve <kbd>A</kbd></button>
          </>}
          {status === 1 && <button className="btn d" type="button" onClick={() => setBlock(true)} disabled={busy}><Prohibit size={16} />{b.isActive === 1 ? "Block" : "Unblock"}</button>}
          {status === 2 && <button className="btn" type="button" onClick={approve} disabled={busy || !canApprove}>Approve after all</button>}
        </div>
      </div>
      {status === 0 && !canApprove && <div className="note"><Warning size={16} />Approve unlocks once both sides of a photo ID are uploaded.</div>}
      {b.isActive === 0 && <div className="note"><Prohibit size={16} />Blocked: can't sign in or take new jobs.</div>}

      <dl className={s.kv}>
        <dt>Phone</dt><dd>{phone(b.phone, b.countryCode)}</dd>
        <dt>Service area</dt><dd>{b.address?.city ? `${b.address.city}, ${b.address.state ?? ""} ${b.postalCode ?? ""}` : "Not added yet"}</dd>
        <dt>Rating</dt><dd>{data.ProviderDetails.totalRatings ? `${data.ProviderDetails.averageRating?.toFixed(1)} from ${data.ProviderDetails.totalRatings} reviews` : "No reviews yet"}</dd>
        <dt>Trades</dt><dd>{data.categories?.map((c) => c.categoryName).join(", ") || "None picked"}</dd>
      </dl>

      <section><h3 className={s.h3}>Identity &amp; documents <span className="muted">· {docCount(b)} of 4</span></h3>
        <div className={s.docs}>
          {DOCS.map(([k, label, Icon]) => {
            const url = b[k] as string | null | undefined;
            return (
              <div key={k} className={`${s.doc} ${url ? "" : s.miss}`}>
                <div className={s.th}>{url ? <Icon size={28} /> : <Warning size={24} />}</div>
                <div className={s.dm}><b>{label}</b>{url
                  ? <a className={s.open} href={url} target="_blank" rel="noopener noreferrer">Open <ArrowSquareOut size={12} /></a>
                  : <span className="chip c-bad">Missing</span>}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section><h3 className={s.h3}>Services &amp; their prices</h3>
        {data.offers.length ? <ul className={s.offers}>{data.offers.map((o) => <li key={o._id}><span>{o.serviceName}</span><b>{money(o.price)}{o.durationType === 2 ? "/day" : "/hr"}</b></li>)}</ul> : <p className="muted">No services added yet.</p>}
      </section>

      <section><h3 className={s.h3}>Hours</h3>
        <ul className={s.hours}>{DAYS.map((d, i) => { const a = data.ProviderDetails.availability?.find((x) => x.day === i); return <li key={d}><span>{d}</span>{a?.isOpen ? <span>{clock(a.from)} – {clock(a.to)}</span> : <span className="muted">Closed</span>}</li>; })}</ul>
      </section>

      {rejecting && (
        // The server ignores `reason` today and sends a fixed "not approved, contact support" email + app notice (FEA-45).
        <ReasonDialog title={`Reject ${name}'s application`} onClose={() => setRejecting(false)} onConfirm={(r) => send(2, r)}
          next={<>{name.split(" ")[0]} gets an email and an app notice saying the account wasn&apos;t approved and to contact AnyBuddy support. You can approve them later from Rejected.</>}
          label="Reason for rejecting" placeholder="Example: The ID photo is blurry. Upload a clear photo of the front."
          hint="Write what the Buddy should fix. The server doesn't store or send it yet (FEA-45), so it isn't in their email."
          confirm="Reject application" />
      )}

      {block && (
        <Modal title={b.isActive === 1 ? `Block ${name}` : `Unblock ${name}`} onClose={() => setBlock(false)}
          footer={<><button className="btn" onClick={() => setBlock(false)}>Back</button><button className={`btn ${b.isActive === 1 ? "ds" : "p"}`} onClick={toggleActive} disabled={busy}>{b.isActive === 1 ? "Block" : "Unblock"}</button></>}>
          {b.isActive === 1
            ? <><p>{name.split(" ")[0]} can't sign in or take new jobs.</p><div className="note"><Warning size={16} />Owner rule D-66: their upcoming paid jobs are canceled and refunded. The server doesn't do that yet (BUG-95), so check Bookings for their open jobs.</div></>
            : <p>{name.split(" ")[0]} can sign in and take jobs again.</p>}
        </Modal>
      )}
    </div>
  );
}

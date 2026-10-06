"use client";
import { useState } from "react";
import { Check, IdentificationCard, FileText, Warning, ArrowSquareOut, Prohibit, Certificate, UserFocus } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { clock, date, fullName, initials, money, phone } from "@/lib/format";
import type { Buddy } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ReasonDialog } from "@/components/ReasonDialog";
import s from "./buddies.module.css";

// v2 (AD2/AD3): one licence row per licensed category the Buddy offers; the file comes from ProviderDetails.licences.
type LicenceRow = { categoryId: string; categoryName: string; licenceName: string; status: "missing" | "pending" | "approved" | "needs_changes"; note?: string | null };
type Onboarding = { stage: "details" | "services" | "documents" | "submitted"; step: number | null; bookable: boolean;
  verify?: { submitted: boolean; submittedAt: string | null }; // v3 B3 (older servers: none)
  signupFlow?: 3 | null; // v3 sign-ups take a selfie (R13); older apps never do
  checklist: { payouts: boolean; photo: boolean; hours: boolean; email: boolean; about: boolean; licences: LicenceRow[] } };
type Detail = { ProviderDetails: Buddy & {
  availability?: { day: number; isOpen: boolean; from: string; to: string }[]; averageRating?: number; totalRatings?: number; totalEarning?: number;
  travelMiles?: number; licences?: { categoryId: string; url?: string | null }[]; onboarding?: Onboarding | null;
}; categories?: { categoryName: string }[] };
type Offer = { _id: string; serviceName: string; price: number; durationType: number };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // backend day 0 = Sunday (moment .day())
const DOCS: [keyof Buddy, string, React.ElementType][] = [["IdProofFront", "Photo ID, front", IdentificationCard], ["IdProofBack", "Photo ID, back", IdentificationCard], ["certificate", "Trade license", FileText], ["additionalDoc", "Insurance", FileText]];
// R13 (1.3): the live selfie, shown first (owner, 6 Oct 2026); only v3 sign-ups (signupFlow 3) take one, so older
// Buddies are counted out of 4, v3 Buddies out of 5.
const SELFIE: (typeof DOCS)[number] = ["selfieDoc", "Selfie (match to the ID)", UserFocus];
export const docsFor = (b: Buddy, v3 = b.signupFlow === 3) => (v3 || b.selfieDoc ? [SELFIE, ...DOCS] : DOCS);
export const docCount = (b: Buddy, v3?: boolean) => docsFor(b, v3).filter(([k]) => !!b[k]).length;
const LICENCE: Record<LicenceRow["status"], [string, string]> = {
  missing: ["c-mut", "Not uploaded"], pending: ["c-warn", "Waiting for review"], approved: ["c-ok", "Approved"], needs_changes: ["c-bad", "Needs changes"],
};
const STAGE = { details: "Step 1 of 3 · Your details", services: "Step 2 of 3 · Services and rates", documents: "Step 3 of 3 · Documents", submitted: "Sign-up sent" };

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
  const [licNow, setLicNow] = useState<LicenceRow[]>();
  const [sendBack, setSendBack] = useState<LicenceRow>();

  if (error) return <div className={s.review}><p className="err">{error}</p><button className="btn sm" onClick={reload}>Try again</button></div>;
  if (loading || !data) return <div className={s.review}><div className="skeleton" style={{ height: 48, width: "60%" }} /><div className="skeleton" style={{ height: 160 }} /></div>;
  const b = { ...data.ProviderDetails, isActive: activeNow ?? known.active }, name = fullName(b), status = decidedNow ?? known.status;
  const canApprove = !!b.IdProofFront && !!b.IdProofBack;
  const ob = data.ProviderDetails.onboarding, licences = licNow ?? ob?.checklist.licences ?? [];
  // A Buddy on an older app sent one generic licence (`certificate`); the server lets it be approved for a category.
  const fileOf = (l: LicenceRow) => data.ProviderDetails.licences?.find((x) => String(x.categoryId) === String(l.categoryId))?.url || b.certificate || undefined;

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
  // Separate from the ID decision. "Needs changes" throws so ReasonDialog shows the error inside itself.
  async function licence(l: LicenceRow, status: "approved" | "needs_changes", note = "") {
    const { data: r } = await api<{ licences: LicenceRow[] }>("admin/service-provider/licence-status", { method: "PATCH", body: { serviceProviderId: id, categoryId: l.categoryId, status, note: note || undefined } });
    setLicNow(r.licences);
    setSendBack(undefined);
    toast(status === "approved" ? `${l.licenceName} approved · ${name.split(" ")[0]} gets a notice` : `${l.licenceName} sent back · ${name.split(" ")[0]} gets your note`);
  }
  async function approveLicence(l: LicenceRow) {
    setBusy(true);
    try { await licence(l, "approved"); } catch (e) { toast((e as Error).message); }
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
        <dt>Nickname</dt><dd>{b.nickname ? <>{b.nickname} <span className="muted">· customers see only this</span></> : <span className="muted">None · customers see the first name</span>}</dd>
        <dt>Phone</dt><dd>{phone(b.phone, b.countryCode)}</dd>
        <dt>Service area</dt><dd>{b.address?.city ? `${b.address.city}, ${b.address.state ?? ""} ${b.postalCode ?? ""}` : "Not added yet"}</dd>
        {ob?.verify && <><dt>Verification</dt><dd>{ob.verify.submitted ? `Sent for verification${ob.verify.submittedAt ? ` ${date(ob.verify.submittedAt)}` : ""}` : "Not sent yet"}</dd></>}
        <dt>Travel distance</dt><dd>{data.ProviderDetails.travelMiles ? `Travels up to ${data.ProviderDetails.travelMiles} mi` : "Not set yet"}</dd>
        <dt>Rating</dt><dd>{data.ProviderDetails.totalRatings ? `${data.ProviderDetails.averageRating?.toFixed(1)} from ${data.ProviderDetails.totalRatings} reviews` : "No reviews yet"}</dd>
        <dt>Trades</dt><dd>{data.categories?.map((c) => c.categoryName).join(", ") || "None picked"}</dd>
      </dl>

      <section><h3 className={s.h3}>Identity &amp; documents <span className="muted">· {docCount(b, ob?.signupFlow === 3)} of {docsFor(b, ob?.signupFlow === 3).length}</span></h3>
        <div className={s.docs}>
          {docsFor(b, ob?.signupFlow === 3).map(([k, label, Icon]) => {
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

      {licences.length > 0 && <section><h3 className={s.h3}>Licenses <span className="muted">· separate from the ID decision</span></h3>
        <ul className={s.offers}>{licences.map((l) => {
          const url = fileOf(l), [tone, word] = l.status === "missing" && url ? ["c-warn", "Sent from an older app"] : LICENCE[l.status];
          return (
            <li key={l.categoryId} className={s.lic}>
              <span className={s.licm}><b><Certificate size={16} aria-hidden /> {l.licenceName}</b><small className="muted">Required for {l.categoryName}{l.status === "needs_changes" && l.note ? ` · Your note: ${l.note}` : ""}</small></span>
              <span className={`chip ${tone}`}>{word}</span>
              <span className={s.lica}>
                {url ? <a className={s.open} href={url} target="_blank" rel="noopener noreferrer">Open <ArrowSquareOut size={12} /></a> : <span className="hint">No file yet</span>}
                {url && l.status !== "approved" && <button className="btn sm p" type="button" onClick={() => approveLicence(l)} disabled={busy}><Check size={14} weight="bold" />Approve</button>}
                {url && l.status !== "needs_changes" && <button className="btn sm d" type="button" onClick={() => setSendBack(l)} disabled={busy}>Needs changes</button>}
              </span>
            </li>
          );
        })}</ul>
      </section>}

      {ob && <section><h3 className={s.h3}>Onboarding <span className="muted">· {STAGE[ob.stage]}</span></h3>
        <ul className={s.offers}>
          {([["Get paid", ob.checklist.payouts], ["Profile photo", ob.checklist.photo], ["Working hours", ob.checklist.hours], ["Email added", ob.checklist.email], ["About you", ob.checklist.about]] as const).map(([t, ok]) =>
            <li key={t}><span>{t}</span>{ok ? <span className="chip c-ok">Done</span> : <span className="chip c-mut">Not yet</span>}</li>)}
          <li><b>Customers can book</b>{ob.bookable ? <span className="chip c-ok">Yes</span> : <span className="chip c-mut">Not yet</span>}</li>
        </ul>
        {!ob.bookable && <p className="hint" style={{ marginTop: 6 }}>Customers see a Buddy once they&apos;re approved, have a profile photo and can get paid. Licensed services also need their license approved.</p>}
      </section>}

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
          hint="For your records. It isn't sent to the Buddy yet."
          confirm="Reject application" />
      )}

      {sendBack && (
        <ReasonDialog title={`${sendBack.licenceName} needs changes`} onClose={() => setSendBack(undefined)} onConfirm={(note) => licence(sendBack, "needs_changes", note)}
          next={<>{name.split(" ")[0]} gets an app notice with your note and uploads the license again. Their {sendBack.categoryName} services stay hidden from customers until you approve it.</>}
          label="What to change" placeholder="Example: The photo is cut off. Upload the whole license."
          hint="Sent to the Buddy as written." required missing="Add a note telling the Buddy what to change." max={500}
          confirm="Send back" />
      )}

      {block && (
        <Modal title={b.isActive === 1 ? `Block ${name}` : `Unblock ${name}`} onClose={() => setBlock(false)}
          footer={<><button className="btn" onClick={() => setBlock(false)}>Back</button><button className={`btn ${b.isActive === 1 ? "ds" : "p"}`} onClick={toggleActive} disabled={busy}>{b.isActive === 1 ? "Block" : "Unblock"}</button></>}>
          {b.isActive === 1
            ? <><p>{name.split(" ")[0]} can't sign in or take new jobs.</p><div className="note"><Warning size={16} />Their upcoming paid jobs need to be canceled and refunded. Check Bookings for their open jobs.</div></>
            : <p>{name.split(" ")[0]} can sign in and take jobs again.</p>}
        </Modal>
      )}
    </div>
  );
}

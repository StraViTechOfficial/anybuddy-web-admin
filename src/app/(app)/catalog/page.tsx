"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, MagnifyingGlass, Lock, CaretRight, Warning, TextAlignLeft } from "@phosphor-icons/react";
import { useLoad } from "@/lib/useLoad";
import { PageHead, LoadError, Empty } from "@/components/ui";
import { plural } from "@/lib/format";
import { loadCatalog, norm, pinned, priceText, type Category, type Service } from "./data";
import { ServiceForm } from "./ServiceForm";
import { CategoryWizard } from "./CategoryWizard";
import { CategoryEdit, OutOfRangeNote } from "./CategoryEdit";
import s from "./catalog.module.css";

type Open = { kind: "svc"; svc?: Service; cat?: string; name?: string } | { kind: "wizard" } | { kind: "cat"; cat: Category } | null;

export default function CatalogPage() {
  const { data, error, reload, loading } = useLoad(loadCatalog);
  const [selId, setSelId] = useState<string>();
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState("");
  const [open, setOpen] = useState<Open>(null);
  const [intro, setIntro] = useState(true);
  useEffect(() => { if (localStorage.getItem("ab_cat_intro") === "0") setIntro(false); }, []);

  const cat = data?.cats.find((c) => c._id === selId) ?? data?.cats[0];
  const inCat = useMemo(() => (data && cat ? data.services.filter((x) => x.categoryId === cat._id) : []), [data, cat]);
  const found = useMemo(() => (data && q.trim().length > 1 ? data.services.filter((x) => norm(x.serviceName).includes(norm(q))) : null), [data, q]);
  if (error) return <LoadError message={error} retry={reload} />;
  const live = (x: Service) => !!data?.prices[x.serviceName] && x.isActive === 1;
  const done = () => { setOpen(null); reload(); };
  const catName = (id: string) => data?.cats.find((c) => c._id === id)?.categoryName ?? data?.retired.find((c) => c._id === id)?.categoryName ?? "";

  const row = (x: Service, showCat = false) => (
    <button key={x._id} type="button" className={s.svrow} onClick={() => setOpen({ kind: "svc", svc: x })}>
      <span className={s.tile}>{x.image ? <img src={x.image} alt="" /> : x.serviceName[0]}</span>
      <span className={s.nm}><b>{x.serviceName}{showCat && <span className="muted"> in {catName(x.categoryId)}</span>}</b>
        <small>{!x.description || norm(x.description) === norm(x.serviceName) ? <span className="flag"><TextAlignLeft size={12} />Add a description</span> : x.description}</small></span>
      <span className={s.pr}>{x.isActive !== 1 ? <span className="chip c-mut">Turned off</span> : live(x) ? <b>{priceText(data!.prices[x.serviceName])}</b> : <span className="chip c-mut">Hidden · no Buddy yet</span>}
        {live(x) && !data!.prices[x.serviceName].priceUnit && <small className="flag"><Warning size={12} />no unit</small>}</span>
      <CaretRight size={16} className="muted" />
    </button>
  );

  return (
    <>
      <PageHead title="Categories & services" sub="Customers pick a category, then a service. Each Buddy sets their own price for the services they offer.">
        <button className="btn p" onClick={() => setOpen({ kind: "wizard" })}><Plus size={16} weight="bold" />New category</button>
      </PageHead>

      {intro && (
        <section className={`box ${s.how}`} aria-label="How it fits together">
          <header><h2>How it fits together</h2><button className="btn sm ghost" onClick={() => { setIntro(false); localStorage.setItem("ab_cat_intro", "0"); }}>Hide</button></header>
          <ol>
            <li><span>Category</span><b>Plumbing</b><small>The group customers browse.</small></li>
            <li><span>Service</span><b>Toilet</b><small>One job inside a category, with its booking steps.</small></li>
            <li><span>Buddy&apos;s price</span><b>Set by each Buddy</b><small>Buddies pick the services they do and their hourly rate.</small></li>
            <li><span>Customer sees</span><b>Toilet · From $X/hr</b><small>The lowest price. Hidden until a Buddy offers it.</small></li>
          </ol>
        </section>
      )}

      {data && <OutOfRangeNote rows={data.outOfRange} />}

      <div className={s.cat3}>
        <section className="box" aria-label="Categories">
          <header className={s.bh}><h2>Categories</h2><span className="hint">In app order</span></header>
          <ol className={s.order}>
            {(data?.cats ?? []).map((c, i) => {
              const all = data!.services.filter((x) => x.categoryId === c._id), n = all.filter(live).length;
              return (
                <li key={c._id}><button type="button" aria-current={c._id === cat?._id} onClick={() => { setSelId(c._id); setQ(""); }}>
                  <span className={s.tile}>{c.image || c.icon ? <img src={c.image || c.icon} alt="" /> : c.categoryName[0]}</span>
                  <span className={s.nm}><b>{c.categoryName}</b><small>{plural(all.length, "service")} · {n ? <span style={{ color: "var(--ok)" }}>{n} live</span> : <span style={{ color: "var(--bad)" }}>none live</span>}</small></span>
                  {pinned(c.categoryName) ? <Lock size={14} className="muted" aria-label="Pinned first" /> : <span className={s.rank}>{i + 1}</span>}
                </button></li>
              );
            })}
            {loading && !data && <li className="skeleton" style={{ height: 200, margin: 10 }} />}
          </ol>
          <p className={`hint ${s.pad}`}>Plumbing and Electrical stay first, the rest A–Z.</p>
          <div className={s.pad}><button className={s.addrow} onClick={() => setOpen({ kind: "wizard" })}><Plus size={16} />New category</button></div>
          {!!data?.retired.length && <details className={s.retired}><summary>Retired · {data.retired.length}</summary>
            <ul>{data.retired.map((c) => <li key={c._id}><span>{c.categoryName}</span><button className="btn sm" onClick={() => setOpen({ kind: "cat", cat: c })}>Open</button></li>)}</ul></details>}
        </section>

        <section className="box" aria-live="polite">
          <header className={s.bh}><label className={s.search}><span className="sr">Find a service</span><MagnifyingGlass size={16} aria-hidden /><input className="input" placeholder="Find a service in any category" value={q} onChange={(e) => setQ(e.target.value)} /></label></header>
          {found ? (found.length ? <div className={s.list}>{found.map((x) => row(x, true))}</div>
            : <Empty title={`No service called “${q}”`}>Add it to the category it belongs in.<br /><button className="btn sm p" style={{ marginTop: 10 }} onClick={() => setOpen({ kind: "svc", name: q, cat: cat?._id })}>Add “{q}”</button></Empty>)
            : cat && (
              <>
                <div className={s.cathd}>
                  <span className={`${s.tile} ${s.lg}`}>{cat.image || cat.icon ? <img src={cat.image || cat.icon} alt="" /> : cat.categoryName[0]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><h2 style={{ fontSize: "var(--fs-h3)" }}>{cat.categoryName}</h2><p className="muted">{cat.description || "No description yet"}</p></div>
                  <button className="btn sm" onClick={() => setOpen({ kind: "cat", cat })}>Edit category</button>
                </div>
                <div className={s.svhd}><h3>Services in {cat.categoryName} <span className="muted">· {inCat.length} · {inCat.filter(live).length} live</span></h3>
                  <button className="btn sm p" onClick={() => setOpen({ kind: "svc", cat: cat._id })}><Plus size={14} weight="bold" />Add a service to {cat.categoryName}</button></div>
                {inCat.length > 0 && !inCat.some(live) && <div className="note" style={{ margin: "0 18px 12px" }}><Warning size={16} />Customers don&apos;t see {cat.categoryName} yet: no Buddy offers any of its services.</div>}
                <div className={s.list}>{inCat.length ? [...inCat].sort((a, b) => Number(live(b)) - Number(live(a)) || a.serviceName.localeCompare(b.serviceName)).map((x) => row(x)) : <Empty title={`No services in ${cat.categoryName} yet`}>A service is one job a customer can book, like “Toilet” in Plumbing.</Empty>}</div>
                <form className={s.quick} onSubmit={(e) => { e.preventDefault(); if (quick.trim()) { setOpen({ kind: "svc", cat: cat._id, name: quick.trim() }); setQuick(""); } }}>
                  <label className="sr" htmlFor="qa">New service name</label>
                  <input id="qa" className="input" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={`New service in ${cat.categoryName}, then Enter`} autoComplete="off" />
                  <button className="btn sm">Add</button>
                </form>
              </>
            )}
        </section>

        <section className={`box ${s.pv}`}><header className={s.bh}><h2>In the customer app</h2></header>
          <div className={s.phone}><span className={s.pbar} /><h5>Services</h5>
            <div className={s.chips}>{(data?.cats ?? []).filter((c) => c._id === cat?._id || data!.services.some((x) => x.categoryId === c._id && live(x))).map((c) => <span key={c._id} className={c._id === cat?._id ? s.on : ""}>{c.categoryName}</span>)}</div>
            <div className={s.pvl}>{inCat.filter(live).map((x) => <div key={x._id}><b>{x.serviceName}</b><small>{priceText(data!.prices[x.serviceName])}</small></div>)}
              {inCat.some((x) => !live(x)) && <p className={s.pvh}>{inCat.filter((x) => !live(x)).length} hidden until a Buddy offers them</p>}</div>
          </div>
        </section>
      </div>

      {open?.kind === "svc" && data && <ServiceForm data={data} svc={open.svc} catId={open.cat ?? cat?._id} name={open.name} onClose={() => setOpen(null)} onSaved={done} />}
      {open?.kind === "wizard" && data && <CategoryWizard data={data} onClose={() => setOpen(null)} onCreated={(id) => { setSelId(id); done(); }} />}
      {open?.kind === "cat" && data && <CategoryEdit data={data} cat={open.cat} onClose={() => setOpen(null)} onSaved={done} />}
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, User } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { fullName, initials, phone } from "@/lib/format";
import type { Person } from "@/lib/types";
import { PageHead, Empty, LoadError, SkeletonRows } from "@/components/ui";

type Customer = Person & { address?: { city?: string; state?: string }; isActive?: number };

export default function Customers() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setTerm(search.trim()); setPage(1); }, 250); return () => clearTimeout(t); }, [search]);
  const { data, error, loading, reload } = useLoad(() => api<Customer[]>("admin/customer-management/list-users", { query: { search: term, page, limit: 20 } }), [term, page]);
  const rows = data?.data ?? [], total = data?.count ?? 0, pages = Math.max(1, Math.ceil(total / 20));

  return (
    <>
      <PageHead title="Customers" sub={`${total || "–"} customers`} />
      <section className="box">
        <div className="tbar"><label className="search" style={{ marginLeft: 0 }}><span className="sr">Find a customer</span><MagnifyingGlass size={16} aria-hidden /><input className="input" placeholder="Name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
        {error ? <LoadError message={error} retry={reload} /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="stack">
              <thead><tr><th>Customer</th><th className="hs">Phone</th><th>City</th><th>Status</th></tr></thead>
              <tbody>
                {loading && !rows.length ? <SkeletonRows cols={4} /> : rows.map((c) => (
                  <tr key={c._id} className="click" onClick={() => router.push(`/customers/${c._id}`)}>
                    <td><Link href={`/customers/${c._id}`} className="who" onClick={(e) => e.stopPropagation()}><span className="av">{initials(fullName(c))}</span><span><b>{fullName(c)}</b><small>{c.email}</small></span></Link></td>
                    <td className="hs">{phone(c.phone, c.countryCode)}</td>
                    <td>{c.address?.city ?? <span className="muted">Not added</span>}</td>
                    <td>{c.isActive === 0 ? <span className="chip c-bad">Blocked</span> : <span className="chip c-ok">Active</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !rows.length && <Empty icon={User} title={term ? `No customer matches “${term}”` : "No customers yet"} />}
            {pages > 1 && <div className="tbar" style={{ borderBottom: 0, justifyContent: "flex-end" }}><span className="hint">Page {page} of {pages}</span>
              <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}
          </div>
        )}
      </section>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableItem } from "./sortable-item";
import {
  Plus,
  Pencil,
  Image as ImageIcon,
  Eye,
  EyeOff,
  FolderMinus,
  Settings,
  Trash2,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";

/* ---------- Types ---------- */
type Level = "root" | "sub" | "seg";
type Node = {
  id: string;
  name: string;
  sort_order: number;
  level: Level;
  status?: "active" | "hidden";
  hide_products?: boolean;
  image?: string | null;
  image_alt?: string | null;
  children?: Node[];
};

type OpReorder = {
  kind: "reorder";
  parentId: string | null;
  level: Level;
  order: string[];
};
type OpMove = {
  kind: "move";
  id: string;
  newParentId: string | null;
  newIndex: number | null;
};
type OpConvert = {
  kind: "convert";
  id: string;
  toLevel: Level;
  targetParentId: string | null;
  position: number | null;
};
type PendingOp = OpReorder | OpMove | OpConvert;

/* ---------- Helpers ---------- */
const cid = (level: Level, parentId: string | null) =>
  `${level}:${parentId ?? "root"}`;

type DragMeta = { level: Level; parentId: string | null; index: number };
function findMeta(tree: Node[], id: string): DragMeta | null {
  const iRoot = tree.findIndex((x) => x.id === id);
  if (iRoot >= 0) return { level: "root", parentId: null, index: iRoot };
  for (const r of tree) {
    const iSub = (r.children ?? []).findIndex((s) => s.id === id);
    if (iSub >= 0) return { level: "sub", parentId: r.id, index: iSub };
    for (const s of r.children ?? []) {
      const iSeg = (s.children ?? []).findIndex((g) => g.id === id);
      if (iSeg >= 0) return { level: "seg", parentId: s.id, index: iSeg };
    }
  }
  return null;
}
function idsOf(list: Node[]) {
  return list.map((x) => x.id);
}

/* ---------- Page ---------- */
export default function CategoriesTreePage() {
  const [tree, setTree] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI state
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [overContainer, setOverContainer] = useState<string | null>(null);

  // Draft ops
  const [ops, setOps] = useState<PendingOp[]>([]);
  const [savingOps, setSavingOps] = useState(false);
  const DRAFT_KEY = "taxons:draftOps";

  // Add + Edit
  const [addFor, setAddFor] = useState<{
    level: Level;
    parentId?: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [editName, setEditName] = useState("");

  // SEO
  const [seoFor, setSeoFor] = useState<string | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seo, setSeo] = useState({
    slug: "",
    meta_title: "",
    meta_description: "",
    canonical_url: "",
  });

  // Image modal
  const [imgFor, setImgFor] = useState<{
    id: string;
    current?: string | null;
    alt?: string | null;
  } | null>(null);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [imgAlt, setImgAlt] = useState("");
  const [imgSaving, setImgSaving] = useState(false);
  const [imgAltSaving, setImgAltSaving] = useState(false);
  const [imgDeleting, setImgDeleting] = useState(false);

  // Drag overlay
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /* ------- load tree ------- */
  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/taxons/tree", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const t: Node[] = await r.json();
      setTree(t);
      const m: Record<string, boolean> = {};
      t.forEach((c) => {
        m[c.id] = true;
        (c.children ?? []).forEach((s) => {
          m[s.id] = true;
          (s.children ?? []).forEach((g) => (m[g.id] = true));
        });
      });
      setOpen(m);
    } catch (e: any) {
      setErr(e.message || "تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  /* ------- draft persistence ------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setOps(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(ops));
    } catch {}
  }, [ops]);

  /* ------- list helpers ------- */
  function getList(level: Level, parentId: string | null): Node[] {
    if (level === "root") return tree;
    if (level === "sub") {
      const p = tree.find((x) => x.id === parentId);
      return p?.children ?? [];
    }
    for (const r of tree) {
      const s = r.children?.find((x) => x.id === parentId);
      if (s) return s.children ?? [];
    }
    return [];
  }
  function setList(level: Level, parentId: string | null, list: Node[]) {
    setTree((prev) => {
      const c = structuredClone(prev) as Node[];
      if (level === "root") {
        (c as any).splice(0, c.length, ...list);
        return c;
      }
      if (level === "sub") {
        const p = c.find((x) => x.id === parentId);
        if (p) p.children = list;
        return c;
      }
      for (const r of c) {
        const s = r.children?.find((x) => x.id === parentId);
        if (s) s.children = list;
      }
      return c;
    });
  }

  /* ------- draft ops helpers ------- */
  function enqueueReorder(op: OpReorder) {
    setOps((prev) => {
      const next = prev.filter(
        (o) =>
          !(
            o.kind === "reorder" &&
            o.level === op.level &&
            (o.parentId ?? null) === (op.parentId ?? null)
          )
      );
      next.push(op);
      return next;
    });
  }
  function enqueueMove(op: OpMove) {
    setOps((prev) => [...prev, op]);
  }
  function enqueueConvert(op: OpConvert) {
    setOps((prev) => [...prev, op]);
  }
  function clearOps() {
    setOps([]);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }

  /* ------- add / edit ------- */
  function onAdd(level: Level, parentId?: string) {
    setAddFor({ level, parentId });
    setName("");
    setErr(null);
  }
  async function saveNew(e: React.FormEvent) {
    e.preventDefault();
    if (!addFor) return;
    if (!name.trim()) {
      setErr("اكتب الاسم");
      return;
    }
    setSavingAdd(true);
    try {
      const r = await fetch("/api/admin/taxons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: addFor.level,
          parentId: addFor.parentId ?? null,
          name: name.trim(),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setAddFor(null);
      setName("");
      await load();
    } catch (e: any) {
      setErr(e.message || "تعذر الإضافة");
    } finally {
      setSavingAdd(false);
    }
  }
  function startEdit(id: string, current: string) {
    setEditing({ id });
    setEditName(current);
    setErr(null);
  }
  async function saveEdit() {
    if (!editing) return;
    if (!editName.trim()) {
      setErr("اكتب الاسم");
      return;
    }
    const r = await fetch(`/api/admin/taxons/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (!r.ok) {
      setErr(await r.text());
      return;
    }
    setEditing(null);
    await load();
  }

  /* ------- SEO modal ------- */
  async function openSeo(id: string) {
    setSeoFor(id);
    setSeoLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/taxons/${id}/seo`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (j?.data) {
        setSeo({
          slug: j.data.slug ?? "",
          meta_title: j.data.meta_title ?? "",
          meta_description: j.data.meta_description ?? "",
          canonical_url: j.data.canonical_url ?? "",
        });
      } else {
        setSeo({
          slug: "",
          meta_title: "",
          meta_description: "",
          canonical_url: "",
        });
      }
    } catch (e: any) {
      setErr(e.message || "تعذر تحميل SEO");
    } finally {
      setSeoLoading(false);
    }
  }
  async function saveSeo() {
    if (!seoFor) return;
    const r = await fetch(`/api/admin/taxons/${seoFor}/seo`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: "ar", ...seo }),
    });
    if (!r.ok) {
      setErr(await r.text());
      return;
    }
    setSeoFor(null);
  }

  /* ------- Image modal ------- */
  function openImageModal(
    id: string,
    current?: string | null,
    currentAlt?: string | null
  ) {
    setImgFor({ id, current, alt: currentAlt ?? null });
    setFileObj(null);
    setImgAlt(currentAlt ?? "");
  }
  async function saveImage() {
    if (!imgFor || !fileObj) return;
    setImgSaving(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", fileObj);
      if (imgAlt) fd.append("alt", imgAlt);
      const r = await fetch(`/api/admin/taxons/${imgFor.id}/image`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      setImgFor(null);
      await load();
    } catch (e: any) {
      setErr(e.message || "فشل رفع الصورة");
    } finally {
      setImgSaving(false);
    }
  }
  async function saveAltOnly() {
    if (!imgFor) return;
    setImgAltSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/taxons/${imgFor.id}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt: imgAlt || null }),
      });
      if (!r.ok) throw new Error(await r.text());
      setImgFor(null);
      await load();
    } catch (e: any) {
      setErr(e.message || "فشل تحديث ALT");
    } finally {
      setImgAltSaving(false);
    }
  }
  async function deleteImage() {
    if (!imgFor) return;
    if (!confirm("حذف صورة التصنيف؟")) return;
    setImgDeleting(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/taxons/${imgFor.id}/image`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(await r.text());
      setImgFor(null);
      await load();
    } catch (e: any) {
      setErr(e.message || "فشل حذف الصورة");
    } finally {
      setImgDeleting(false);
    }
  }

  /* ------- toggles ------- */
  async function toggleStatus(id: string, current?: "active" | "hidden") {
    const next = current === "hidden" ? "active" : "hidden";
    await fetch(`/api/admin/taxons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await load();
  }
  async function toggleHideProducts(id: string, current?: boolean) {
    const next = !current;
    await fetch(`/api/admin/taxons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hide_products: next }),
    });
    await load();
  }

  function handleMenuAction(
    action:
      | "add-sub"
      | "toggle-hide"
      | "toggle-hide-products"
      | "seo"
      | "delete",
    id: string,
    meta?: {
      status?: "active" | "hidden";
      hide_products?: boolean;
      image?: string | null;
      image_alt?: string | null;
    }
  ) {
    switch (action) {
      case "add-sub":
        onAdd("sub", id);
        break;
      case "toggle-hide":
        toggleStatus(id, meta?.status);
        break;
      case "toggle-hide-products":
        toggleHideProducts(id, meta?.hide_products);
        break;
      case "seo":
        openSeo(id);
        break;
      case "delete":
        if (confirm("سيتم أرشفة التصنيف (بدون حذف فعلي). متابعة؟")) {
          fetch(`/api/admin/taxons/${id}`, { method: "DELETE" })
            .then(async (r) => {
              if (r.ok) return load();
              const t = await r.json().catch(() => ({}));
              return Promise.reject(t?.error || "فشل الأرشفة");
            })
            .catch((e) =>
              setErr(typeof e === "string" ? e : e?.message || "فشل الأرشفة")
            );
        }
        break;
    }
  }

  /* ------- drag overlay helpers ------- */
  function getNodeById(id: string): Node | undefined {
    for (const r of tree) {
      if (r.id === id) return r;
      for (const s of r.children ?? []) {
        if (s.id === id) return s;
        for (const g of s.children ?? []) {
          if (g.id === id) return g;
        }
      }
    }
    return undefined;
  }

  /* ------- DnD handlers ------- */
  const measuring = useMemo(
    () => ({ droppable: { strategy: MeasuringStrategy.Always } }),
    []
  );

  function onDragStart(ev: DragStartEvent) {
    setActiveId(String(ev.active.id));
  }
  function onDragOver(ev: DragOverEvent) {
    const { over } = ev;
    if (!over) return;
    const overId = String(over.id);
    setOverContainer(overId.includes(":") ? overId : null);
  }

  async function onDragEnd(ev: DragEndEvent) {
    setActiveId(null);
    setOverContainer(null);
    const { active, over } = ev;
    if (!active || !over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = findMeta(tree, activeId);
    if (!from) return;

    // وجهة الإسقاط
    let to: { level: Level; parentId: string | null } | null = null;
    if (overId.includes(":")) {
      const [lvl, pid] = overId.split(":");
      to = { level: lvl as Level, parentId: pid === "root" ? null : pid };
    } else {
      const overMeta = findMeta(tree, overId);
      if (!overMeta) return;
      const childOf = (lvl: Level): Level => (lvl === "root" ? "sub" : "seg");
      if (
        (from.level === "root" && overMeta.level === "root") ||
        (from.level === "sub" && overMeta.level === "sub")
      ) {
        to = { level: childOf(overMeta.level), parentId: overId };
      } else {
        to = { level: overMeta.level, parentId: overMeta.parentId };
      }
    }
    if (!to) return;

    // 1) reorder
    if (from.level === to.level && from.parentId === to.parentId) {
      const list = getList(from.level, from.parentId);
      const oldIndex = from.index;
      const newIndex = overId.includes(":")
        ? list.length - 1
        : list.findIndex((x) => x.id === overId);
      const moved = arrayMove(list, oldIndex, newIndex);
      setList(from.level, from.parentId, moved);
      enqueueReorder({
        kind: "reorder",
        level: from.level,
        parentId: from.parentId ?? null,
        order: moved.map((x) => x.id),
      });
      return;
    }

    // 2) move
    if (
      (from.level === "sub" && to.level === "sub") ||
      (from.level === "seg" && to.level === "seg")
    ) {
      const src = getList(from.level, from.parentId);
      const dst = getList(to.level, to.parentId);
      const item = src[from.index];
      if (!item) return;
      const insertAt = overId.includes(":")
        ? dst.length
        : Math.max(
            0,
            dst.findIndex((x) => x.id === overId)
          );
      const srcAfter = [...src];
      srcAfter.splice(from.index, 1);
      const dstAfter = [...dst];
      dstAfter.splice(insertAt, 0, item);
      setList(from.level, from.parentId, srcAfter);
      setList(to.level, to.parentId, dstAfter);
      enqueueMove({
        kind: "move",
        id: activeId,
        newParentId: to.parentId ?? null,
        newIndex: insertAt,
      });
      return;
    }

    // 3) convert
    const src = getList(from.level, from.parentId);
    const item = src[from.index];
    if (!item) return;
    const dst = getList(to.level, to.parentId);
    const insertAt = overId.includes(":")
      ? dst.length
      : Math.max(
          0,
          dst.findIndex((x) => x.id === overId)
        );
    const srcAfter = [...src];
    srcAfter.splice(from.index, 1);
    const dstAfter = [...dst];
    dstAfter.splice(insertAt, 0, item);
    setList(from.level, from.parentId, srcAfter);
    setList(to.level, to.parentId, dstAfter);
    enqueueConvert({
      kind: "convert",
      id: activeId,
      toLevel: to.level,
      targetParentId: to.level === "root" ? null : to.parentId,
      position: insertAt,
    });
  }

  /* ------- UI helpers ------- */
  function toggle(id: string) {
    setOpen((m) => ({ ...m, [id]: !m[id] }));
  }

  const activeNode = activeId ? getNodeById(activeId) : undefined;

  if (loading) return <div className="p-4">جارٍ التحميل…</div>;

  /* ===================== RETURN ===================== */
  const anySaving =
    savingOps || savingAdd || imgSaving || imgAltSaving || imgDeleting;

  return (
    <div className="content relative mx-auto max-w-6xl px-3 sm:px-5 py-4 space-y-6">
      {/* لودينغ مركزي ناعم وقت الحفظ (جيل زد) */}
      {anySaving && <CenterLoader text="جارٍ الحفظ…" />}

      <DraftBar
        count={ops.length}
        saving={savingOps}
        onSave={async () => {
          if (!ops.length) return;
          setSavingOps(true);
          setErr(null);
          try {
            for (const op of ops) {
              if (op.kind === "reorder") {
                const r = await fetch("/api/admin/taxons/reorder", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    parentId: op.parentId,
                    level: op.level,
                    order: op.order,
                  }),
                });
                if (!r.ok) throw new Error("reorder failed");
              } else if (op.kind === "move") {
                const r = await fetch("/api/admin/taxons/move", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: op.id,
                    newParentId: op.newParentId,
                    newIndex: op.newIndex,
                  }),
                });
                if (!r.ok) throw new Error("move failed");
              } else {
                const r = await fetch("/api/admin/taxons/convert", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: op.id,
                    toLevel: op.toLevel,
                    targetParentId: op.targetParentId,
                    position: op.position,
                  }),
                });
                if (!r.ok) throw new Error("convert failed");
              }
            }
            clearOps();
            await load();
          } catch (e: any) {
            setErr(e.message || "فشل حفظ التغييرات");
          } finally {
            setSavingOps(false);
          }
        }}
        onDiscard={() => {
          clearOps();
          load();
        }}
      />

      <header className="sticky top-0 z-40 -mx-3 sm:-mx-5 px-3 sm:px-5 py-3 bg-white/80 backdrop-blur border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-bold tracking-tight">
            التصنيفات — رئيسي / فرعي / فروع الفروع (Taxons)
          </h1>
          <button
            onClick={() => onAdd("root")}
            className="inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-2 text-sm hover:opacity-95 active:scale-[.98] shadow-sm"
          >
            <Plus size={16} />
            <span>إضافة تصنيف رئيسي</span>
          </button>
        </div>
      </header>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
          {err}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        measuring={measuring}
      >
        {/* ROOT append dropzone */}
        <div
          id={cid("root", null)}
          data-droppable
          className={`rounded-md border border-dashed my-2 ${
            overContainer === cid("root", null)
              ? "border-blue-400 bg-blue-50/40"
              : "border-transparent"
          }`}
        />
        <SortableContext
          items={idsOf(tree)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {tree.map((cat) => {
              const openCat = !!open[cat.id];
              return (
                <li key={cat.id} className="relative">
                  <SortableItem id={cat.id}>
                    <Row
                      id={cat.id}
                      title={cat.name}
                      hidden={cat.status === "hidden"}
                      prodsHidden={!!cat.hide_products}
                      image={cat.image || undefined}
                      left={
                        <CaretButton
                          open={openCat}
                          onClick={() => toggle(cat.id)}
                        />
                      }
                      right={
                        <div className="flex items-center gap-1.5">
                          <ActionButton
                            label="تعديل"
                            icon={<Pencil size={14} />}
                            onClick={() => startEdit(cat.id, cat.name)}
                          />
                          <ActionButton
                            label="فرعي"
                            icon={<Plus size={14} />}
                            onClick={() => onAdd("sub", cat.id)}
                          />
                          <ActionButton
                            label="صورة"
                            icon={<ImageIcon size={14} />}
                            onClick={() =>
                              openImageModal(cat.id, cat.image, cat.image_alt)
                            }
                          />
                          <MoreMenu
                            taxonId={cat.id}
                            status={cat.status ?? "active"}
                            hideProducts={!!cat.hide_products}
                            onAction={(a, id) =>
                              handleMenuAction(a, id, {
                                status: cat.status,
                                hide_products: !!cat.hide_products,
                                image: cat.image ?? null,
                                image_alt: cat.image_alt ?? null,
                              })
                            }
                          />
                        </div>
                      }
                      muted={activeId === cat.id}
                    />
                  </SortableItem>

                  {openCat && (
                    <LevelBlock
                      containerId={cid("sub", cat.id)}
                      highlight={overContainer === cid("sub", cat.id)}
                    >
                      <SortableContext
                        items={idsOf(cat.children ?? [])}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-2">
                          {(cat.children ?? []).map((sub) => {
                            const openSub = !!open[sub.id];
                            return (
                              <li key={sub.id} className="relative">
                                <SortableItem id={sub.id}>
                                  <Row
                                    id={sub.id}
                                    title={sub.name}
                                    hidden={sub.status === "hidden"}
                                    prodsHidden={!!sub.hide_products}
                                    image={sub.image || undefined}
                                    left={
                                      <CaretButton
                                        open={openSub}
                                        onClick={() => toggle(sub.id)}
                                      />
                                    }
                                    right={
                                      <div className="flex items-center gap-1.5">
                                        <ActionButton
                                          label="تعديل"
                                          icon={<Pencil size={14} />}
                                          onClick={() =>
                                            startEdit(sub.id, sub.name)
                                          }
                                        />
                                        <ActionButton
                                          label="فرع فرعي"
                                          icon={<Plus size={14} />}
                                          onClick={() => onAdd("seg", sub.id)}
                                        />
                                        <ActionButton
                                          label="صورة"
                                          icon={<ImageIcon size={14} />}
                                          onClick={() =>
                                            openImageModal(
                                              sub.id,
                                              sub.image,
                                              sub.image_alt
                                            )
                                          }
                                        />
                                        <MoreMenu
                                          taxonId={sub.id}
                                          status={sub.status ?? "active"}
                                          hideProducts={!!sub.hide_products}
                                          onAction={(a, id) =>
                                            handleMenuAction(a, id, {
                                              status: sub.status,
                                              hide_products:
                                                !!sub.hide_products,
                                              image: sub.image ?? null,
                                              image_alt: sub.image_alt ?? null,
                                            })
                                          }
                                        />
                                      </div>
                                    }
                                    muted={activeId === sub.id}
                                  />
                                </SortableItem>

                                {openSub && (
                                  <LevelBlock
                                    containerId={cid("seg", sub.id)}
                                    highlight={
                                      overContainer === cid("seg", sub.id)
                                    }
                                  >
                                    <SortableContext
                                      items={idsOf(sub.children ?? [])}
                                      strategy={verticalListSortingStrategy}
                                    >
                                      <ul className="space-y-2">
                                        {(sub.children ?? []).map((seg) => (
                                          <li key={seg.id}>
                                            <SortableItem id={seg.id}>
                                              <Row
                                                id={seg.id}
                                                title={seg.name}
                                                hidden={seg.status === "hidden"}
                                                prodsHidden={
                                                  !!seg.hide_products
                                                }
                                                image={seg.image || undefined}
                                                right={
                                                  <div className="flex items-center gap-1.5">
                                                    <ActionButton
                                                      label="تعديل"
                                                      icon={
                                                        <Pencil size={14} />
                                                      }
                                                      onClick={() =>
                                                        startEdit(
                                                          seg.id,
                                                          seg.name
                                                        )
                                                      }
                                                    />
                                                    <ActionButton
                                                      label="صورة"
                                                      icon={
                                                        <ImageIcon size={14} />
                                                      }
                                                      onClick={() =>
                                                        openImageModal(
                                                          seg.id,
                                                          seg.image,
                                                          seg.image_alt
                                                        )
                                                      }
                                                    />
                                                    <MoreMenu
                                                      taxonId={seg.id}
                                                      status={
                                                        seg.status ?? "active"
                                                      }
                                                      hideProducts={
                                                        !!seg.hide_products
                                                      }
                                                      onAction={(a, id) =>
                                                        handleMenuAction(
                                                          a,
                                                          id,
                                                          {
                                                            status: seg.status,
                                                            hide_products:
                                                              !!seg.hide_products,
                                                            image:
                                                              seg.image ?? null,
                                                            image_alt:
                                                              seg.image_alt ??
                                                              null,
                                                          }
                                                        )
                                                      }
                                                    />
                                                  </div>
                                                }
                                                muted={activeId === seg.id}
                                              />
                                            </SortableItem>
                                          </li>
                                        ))}
                                      </ul>
                                    </SortableContext>
                                  </LevelBlock>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </SortableContext>
                    </LevelBlock>
                  )}
                </li>
              );
            })}
          </ul>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeNode ? <GhostRow title={activeNode.name} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Add form */}
      {addFor && (
        <form
          onSubmit={saveNew}
          className="fixed inset-x-0 bottom-4 mx-auto w-[min(600px,95vw)] rounded-2xl border bg-white/95 backdrop-blur shadow-xl p-4"
        >
          <div className="text-sm mb-2">
            إضافة{" "}
            <b>
              {addFor.level === "root"
                ? "تصنيف رئيسي"
                : addFor.level === "sub"
                ? "تصنيف فرعي"
                : "فرع فرعي"}
            </b>
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              className="flex-1 border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="اسم التصنيف…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-2 disabled:opacity-60 active:scale-[.98]"
              disabled={savingAdd}
              title="حفظ"
            >
              {savingAdd ? <SpinnerMini /> : <></>}
              <span>{savingAdd ? "جارٍ الحفظ…" : "حفظ"}</span>
            </button>
            <button
              type="button"
              className="rounded-full border px-4 py-2 hover:bg-gray-50 active:scale-[.98]"
              onClick={() => setAddFor(null)}
            >
              إلغاء
            </button>
          </div>
          {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
        </form>
      )}

      {/* Edit name */}
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveEdit();
          }}
          className="fixed inset-x-0 bottom-24 mx-auto w-[min(600px,95vw)] rounded-2xl border bg-white/95 backdrop-blur shadow-xl p-4"
        >
          <div className="text-sm mb-2">تعديل الاسم</div>
          <div className="flex gap-2">
            <input
              autoFocus
              className="flex-1 border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <button className="inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-2 active:scale-[.98]">
              <span>حفظ</span>
            </button>
            <button
              type="button"
              className="rounded-full border px-4 py-2 hover:bg-gray-50 active:scale-[.98]"
              onClick={() => setEditing(null)}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* SEO Modal */}
      {seoFor && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30">
          <div className="w-[min(720px,95vw)] rounded-2xl border bg-white shadow-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">تحسينات SEO</h3>
              <button
                className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50 active:scale-[.98]"
                onClick={() => setSeoFor(null)}
              >
                إغلاق
              </button>
            </div>

            {seoLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <SpinnerMini />
                جارٍ التحميل…
              </div>
            ) : (
              <div className="space-y-3">
                <LabeledInput
                  label="Page Title"
                  value={seo.meta_title}
                  onChange={(v) => setSeo((s) => ({ ...s, meta_title: v }))}
                />
                <LabeledInput
                  label="Page Link (slug)"
                  value={seo.slug}
                  onChange={(v) => setSeo((s) => ({ ...s, slug: v }))}
                />
                <LabeledTextarea
                  label="Page Description"
                  value={seo.meta_description}
                  onChange={(v) =>
                    setSeo((s) => ({ ...s, meta_description: v }))
                  }
                  rows={4}
                />
                <LabeledInput
                  label="Canonical URL"
                  value={seo.canonical_url}
                  onChange={(v) => setSeo((s) => ({ ...s, canonical_url: v }))}
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    className="rounded-full border px-3 py-1.5 hover:bg-gray-50 active:scale-[.98]"
                    onClick={() => setSeoFor(null)}
                  >
                    إلغاء
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-black text-white px-3 py-1.5 active:scale-[.98]"
                    onClick={saveSeo}
                  >
                    <span>حفظ</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Modal */}
      {imgFor && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30">
          <div className="w-[min(720px,95vw)] rounded-2xl border bg-white shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">إضافة صورة للتصنيف</h3>
              <button
                className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50 active:scale-[.98]"
                onClick={() => setImgFor(null)}
              >
                إغلاق
              </button>
            </div>

            <div className="grid md:grid-cols-[220px_1fr] gap-4 items-start">
              {/* Preview */}
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-white p-2">
                  {fileObj ? (
                    <img
                      src={URL.createObjectURL(fileObj)}
                      alt="preview"
                      className="w-full h-40 object-contain"
                    />
                  ) : imgFor.current ? (
                    <img
                      src={imgFor.current}
                      alt={imgFor.alt || ""}
                      className="w-full h-40 object-contain"
                    />
                  ) : (
                    <div className="w-full h-40 grid place-items-center text-xs text-gray-500">
                      لا توجد صورة حالية
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 p-2 border-t bg-gray-50">
                  <label className="inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-full border bg-white cursor-pointer active:scale-[.98]">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => setFileObj(e.target.files?.[0] ?? null)}
                    />
                    <span>📁</span> استبدال
                  </label>
                  {!!imgFor.current && (
                    <button
                      className="inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-full border text-red-600 hover:bg-red-50 active:scale-[.98]"
                      onClick={deleteImage}
                      disabled={imgDeleting}
                      title="حذف الصورة"
                    >
                      {imgDeleting ? <SpinnerMini /> : <Trash2 size={14} />}
                      <span>{imgDeleting ? "جارٍ الحذف…" : "حذف"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Side fields */}
              <div className="space-y-3">
                <label className="block">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs">النص البديل (ALT)</span>
                    <span className="text-[10px] text-gray-500">
                      {imgAlt.length} / 70
                    </span>
                  </div>
                  <input
                    maxLength={70}
                    className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={imgAlt}
                    onChange={(e) => setImgAlt(e.target.value)}
                  />
                </label>

                {imgFor.current && (
                  <div className="text-[11px] text-gray-500 break-all">
                    <span className="opacity-70">المسار الحالي:</span>{" "}
                    <code>{imgFor.current}</code>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  {!fileObj && (
                    <button
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 hover:bg-gray-50 active:scale-[.98]"
                      onClick={saveAltOnly}
                      disabled={imgAltSaving}
                    >
                      {imgAltSaving ? <SpinnerMini /> : <></>}
                      <span>{imgAltSaving ? "جارٍ الحفظ…" : "حفظ ALT"}</span>
                    </button>
                  )}
                  <button
                    className="rounded-full border px-3 py-1.5 hover:bg-gray-50 active:scale-[.98]"
                    onClick={() => setImgFor(null)}
                  >
                    إلغاء
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-black text-white px-3 py-1.5 disabled:opacity-60 active:scale-[.98]"
                    disabled={!fileObj || imgSaving}
                    onClick={saveImage}
                  >
                    {imgSaving ? <SpinnerMini /> : <></>}
                    <span>{imgSaving ? "جارٍ الرفع…" : "حفظ"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== UI components ===================== */

function DraftBar({
  count,
  saving,
  onSave,
  onDiscard,
}: {
  count: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!count) return null;
  return (
    <div className="sticky top-2 z-50">
      <div className="mx-auto w-full rounded-2xl border bg-white shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-sm">
          لديك{" "}
          <b className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
            {count}
          </b>{" "}
          تغييرات غير محفوظة
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton label="تراجع" onClick={onDiscard} variant="ghost" />
          <button
            disabled={saving}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-full bg-black text-white px-3 py-1.5 text-sm active:scale-[.98] disabled:opacity-60"
          >
            {saving ? <SpinnerMini /> : <></>}
            <span>{saving ? "جارٍ الحفظ…" : "حفظ"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function LevelBlock({
  containerId,
  highlight,
  children,
}: {
  containerId: string;
  highlight: boolean;
  children: any;
}) {
  return (
    <div className="relative ms-8">
      <div
        id={containerId}
        data-droppable
        className={`rounded-md border border-dashed my-1 transition ${
          highlight ? "border-blue-400 bg-blue-50/40" : "border-transparent"
        }`}
      />
      {children}
    </div>
  );
}

function CaretButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center w-7 h-7 rounded-full border bg-white hover:bg-gray-50 active:scale-[.98] transition"
      title={open ? "طيّ" : "فتح"}
    >
      <ChevronDown
        size={16}
        className={`transition-transform duration-200 ${
          open ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

function GhostRow({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-lg opacity-90">
      {title}
    </div>
  );
}

function Row({
  id,
  title,
  left,
  right,
  muted,
  hidden,
  prodsHidden,
  image,
}: {
  id: string;
  title: string;
  left?: any;
  right?: any;
  muted?: boolean;
  hidden?: boolean;
  prodsHidden?: boolean;
  image?: string;
}) {
  return (
    <div data-row-id={id} className="relative">
      <div
        className={`flex items-center justify-between rounded-2xl bg-white px-3 py-2 border transition ${
          muted ? "border-blue-300 bg-blue-50/40" : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {left}
          <div className="truncate flex items-center gap-2">
            {hidden && (
              <BadgeIcon title="التصنيف مخفي">
                <EyeOff size={14} />
              </BadgeIcon>
            )}
            {prodsHidden && (
              <BadgeIcon title="منتجات التصنيف مخفية">
                <FolderMinus size={14} />
              </BadgeIcon>
            )}
            {image && (
              <img
                src={image}
                alt=""
                className="h-6 w-6 object-cover rounded-lg border"
              />
            )}
            <span className="truncate">{title}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">{right}</div>
      </div>
    </div>
  );
}

/* ====== Tiny UI atoms ====== */

function BadgeIcon({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className="inline-grid place-items-center w-6 h-6 rounded-full border border-gray-300 text-gray-600 bg-white"
    >
      {children}
    </span>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs bg-white hover:bg-gray-50 active:scale-[.98] shadow-sm"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function IconButton({
  label,
  onClick,
  variant = "ghost",
}: {
  label: string;
  onClick: () => void;
  variant?: "ghost" | "primary";
}) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm active:scale-[.98] transition";
  const styles =
    variant === "primary"
      ? "bg-black text-white shadow-sm"
      : "border bg-white hover:bg-gray-50";
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {label}
    </button>
  );
}

/* ===== More Menu ===== */
function MoreMenu({
  taxonId,
  status,
  hideProducts,
  onAction,
}: {
  taxonId: string;
  status: "active" | "hidden";
  hideProducts: boolean;
  onAction: (
    action:
      | "add-sub"
      | "toggle-hide"
      | "toggle-hide-products"
      | "seo"
      | "delete",
    id: string
  ) => void;
}) {
  const isHidden = status === "hidden";
  const prodsHidden = hideProducts;

  return (
    <div className="relative">
      <details className="group relative">
        <summary
          className="list-none cursor-pointer inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 bg-white hover:bg-gray-50 active:scale-[.98]"
          title="إعدادات التصنيف"
        >
          <MoreHorizontal size={16} />
        </summary>

        <ul
          className="absolute z-[60] mt-2 w-56 end-0 rounded-2xl border bg-white shadow-xl p-1 text-sm overflow-hidden"
          role="menu"
        >
          <MenuItem
            onClick={() => onAction("add-sub", taxonId)}
            icon={<Plus size={15} />}
          >
            إضافة تصنيف فرعي
          </MenuItem>

          <MenuItem
            onClick={() => onAction("toggle-hide", taxonId)}
            icon={isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
          >
            {isHidden ? "إظهار التصنيف" : "إخفاء التصنيف"}
          </MenuItem>

          <MenuItem
            onClick={() => onAction("toggle-hide-products", taxonId)}
            icon={<FolderMinus size={15} />}
          >
            {prodsHidden ? "إظهار منتجات التصنيف" : "إخفاء منتجات التصنيف"}
          </MenuItem>

          <MenuItem
            onClick={() => onAction("seo", taxonId)}
            icon={<Settings size={15} />}
          >
            تحسينات SEO
          </MenuItem>

          <li className="my-1 border-t" />

          <MenuItem
            onClick={() => onAction("delete", taxonId)}
            icon={<Trash2 size={15} />}
            danger
          >
            حذف (أرشفة)
          </MenuItem>
        </ul>
      </details>
    </div>
  );
}

function MenuItem({
  children,
  icon,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <li>
      <button
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition active:scale-[.99] ${
          danger ? "text-red-600 hover:bg-red-50" : "hover:bg-gray-50"
        }`}
        onClick={onClick}
        role="menuitem"
      >
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
          {icon}
        </span>
        <span className="text-sm">{children}</span>
      </button>
    </li>
  );
}

/* ===== Small inputs ===== */
function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs mb-1">{label}</span>
      <input
        className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-xs mb-1">{label}</span>
      <textarea
        className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/* ====== Loading Bits (خفيفة وجيل زد) ====== */
function SpinnerMini() {
  // SVG خفيف مع animate-spin — ما يثقل أي شيء
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 animate-spin"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/** ✅ لودينغ مركزي (جيل زد) — وسط الصفحة، خفيف جداً */
function CenterLoader({ text = "جارٍ الحفظ…" }: { text?: string }) {
  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/20 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      <div className="pointer-events-none select-none">
        <div className="mx-auto flex items-center gap-3 rounded-2xl border border-white/20 bg-white/80 shadow-lg px-4 py-2">
          {/* رينغ أنيق */}
          <div className="relative w-6 h-6">
            <span className="absolute inset-0 rounded-full border-2 border-black/20" />
            <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-black animate-spin" />
          </div>
          <span className="text-sm font-medium text-gray-800">{text}</span>
        </div>
      </div>
    </div>
  );
}

/* ❌ تم الاستغناء عن SavingCloud (كان في الركن) — لا تستخدمه الآن */
// function SavingCloud({ text }: { text: string }) {
//   return (
//     <div className="pointer-events-none fixed right-4 top-16 z-[70]">
//       <div className="inline-flex items-center gap-2 rounded-full bg-black text-white text-xs px-3 py-1.5 shadow-sm">
//         <SpinnerMini />
//         <span>{text}</span>
//       </div>
//     </div>
//   );
// }

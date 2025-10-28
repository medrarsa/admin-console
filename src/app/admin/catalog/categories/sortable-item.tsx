"use client";
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 w-9 grid place-items-center rounded-md border border-gray-200 bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing"
          aria-label="سحب"
        >
          <GripVertical className="opacity-70" size={18} />
        </button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

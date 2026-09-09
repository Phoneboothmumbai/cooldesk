export const TYPE_LABELS = {
  installation: "Installation",
  repair: "Repair",
  service: "Service",
};

export const STATUS_META = {
  open: { label: "Open", cls: "bg-[#EEF2FF] text-[#002FA7] border-[#C7D2FE]" },
  in_progress: { label: "In Progress", cls: "bg-[#FFF7E6] text-[#B45309] border-[#FDE68A]" },
  resolved: { label: "Resolved", cls: "bg-[#E7F6F3] text-[#1E7168] border-[#A7E0D6]" },
  closed: { label: "Closed", cls: "bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]" },
};

export const PRIORITY_META = {
  low: { label: "Low", cls: "bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]" },
  normal: { label: "Normal", cls: "bg-[#EEF2FF] text-[#002FA7] border-[#C7D2FE]" },
  high: { label: "High", cls: "bg-[#FFF7E6] text-[#B45309] border-[#FDE68A]" },
  urgent: { label: "Urgent", cls: "bg-[#FDECEE] text-[#E63946] border-[#F9C6CC]" },
};

export const Pill = ({ meta, testid }) => (
  <span
    data-testid={testid}
    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${meta?.cls || ""}`}
  >
    {meta?.label || "-"}
  </span>
);

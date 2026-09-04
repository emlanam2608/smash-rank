import { LoaderCircle } from "lucide-react";

export function LoadingIndicator({ label, className = "" }: { label: string; className?: string }) {
  return <p role="status" className={`flex items-center justify-center gap-2 text-center text-sm text-slate-400 ${className}`}><LoaderCircle className="h-4 w-4 animate-spin text-emerald-300" />{label}</p>;
}

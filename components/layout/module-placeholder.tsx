type ModulePlaceholderProps = {
  title: string;
  description: string;
};

export function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
      <p className="mt-4 text-xs text-slate-500">
        Módulo previsto na especificação — implementação incremental por fase.
      </p>
    </div>
  );
}

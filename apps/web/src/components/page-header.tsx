export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {eyebrow && <span className="text-sm font-normal text-primary">{eyebrow}</span>}
      <h1 className="text-[26px] leading-[1.12] font-light tracking-[-0.26px]">{title}</h1>
      {children}
    </div>
  )
}

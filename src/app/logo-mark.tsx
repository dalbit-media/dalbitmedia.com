type LogoMarkProps = {
  className?: string;
};

export function LogoMark({ className = "" }: LogoMarkProps) {
  return (
    <svg className={`brand-mark ${className}`.trim()} viewBox="0 0 32 32" aria-hidden="true">
      <circle className="brand-mark-background" cx="16" cy="16" r="15" />
      <path className="brand-mark-moon" d="M16 6a10 10 0 0 1 0 20Z" transform="rotate(18 16 16)" />
    </svg>
  );
}
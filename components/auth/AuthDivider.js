'use client';
export default function AuthDivider() {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-highlight" />
      <span className="text-muted text-sm">or</span>
      <div className="flex-1 h-px bg-highlight" />
    </div>
  );
}

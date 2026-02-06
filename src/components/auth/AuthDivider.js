export default function AuthDivider() {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-white/40 text-sm">or</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

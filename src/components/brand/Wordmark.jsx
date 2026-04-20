export default function Wordmark({ className = '', size = 20 }) {
  return (
    <div
      className={className}
      style={{
        fontSize: size,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: 'var(--text-primary)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <span style={{ fontWeight: 300, color: 'var(--text-muted)' }}>my</span>
      <span style={{ color: 'var(--amber)' }}>setlists</span>
    </div>
  );
}

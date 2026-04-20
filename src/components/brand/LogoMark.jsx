import Pick from './Pick';
import Wordmark from './Wordmark';

export default function LogoMark({ className = '', onClick, pickSize = 28 }) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: onClick ? 'pointer' : 'default', textDecoration: 'none' }}
    >
      <Pick width={pickSize} height={Math.round(pickSize * 1.14)} />
      <Wordmark size={20} />
    </div>
  );
}

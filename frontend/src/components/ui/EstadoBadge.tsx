import { EstadoPedido } from '../../types';
import { estadoLabel, estadoColor } from '../../utils/format';
import { clsx } from 'clsx';

export function EstadoBadge({ estado }: { estado: EstadoPedido }) {
  return (
    <span className={clsx('badge-estado', estadoColor[estado])}>
      {estadoLabel[estado]}
    </span>
  );
}

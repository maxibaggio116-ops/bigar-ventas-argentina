import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { api } from '../../utils/api';

interface Props { open: boolean; onClose: () => void; }

export function CambiarPasswordModal({ open, onClose }: Props) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [saving, setSaving] = useState(false);

  const cerrar = () => { setActual(''); setNueva(''); setRepetir(''); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva.length < 6) return toast.error('La nueva contraseña debe tener al menos 6 caracteres');
    if (nueva !== repetir) return toast.error('Las contraseñas nuevas no coinciden');
    setSaving(true);
    try {
      await api.put('/auth/change-password', { currentPassword: actual, newPassword: nueva });
      toast.success('Contraseña actualizada');
      cerrar();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={cerrar} title="Cambiar contraseña" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
          <input type="password" className="input" autoComplete="current-password" required
            value={actual} onChange={e => setActual(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
          <input type="password" className="input" autoComplete="new-password" required
            value={nueva} onChange={e => setNueva(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Repetir nueva contraseña</label>
          <input type="password" className="input" autoComplete="new-password" required
            value={repetir} onChange={e => setRepetir(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={cerrar} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

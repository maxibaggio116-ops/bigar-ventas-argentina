import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR]', err?.message || err);
  if (err?.code === 'P2002') {
    const field = err?.meta?.target?.[0] || 'campo';
    return res.status(400).json({ error: `Ya existe un registro con ese ${field}` });
  }
  if (err?.code === 'P2025') return res.status(404).json({ error: 'Registro no encontrado' });
  if (err?.code === 'P2003') return res.status(400).json({ error: 'Referencia inválida' });
  res.status(err?.status || 500).json({ error: err?.message || 'Error interno del servidor' });
};

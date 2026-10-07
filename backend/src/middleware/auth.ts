import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; rol: string; nombre: string };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.activo) return res.status(401).json({ error: 'Usuario no autorizado' });
    req.user = { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.rol !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  next();
};

export const requireVendedor = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!['ADMIN', 'VENDEDOR'].includes(req.user?.rol || ''))
    return res.status(403).json({ error: 'Acceso denegado' });
  next();
};

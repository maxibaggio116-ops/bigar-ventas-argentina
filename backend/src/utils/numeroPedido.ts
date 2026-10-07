import { prisma } from './prisma';

export async function generarNumeroPedido(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.pedido.count();
  return `PED-${year}-${String(count + 1).padStart(5, '0')}`;
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../auth/types/auth-user.type';

/**
 * Verifies the requesting user owns the order at :id, or is WAITER / ADMIN.
 * Attaches the raw order to request.order for downstream use.
 * Must be applied AFTER JwtAuthGuard so req.user is populated.
 */
@Injectable()
export class OrderAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser;
    const orderId: string | undefined = req.params?.id;

    if (!orderId) return true;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) throw new NotFoundException('Order not found');

    // Staff can access any order
    if (user.role === 'ADMIN' || user.role === 'WAITER') {
      req.order = order;
      return true;
    }

    if (order.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this order');
    }

    req.order = order;
    return true;
  }
}

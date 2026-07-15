import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe = require('stripe');
import { User } from '../../../auth/domain/entities/user.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  private getStripe(): Stripe | null {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    // This feature is intentionally test-only. Never allow a live key here.
    if (!secretKey?.startsWith('sk_test_')) return null;
    return new Stripe(secretKey);
  }

  private requireConfiguration(): { stripe: Stripe; priceId: string } {
    const stripe = this.getStripe();
    const priceId = process.env.STRIPE_PRICE_ID?.trim();
    if (!stripe || !priceId) {
      throw new ServiceUnavailableException(
        'Stripe test mode is not configured. Set STRIPE_SECRET_KEY to an sk_test_ key and STRIPE_PRICE_ID to a recurring test Price ID.',
      );
    }
    return { stripe, priceId };
  }

  async getStatus(userId: string, sessionId?: string) {
    const stripe = this.getStripe();
    const priceId = process.env.STRIPE_PRICE_ID?.trim();
    if (!stripe || !priceId) {
      return { configured: false, status: 'inactive', plan: null };
    }

    let price: Stripe.Price;
    try {
      price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    } catch {
      return { configured: false, status: 'inactive', plan: null };
    }

    const productName = typeof price.product !== 'string' && 'name' in price.product
      ? price.product.name
      : null;
    const plan = {
      name: process.env.STRIPE_PLAN_NAME?.trim() || productName || 'Cinely Pro',
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
    };

    const inactiveStatus = { configured: true, status: 'inactive', plan };
    if (!sessionId) return inactiveStatus;

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });
    } catch {
      // A browser may retain an expired/deleted test Session ID. It should not
      // prevent the current user from viewing the configured subscription plan.
      return inactiveStatus;
    }

    if (session.client_reference_id !== userId || session.metadata?.userId !== userId) {
      // sessionStorage is shared by logins on this origin. Ignore a Checkout
      // Session created by a previously signed-in account without leaking it.
      return inactiveStatus;
    }

    const subscription = typeof session.subscription === 'string' ? null : session.subscription;
    return {
      configured: true,
      status: subscription?.status ?? (session.payment_status === 'paid' ? 'active' : 'inactive'),
      plan,
      customerEmail: session.customer_details?.email ?? null,
    };
  }

  async createCheckoutSession(userId: string) {
    const { stripe, priceId } = this.requireConfiguration();
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: user.email,
        client_reference_id: user.id,
        metadata: { userId: user.id },
        subscription_data: { metadata: { userId: user.id } },
        success_url: `${frontendUrl}/settings?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/settings?subscription=canceled`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create Stripe Checkout Session';
      throw new BadRequestException(message);
    }

    if (!session.url) throw new BadRequestException('Stripe did not return a Checkout URL');
    return { url: session.url };
  }
}

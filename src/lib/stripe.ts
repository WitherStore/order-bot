import {z} from "zod";
import {Stripe} from "stripe";

const schema = z.object({
    STRIPE_PUB_KEY: z.string().regex(/pk_(live|test)_[0-9a-zA-Z]{99}/),
    STRIPE_SEC_KEY: z.string().regex(/sk_(live|test)_[0-9a-zA-Z]{99}/),
});

export async function createStripeClient() {
    const env = await schema.parseAsync(process.env);
    const stripe = new Stripe(env.STRIPE_SEC_KEY);

    if (!stripe) {
        throw new Error('Failed to create Stripe client');
    }

    return stripe;
}
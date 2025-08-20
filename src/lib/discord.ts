import {Client} from "discord.js";
import {z} from "zod";

const schema = z.object({
    CLIENT_ID: z.string().regex(/[0-9]{19}/),
    CLIENT_SECRET: z.string().regex(/R_[a-zA-Z0-9]{30}/),
    BOT_TOKEN: z.string(),
});

export async function createDiscordClient(init?: (client: Client<false>, env: z.Infer<typeof schema>) => Promise<void>) {
    const env = await schema.parseAsync(process.env);
    const client = new Client({intents: ['Guilds']});

    if (!client) {
        throw new Error('Failed to create Discord client');
    }

    void await init?.(client as Client<false>, env);
    void await client.login(env.BOT_TOKEN);

    return client as Client<true>;
}
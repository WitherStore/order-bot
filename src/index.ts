import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle, type CategoryChannel,
    ChannelType,
    Client,
    Colors,
    EmbedBuilder,
    MessageFlagsBitField,
    type ModalActionRowComponentBuilder,
    ModalBuilder,
    PermissionsBitField,
    SelectMenuBuilder,
    SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, type TextChannel,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";

import {createDiscordClient} from "@/lib/discord";
import {createStripeClient} from "@/lib/stripe";

import "source-map-support/register.js";
import * as crypto from "node:crypto";
import * as console from "node:console";

async function main() {
    const client = await createDiscordClient();
    const stripe = await createStripeClient();

    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);

        const guilds = client.guilds.cache.values();

        for (const guild of guilds) {
            void await guild.commands.set([
                new SlashCommandBuilder()
                    .setName('order')
                    .setDescription('Make an order')
                    .setDefaultMemberPermissions(PermissionsBitField.Default)
                    .toJSON(),
                new SlashCommandBuilder()
                    .setName('payment')
                    .setDescription('Generates payment url')
                    .setDefaultMemberPermissions(BigInt(8))
                    .addStringOption(o => o
                        .setName('item')
                        .setDescription('Item to pay for')
                        .setRequired(true))
                    .addNumberOption(o => o
                        .setName('amount')
                        .setDescription('Amount to pay (in USD). Must be greater than $0.58 to account for transaction fees.')
                        .setMinValue(0.58)
                        .setMaxValue(10_000.0)
                        .setRequired(true)).toJSON()
            ])
        }
    });

    client.on('interactionCreate', async (i) => {
        if (i.isButton() && i.customId.startsWith('order_svc_')) {
            // switch (i.customId.split('_')[1]) {
            //     case 'website':
            //         break;
            //     case 'discord':
            //         break;
            //     case 'plugins':
            //         break;
            //     case 'thumbnail':
            //         break;
            //     case 'editing':
            //         break;
            // }

            const kind = i.customId.split('_')[2]!;

            await i.showModal(new ModalBuilder()
                .setCustomId(`order_modal_${kind.toLowerCase()}`)
                .setTitle(`Order: ${kind.charAt(0).toUpperCase() + kind.slice(1)}`)
                .addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents([
                        new TextInputBuilder()
                            .setCustomId('budget')
                            .setLabel('Budget (in USD):')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setPlaceholder('25')
                            .setMinLength(1)
                            .setMaxLength(6)
                    ]),
                    new ActionRowBuilder<TextInputBuilder>().addComponents([
                        new TextInputBuilder()
                            .setCustomId('description')
                            .setLabel('Description:')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                            .setMinLength(10)
                            .setMaxLength(4000)
                    ]),
                    new ActionRowBuilder<TextInputBuilder>().addComponents([
                        new TextInputBuilder()
                            .setCustomId('extra_info')
                            .setLabel('Extra Information (Style, Tech-stack, etc):')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(false)
                    ])
                ))
        }

        if (i.isCommand() && i.commandName === "order") {
            await i.reply({
                flags: ['Ephemeral'],
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('order_svc_website')
                            .setLabel('Web Development')
                            .setEmoji('🌐')
                            .setStyle(ButtonStyle.Secondary)
                    ),
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('order_svc_discord')
                            .setLabel('Discord Server Management')
                            .setEmoji('💬')
                            .setStyle(ButtonStyle.Secondary)
                    ),
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('order_svc_plugins')
                            .setLabel('Plugin Development')
                            .setEmoji('🔌')
                            .setStyle(ButtonStyle.Secondary)
                    ),
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('order_svc_thumbnail')
                            .setLabel('Thumbnail Creation')
                            .setEmoji('🖼')
                            .setStyle(ButtonStyle.Secondary)
                    ),
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('order_svc_editing')
                            .setLabel('Video Editing')
                            .setEmoji('✏️')
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            })
        }

        if (i.isModalSubmit() && i.customId.startsWith('order_modal_') && i.inGuild()) {
            const category = i.guild!.channels.cache.find(c =>
                c.type === ChannelType.GuildCategory &&
                c.name.toLowerCase().includes('order') && c.name.toLowerCase().includes(i.customId.split('_')[2]!.toLowerCase()));

            if (!category) {
                return void i.reply({
                    flags: ['Ephemeral'],
                    content: 'Failed to create order. Please try again later.'
                })
            }

            const orderId = crypto.randomInt(1, 10_000).toString().padStart(4, '0');
            const channel = await i.guild!.channels.create({
                name: `order-${orderId}`,
                type: ChannelType.GuildText,
                parent: category! as CategoryChannel,
                permissionOverwrites: [
                    {id: i.guild!.roles.everyone.id, deny: ['ViewChannel']},
                    {
                        id: i.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'ReadMessageHistory']
                    }
                ]
            })

            void await i.reply({
                flags: ['Ephemeral'],
                content: `Your order request has been created. You can view your order at <#${channel.id}>.`
            });

            const kind = i.customId.split('_')[2]!;
            const orderLogChannel = i.guild!.channels.resolve("1407479207193346219")! as TextChannel;
            void await orderLogChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`🔔 New Order — ${kind.charAt(0).toUpperCase() + kind.substring(1)} — ${orderId}`)
                        .setColor(Colors.Blurple)
                        .setTimestamp()
                        .setDescription(`<@${i.user?.id}> has placed an order.`)
                        .setURL(channel.url)
                        .setThumbnail(i.user.avatarURL())
                        .setFields([
                            { name: 'Status: ', value: 'Unclaimed', inline: false },
                            { name: 'Budget (in USD): ', value: Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(i.fields.getTextInputValue('budget'))), inline: false },
                            { name: 'Description: ', value: i.fields.getTextInputValue('description'), inline: false }
                        ])
                ],
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents([
                        new ButtonBuilder()
                            .setCustomId('ol_claim')
                            .setLabel('Claim')
                            .setEmoji('✅')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('ol_negotiate')
                            .setLabel('Negotiate')
                            .setEmoji('🤝')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('ol_more_info')
                            .setLabel('More Information')
                            .setEmoji('ℹ️')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('ol_delete')
                            .setLabel('Delete')
                            .setEmoji('🗑️')
                            .setStyle(ButtonStyle.Danger)
                    ])
                ]
            })

            void await channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Order Request')
                        .setColor(Colors.Blurple)
                        .setFields([
                            {
                                name: 'Customer',
                                value: `<@${i.user?.id}>`,
                                inline: false
                            },
                            {
                                name: 'Budget',
                                value: `$${parseFloat(i.fields.getTextInputValue('budget'))?.toFixed(2)} USD`,
                                inline: false
                            },
                            {
                                name: 'Description',
                                value: i.fields.getTextInputValue('description'),
                                inline: false
                            },
                            {
                                name: 'Additional Information',
                                value: (i.fields.getTextInputValue('extra_info').length === 0 ? '*No additional information provided*' : i.fields.getTextInputValue('extra_info')),
                                inline: false
                            },
                            {name: '⎯⎯⎯', value: ''},
                            {
                                name: 'Designated Freelancer: ',
                                value: 'N/A',
                                inline: true
                            },
                            {
                                name: 'Quoted Price: ',
                                value: 'N/A',
                                inline: true
                            }
                        ])
                        .setTimestamp()
                ],
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('or_pay')
                            .setLabel('Pay')
                            .setEmoji('💳')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('or_close')
                            .setLabel('Close')
                            .setEmoji('❌')
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            })
        }

        if (i.isChatInputCommand() && i.inGuild() && i.commandName === "payment") {
            try {
                const item = i.options.getString('item', true);
                const amount = i.options.getNumber('amount', true);

                await i.reply({content: 'Generating payment url...', flags: ['Ephemeral']});

                const m = await i.channel!.send({
                    embeds: [{
                        title: 'Payment Request',
                        color: Colors.Yellow,
                        fields: [{name: 'Item', value: item}, {
                            name: 'Amount (in USD)',
                            value: Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(amount)
                        }],
                    }]
                });

                const getMessageUrl = (message: typeof m) => {
                    const guildId = message.guild ? message.guild.id : '@me';
                    return `https://discord.com/channels/${guildId}/${message.channel.id}/${message.id}`;
                };

                try {
                    const session = await stripe.checkout.sessions.create({
                        mode: 'payment',
                        metadata: {
                            discord_channel_id: m.channel.id,
                            discord_message_id: m.id,
                        },
                        line_items: [{
                            quantity: 1,
                            price_data: {
                                currency: 'usd',
                                product_data: {
                                    name: item
                                },
                                unit_amount: Math.round(amount * 100)
                            }
                        }],
                        success_url: getMessageUrl(m),
                        cancel_url: getMessageUrl(m)
                    });

                    const interval = setInterval(() => {
                        (async () => {
                            const s = await stripe.checkout.sessions.retrieve(session.id);

                            if (s.payment_status === 'paid') {
                                clearInterval(interval);

                                await m.delete();
                                await i.channel!.send({
                                    embeds: [new EmbedBuilder()
                                        .setTitle('Payment Successful')
                                        .setColor(Colors.Green)
                                        .setDescription(`Thank you for your payment!`)
                                        .setTimestamp()
                                    ]
                                })
                            }
                        })();
                    }, 500);

                    setTimeout(() => clearInterval(interval), 1000 * 60 * 5);

                    const button = new ButtonBuilder()
                        .setLabel('Pay')
                        .setURL(session.url!)
                        .setStyle(ButtonStyle.Link);

                    const row = new ActionRowBuilder().addComponents(button);

                    await m.channel.send({components: [row.toJSON()]});
                } catch (err) {
                    await m.delete();

                    if (i.isRepliable() && !i.replied) {
                        await i.reply({
                            content: 'An error occurred while generating the payment.',
                            flags: ['Ephemeral']
                        });
                    } else {
                        await i.channel!.send({
                            content: 'An error occurred while generating the payment.',
                        });
                    }
                }
            } catch (err) {
                console.error('Error handling interaction:', err);
                if (i.isRepliable() && !i.replied) {
                    await i.reply({
                        content: 'An error occurred while generating the payment.',
                        flags: ['Ephemeral']
                    })
                }
            }
        }
    });
}

await main().catch((e) => {
    console.error('Fatal error in main:', e);
});
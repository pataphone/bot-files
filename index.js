require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, Events, MessageFlags } = require('discord.js');
const { DISCORD_TOKEN, API_KEY, API_URL = 'http://127.0.0.1:3000' } = process.env;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function api(path, options = {}) {
  const res = await fetch(API_URL + path, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, ...options.headers },
  });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return res.json();
}

const statuses = [
  { name: '/idea add' },
  { name: '/idea delete' },
  { name: '/idea list', },
];

client.once(Events.ClientReady, (c) => {
  console.log(`${c.user.tag} is online.`);
  setInterval(() => {
    c.user.setActivity(statuses[Math.floor(Math.random() * statuses.length)]);
  }, 10000);
});



client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'idea') return;

  try {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const entry = await api('/entries', {
        method: 'POST',
        body: JSON.stringify({
          category: interaction.options.getString('category', true),
          text: interaction.options.getString('text', true),
          author: interaction.user.username,
        }),
      });
      return interaction.editReply(`Added #${entry.id} to **${entry.category}**`);
    }

    if (sub === 'list') {
      const category = interaction.options.getString('category');
      const query = category ? `?category=${encodeURIComponent(category.toLowerCase())}&limit=10` : '?limit=10';
      const entries = await api('/entries' + query);
      if (!entries.length) return interaction.editReply('Empty.');

      const lines = entries.map((e) => {
        const text = e.text.length > 150 ? e.text.slice(0, 147) + '...' : e.text;
        return `**#${e.id}** [${e.category}] ${text}`;
      });
      return interaction.editReply(lines.join('\n'));
    }

    if (sub === 'delete') {
      const id = interaction.options.getInteger('id', true);
      await api(`/entries/${id}`, { method: 'DELETE' });
      return interaction.editReply(`Removed #${id}`);
    }
  } catch (error) {
    console.error(error);
    const msg = 'API error';
    if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
    else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

client.login(DISCORD_TOKEN);

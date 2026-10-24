require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const { DISCORD_TOKEN, APP_ID, GUILD_ID } = process.env;

const idea = new SlashCommandBuilder()
  .setName('idea')
  .setDescription('Collection of ideas')
  .addSubcommand((s) =>
    s
      .setName('add')
      .setDescription('add an idea')
      .addStringOption((o) => o.setName('category').setDescription('of the idea').setRequired(true))
      .addStringOption((o) => o.setName('text').setDescription('of the idea').setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName('list')
      .setDescription('of last actions')
      .addStringOption((o) => o.setName('category').setDescription('Filter by category'))
  )
  .addSubcommand((s) =>
    s
      .setName('delete')
      .setDescription('Delete idea (ID)')
      .addIntegerOption((o) => o.setName('id').setDescription('idea ID').setRequired(true))
  );

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: [idea.toJSON()] });
    console.log('Slash commands were registered successfully!');
  } catch (error) {
    console.error('There was an error:', error);
  }
})();

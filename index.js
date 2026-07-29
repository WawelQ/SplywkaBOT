// Initialization of libraries
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
} = require('discord.js');

// Loading the configuration file
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Helper function for timestamped logging
function log(message) {
  const logMessage = `[${new Date().toLocaleString()}] ${message}`;
  console.log(logMessage);
}

// Logging bot startup with exact time bot started
console.log(`[---------- ${new Date().toLocaleString()} ----------]`);

// Function that validates if necessary variables are in configuration file config.json before the bot even starts
function validateConfig() {
  // Variable that stores anything that's missing
  const missingVariables = [];
  // Small function that pushes anything sent to it into missingVariables
  const pushMissing = (path) => missingVariables.push(path);
  // Another helper function that returns true when passed variable is an empty string
  const isMissing = (variable) => variable === '';

  // Verification section
  const { channelId, roleId } = config.verification;
  if (isMissing(channelId)) pushMissing('verification.channelId');
  if (isMissing(roleId)) pushMissing('verification.roleId');

  // Reaction-role section
  {
  const { channelId, embedColor, messageTitle } = config.reactionRole;
  if (isMissing(channelId)) pushMissing('reactionRole.channelId');
  if (isMissing(embedColor)) pushMissing('reactionRole.embedColor');
  if (isMissing(messageTitle)) pushMissing('reactionRole.messageTitle');
  }

  // Roles section it's more complicated because user can define how many roles should be supported
  const rolesCount = config.roles?.length ?? 0; // Checks how many role entries there are
  for (let i = 0; i < rolesCount; i++) {
    const role = config.roles[i];
    const { description, emoji, roleId } = role;

    // For every role entry it checks every variable because none of them can be empty
    if (isMissing(description)) pushMissing(`roles[${i}].description`);
    if (isMissing(emoji)) pushMissing(`roles[${i}].emoji`);
    if (isMissing(roleId)) pushMissing(`roles[${i}].roleId`);
  }

  if (missingVariables.length > 0) {
    for (const path of missingVariables) {
      // If at least one variable is missing it stops the program and logs which values are incorrect
      log(`${path} is missing in the config.json file`);
    }
    throw new Error('Required variables are not declared in config.json file');
  }
}

// Temporary line so program will print current config that it's using (I will later remove this it's just for testing)
log(`Currnet configuration file:\n${JSON.stringify(config, null, 2)}`);

// Saving config.json file function
function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Configuration of Discord bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
  ],
});

// Checks the config before bot startup
validateConfig();

// Function that runs once client is ready
client.once('clientReady', async () => {
  log(`Logged in as ${client.user.tag}`);
  await reactionRoleMessage();
});

// Sends the reaction-role message if it hasn't been sent yet
async function reactionRoleMessage() {
  // Loading channelId and messageId from config file
  const { channelId, messageId } = config.reactionRole;
  log(`Reaction-role channelId: ${channelId}`);
  log(`Reaction-role messageId: ${messageId}`);

  // Looking if such a channel with channelId even exists if yes it returns it's channelId
  // If it doesn't exist it throws an error
  let channel // Declaring the channel before try catch block because this variable is used later for fetching messages
  try {
    channel = await client.channels.fetch(channelId); // Fetching channels and looking for a channel with specific channelId
    log(`Reaction-role channel exists with channelId: ${channelId}`);
  } catch (err) {
    log(`Reaction-role channelId: ${channelId} is invalid or channel is not accessible`);
    throw err;
  }

  // If messageId has any value it checks if this message exists on the channel (it could be deleted by someone)
  if (messageId !== '') {
    try {
      await channel.messages.fetch(messageId); // Fetching specific message by its messageId 
      log(`Reaction-role message exists on channelId: ${channelId}`);
      return; // Leaves the reactionRoleMessage function and continues without sending another reaction-role message
    } catch {
      log(`Reaction-role messageId is present but the message could not be found on channelId: ${channelId}`)
      // Leaves the if statement and goes straight up to creating and sending reaction-role message
    }
  }

  const rolesCount = config.roles?.length ?? 0; // Checks how many role entries there are
  let text = ''; // Define a description variable that will be later used in embedBuilder
  for (let i = 0; i < rolesCount; i++) {
    const { description, emoji } = config.roles[i];
    // Builds the text variable so it will look cool
    text += `**${emoji} - ${description}**\n`;
  }

  log(`text in embed:\n${text}`); // Temporary log

  // Preparing a new message to be send
  const content = new EmbedBuilder()
    .setColor(config.reactionRole.embedColor)
    .setDescription(`${config.reactionRole.messageTitle}\n${text}`)

  // Sends the embed message to the channel
  const sendMessage = await channel.send({ embeds: [content] });

  // Reacting to that message with emotes
  for (const role of config.roles) {
    await sendMessage.react(role.emoji);
  }

  // Saving newly sent messageId to memory and logging everything to console
  const message = sendMessage.id;
  log(`Reaction-role message with messageId: ${message} sent to channelId: ${channelId}`);

  // Saving the messageId to config.json and saving the config.json file
  log(`Updating new Reaction-role messageId to: ${message}`)
  config.reactionRole.messageId = message;
  log(`Saving config.json file...`);
  saveConfig();
}

// Logging in to Discord as a bot essentially starting it up
client.login(process.env.TOKEN);
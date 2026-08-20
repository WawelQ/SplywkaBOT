// Initialization of libraries
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');

// Loading the configuration file
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Helper function for timestamped logging
function log(message) {
  const logMessage = `[${new Date().toLocaleString()}] ${message}`;
  console.log(logMessage);
}

// Helper function that gets the intiger value of how much role entries there are so i wouldn't use the same thing 5 times across the code
function getRolesCount() {
  // Checks how many role entries there are
  return config.roles?.length ?? 0;
}

// Helper function that fetches channel
async function fetchChannel(channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    log(`Fetched channel: ${channelId}`);
    return channel;
  } catch (err) {
    log(`Failed to fetch channel ${channelId}: ${err.message}`);
    throw err;
  }
}

// Helper function that fetches message
async function fetchMessage(channel, messageId) {
  try {
    const message = await channel.messages.fetch(messageId);
    log(`Fetched message: ${messageId}`);
    return message;
  } catch (err) {
    log(`Failed to fetch message ${messageId}: ${err.message}`);
    return null;
  }
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
  const { channelId, roleId, messageContent, buttonLabel, buttonStyle } = config.verification;
  if (isMissing(channelId)) pushMissing('verification.channelId');
  if (isMissing(roleId)) pushMissing('verification.roleId');
  if (isMissing(messageContent)) pushMissing('verification.messageContent');
  if (isMissing(buttonLabel)) pushMissing('verification.buttonLabel');
  if (isMissing(buttonStyle)) pushMissing('verification.buttonStyle');

  // Reaction-role section
  {
  const { channelId, embedColor, messageTitle } = config.reactionRole;
  if (isMissing(channelId)) pushMissing('reactionRole.channelId');
  if (isMissing(embedColor)) pushMissing('reactionRole.embedColor');
  if (isMissing(messageTitle)) pushMissing('reactionRole.messageTitle');
  }

  // Roles section it's more complicated because user can define how many roles should be supported
  for (let i = 0; i < getRolesCount(); i++) {
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
    throw new Error(`Required variables are not declared in config.json file`);
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
  await verificationMessage();
  await reactionRoleMessage();
  await ensureRoles();
});

// Sends the verification message if it hasn't been sent yet
async function verificationMessage() {
  log(`Verification message function starts`);
  const { channelId, messageId } = config.verification;
  log(`Loaded verification channelId from config file: ${channelId}`);
  log(`Loaded verification messageId from config file: ${messageId}`);

  // Saves channel object to a variable for later checking if message exist or not
  const channel = await fetchChannel(channelId);

  // Basically I copied everything that is in reactionRoleMessage because we need to do basically the same thing
  if (messageId !== '') {
    const message = await fetchMessage(channel, messageId);

    if (message) {
      log(`Verification message exists on channel: ${channelId}`);
      return;
    }
    // If there is no message then it goes to create the message
  }
  log(`Verification message doesn't exist or couldn't be found, creating a new one...`);

  // Loading necessary variables for verification message
  const { messageContent, buttonLabel, buttonStyle } = config.verification;

  // Creating the message button
  const verifyButton = new ButtonBuilder()
    .setCustomId('verify_button') // Unique identifier so later we can listen for interactions
    .setLabel(buttonLabel)
    .setStyle(buttonStyle);

  // Sort of attaching the button to that message
  const row = new ActionRowBuilder()
    .addComponents(verifyButton);
  
  // Sending the message
  const sendMessage = await channel.send({ content: messageContent, components: [row] });

  // Saving newly sent messageId to memory and logging everything to console
  const message = sendMessage.id;
  log(`Verification message with messageId: ${message} sent to channelId: ${channelId}`);

  // Saving the messageId to config.json and saving the config.json file
  log(`Updating new Verification messageId to: ${message}`);
  config.verification.messageId = message;
  log(`Saving config.json file...`);
  saveConfig();
}

// Sends the reaction-role message if it hasn't been sent yet
async function reactionRoleMessage() {
  log(`Reaction-role message function starts`);
  // Loading channelId and messageId from config file
  const { channelId, messageId } = config.reactionRole;
  log(`Loaded reaction-role channelId from config file: ${channelId}`);
  log(`Loaded reaction-role messageId from config file: ${messageId}`);

  // Getting the channel object from new helper function
  const channel = await fetchChannel(channelId);
  // If messageId has any value then check if it exists
  if (messageId !== '') {
    // Save message object to a variable
    const message = await fetchMessage(channel, messageId);

    if (message) {
      // If message exists it exits the whole function because there's no need for creating a new message
      log(`Reaction-role message exists on channel: ${channelId}`);
      return;
    }
    // After this it leaves the statement and goes straight up to creating the message
  }
  log(`Reaction-role message doesn't exist or couldn't be found, creating a new one...`);

  let text = ''; // Define a description variable that will be later used in embedBuilder
  for (let i = 0; i < getRolesCount(); i++) {
    const { description, emoji } = config.roles[i];
    // Builds the text variable so it will look cool
    text += `**${emoji} - ${description}**\n`;
  }

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
  log(`Updating new Reaction-role messageId to: ${message}`);
  config.reactionRole.messageId = message;
  log(`Saving config.json file...`);
  saveConfig();
}

// Function that ensures roles are synced for all users while the bot was inactive
async function ensureRoles() {
  log(`Checking if someone changed reaction while bot was offline`);
  const { channelId, messageId } = config.reactionRole;

  // Fetching the channel object
  const channel = await fetchChannel(channelId);
  // Fetching the message and returning if the message doesn't exist
  const message = await fetchMessage(channel, messageId);
  if (!message) { 
    log(`Reaction-role messageId is present but the message could not be found`);
    return;
  }

  await channel.guild.members.fetch();

  for (let i = 0; i < getRolesCount(); i++) {
    const { emoji, roleId } = config.roles[i];

    // Safely recieve the reaction object even if there are no reactions
    const reaction = message.reactions.cache.get(emoji);
    const reactionEmoji = reaction.emoji.name;
    const users = reaction ? await reaction.users.fetch() : new Map();

    // Store userIds who currently have active reaction in a set for fast lookup
    const reactedUserIds = new Set( users.filter(user => !user.bot).map(user => user.id) );

    // Add missing roles
    for (const userId of reactedUserIds) {
      try {
        const member = await channel.guild.members.fetch(userId);

        if (!member.roles.cache.has(roleId)) {
          log(`${member.user.username} added ${reactionEmoji} reaction while the bot was offline`);
          await handleReaction(reaction, member, true);
        }
      } catch (err) {
        console.error(`Could not fetch member with id ${userId}:`, err.message);
      }
    }

    // Remove extra roles
    const role = channel.guild.roles.cache.get(roleId);
    if (role) {
      // Loop for every user with this role
      for (const [memberId, member] of role.members) {
        if (!member.user.bot && !reactedUserIds.has(memberId)) {
          log(`${member.user.username} removed ${reactionEmoji} reaction while the bot was offline`);
          await handleReaction(reaction, member, false);
        }
      }
    }
  }
}

// Function that handles reactions and gives the corresponding roles
async function handleReaction(reaction, user, isAdding) {
  // Checks if the reaction was send fully before trying to examine it
  if (reaction.partial) {
    // Tries to refetch that reaction
    await reaction.fetch();
  }

  // If that reaction wasn't added to reaction-role message then return
  if (reaction.message.id !== config.reactionRole.messageId) return;

  // If person adding the reaction is myself (bot) then also return
  if (user.bot) return;

  // Save the added reaction to a variable
  const reactionUpdatedEmoji = reaction.emoji.name;

  // Fetch the guild member using the users id provided by messageReaction
  const member = await reaction.message.guild.members.fetch(user.id);

  // For every role entry it checks if emoji is equal to just added emoji by the user if yes then adds the corresponding role to the same user
  for (let i = 0; i < getRolesCount(); i++) {
    // Declare the emoji and roleId as let variable type to let it change for every loop cycle
    let { emoji, roleId } = config.roles[i]; 
    if (reactionUpdatedEmoji === emoji) {
      try {
        // Adds the role to the user if they are adding the reaction
        if (isAdding) {
          await member.roles.add(roleId);
          log(`Added role ${reactionUpdatedEmoji} to: ${member.user.username}`);
        }
        // If not then just remove the reaction
        else {
          await member.roles.remove(roleId);
          log(`Removed role ${reactionUpdatedEmoji} from: ${member.user.username}`);
        }
      } catch (error) {
        console.error(`Failed to ${isAdding ? 'add' : 'remove'} role ${roleId} for ${member.id}`, error.message);
      }
    }
  }
}

client.on('messageReactionAdd', (reaction, user) => {
  handleReaction(reaction, user, true).catch(console.error);
});

client.on('messageReactionRemove', (reaction, user) => {
  handleReaction(reaction, user, false).catch(console.error);
});

client.on('interactionCreate', async (interaction) => {
  // Exit immediately if the reaction is not a button
  if (!interaction.isButton()) return;

  // Check if the clicked button is the correct button
  if (interaction.customId === 'verify_button') {
    // First we defer the reply this gives a bot more time to process and respond if any hiccup would occur
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Loading variables from configuration file
    const { unverifiedRoleId, verifiedRoleId, verificationSuccess, verificationError } = config.verification;

    // Then the try catch block to remove and add roles for that specific user
    try {
      // Getting the member object out of the verification to later see who clicked that button
      const member = interaction.member;

      await member.roles.remove(unverifiedRoleId);
      await member.roles.add(verifiedRoleId);

      // Now we use editReply because the interaction is already acknowledged
      await interaction.editReply({ content: verificationSuccess });

      log(`Successfully verified user: ${member.user.username}`);
    } catch (err) {
      log(`Error occured during verification process:`, err.message);

      // Sending user a message about that error also with editReply
      await interaction.editReply({ content: verificationError });
    }
  }
});

// Function that automatically assigns unverified role for everyone who joins the server
client.on('guildMemberAdd', async (member) => {
  try {
    const { unverifiedRoleId } = config.verification;
    const unverifiedRole = member.guild.roles.cache.get(unverifiedRoleId);

    if (unverifiedRole) {
      await member.roles.add(unverifiedRole);
      log(`Unverified role was given to ${member.user.username}`);
    } else {
      log(`Unverified could not be found for user ${member.user.username}`);
    }
  } catch (err) {
    log(`Error occured while trying to assing role to ${member.user.username}`, err.message);
  }
});

// Logging in to Discord as a bot essentially starting it up
client.login(process.env.TOKEN);
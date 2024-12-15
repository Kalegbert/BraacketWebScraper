import { Client, GatewayIntentBits } from 'discord.js';
import { getPlayersList, scrapePlayerUrl, getCharacterNamesForPlayer } from './utils/scrapeUtils.js';
import { scrapePlayerLosses } from './utils/lossUtils.js';
import dotenv from 'dotenv';
import { characterEmojis } from './utils/emojiMap.js';  // Import the emoji mapping
dotenv.config();


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`${client.user.tag} is online!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.split(' ').slice(1); // Get command arguments

  try {
    if (message.content.startsWith('$ViewCurrent')) {
      // Default to showing top 15 players
      let listSize = 15;
      if (args.length > 0 && !isNaN(args[0])) {
        listSize = Math.min(Math.max(parseInt(args[0]), 1), 200); // Limit the list size to 1-200
      }
      await message.channel.send(`Fetching top ${listSize} players, please wait...\nBigger lists could take a bit`);
      await fetchAndPromptPlayers(listSize, message);
    } 
    else if (message.content.startsWith('$ViewLoss')) {
      let playerName = args.join(' ').toLowerCase();

      if (!playerName) {
        message.channel.send('Please provide a player name or rank (e.g., $ViewLoss 1 or $ViewLoss PlayerName)');
        return;
      }

      // Check if the argument is a number (rank)
      if (!isNaN(playerName)) {
        const players = await getPlayersList();
        const rank = parseInt(playerName, 10) - 1; // Convert to zero-based index
        if (rank >= 0 && rank < players.length) {
          playerName = players[rank].name;
        } else {
          message.channel.send('Invalid rank number.');
          return;
        }
      }

      await message.channel.send(`Searching for losses of ${playerName}...`);
      await fetchAndDisplayLosses(playerName, message);
    }
    else if (message.content.startsWith('$Help')) {
      message.channel.send(`
        **Available Commands:**
        **$ViewCurrent [1-200]** - View the current player rankings. Default is top 15 players.
        **$ViewLoss [PlayerName or PlayerRank]** - View the losses for a specific player by name.
      `);
    } 
    else {
      message.channel.send('Invalid command. Type `$Commands` for a list of available commands.');
    }
  } catch (error) {
    console.error(error);
    message.channel.send(`An error occurred: ${error.message}`);
  }
});

async function fetchAndPromptPlayers(listSize, message) {
  try {
    const players = await getPlayersList();
    if (players.length === 0) {
      return message.channel.send('No players found. Please try again later.');
    }

    // Display only the top 'listSize' players with their names and characters
    const displayedPlayers = players.slice(0, listSize);

    const playerList = await Promise.all(
      displayedPlayers.map(async (p, idx) => {
        // Get character names for the player
        const characterNames = await getCharacterNamesForPlayer(p.name);
        
        // Map character names to their corresponding Discord emoji IDs
        const emotes = characterNames
          .map(characterName => characterEmojis[characterName] || `No emoji found for ${characterName}`)
          .join('');

        return `${idx + 1}. ${p.name} ${emotes}`;  // Display player name with emojis
      })
    );

    // Split the list into multiple messages if it exceeds the max character limit
    const maxMessageLength = 2000;
    let currentMessage = '';
    let messageCount = 0;

    for (let i = 0; i < playerList.length; i++) {
      const line = playerList[i] + '\n';

      // Check if adding this line will exceed the message length
      if ((currentMessage + line).length > maxMessageLength) {
        // Send the current message
        await message.channel.send(currentMessage);
        
        // Reset the current message and increment the count
        currentMessage = line;  // Start the new message with the current player
        messageCount++;
      } else {
        // Add the line to the current message
        currentMessage += line;
      }
    }

    // Send any remaining message content
    if (currentMessage.length > 0) {
      await message.channel.send(currentMessage);
    }
  } catch (error) {
    console.error(error);
    message.channel.send(`An error occurred: ${error.message}`);
  }
}

// Function to fetch and display losses
async function fetchAndDisplayLosses(playerName, message) {
  try {
    const playerUrl = await scrapePlayerUrl(playerName);
    const losses = await scrapePlayerLosses(playerUrl);

    if (losses.length === 0) {
      return message.channel.send(`No losses found for ${playerName}.`);
    }

    // Aggregate losses and sort by count (descending)
    const lossCounts = losses.reduce((acc, opponent) => {
      acc[opponent] = (acc[opponent] || 0) + 1;
      return acc;
    }, {});

    const sortedLosses = Object.entries(lossCounts)
      .sort(([, countA], [, countB]) => countB - countA) // Sort by count, descending
      .map(([opponent, count]) => `${opponent} x${count}`); // Format as "Opponent xCount"

    const lossMessage = sortedLosses.join('\n');

    await message.channel.send(`Losses for ${playerName}:\n${lossMessage}`);
  } catch (error) {
    console.error(error);
    message.channel.send(`An error occurred while fetching losses: ${error.message}`);
  }
}

// Log in to Discord
client.login(process.env.BOT_TOKEN);

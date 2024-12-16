import { Client, GatewayIntentBits } from 'discord.js';
import { getPlayersList, scrapePlayerUrl, getCharacterNamesForPlayer } from './utils/scrapeUtils.js';
import { scrapePlayerLosses } from './utils/lossUtils.js';
import dotenv from 'dotenv';
import { characterEmojis } from './utils/emojiMap.js';  // Import the emoji mapping
dotenv.config();

// Default URL
export let BRAACKET_URL = 'https://braacket.com/league/DFWSMASH2/ranking/B96401A8-7387-4BC1-B80B-7064F93AF2D5?rows=200'; 

// Popular Region URLs (add more regions and URLs as needed)
const popularRegions = {
  'DFW': 'https://braacket.com/league/DFWSMASH2/ranking/B96401A8-7387-4BC1-B80B-7064F93AF2D5?rows=200',
  'MDVA': 'https://braacket.com/league/NYC/ranking/12345ABCD12345?rows=200',
  'SC': 'https://braacket.com/league/scultimate/ranking?rows=200',
  // Add more regions here
};

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
  const command = message.content.split(' ')[0].toLowerCase();  // Convert the command part of the message to lowercase

  try {
    if (command === '$viewcurrent') {
      let listSize = 15;
      if (args.length > 0 && !isNaN(args[0])) {
        listSize = Math.min(Math.max(parseInt(args[0]), 1), 200); // Limit the list size to 1-200
      }
      const waitingMessage = await message.channel.send(`Fetching top ${listSize} players, please wait...\nBigger lists could take a bit`);
      const region = args.length > 1 ? args[1] : 'DFW'; // Default to 'DFW' if no region is specified
      await fetchAndPromptPlayers(listSize, message, region);
      // Delete the waiting message after sending the player list
      await waitingMessage.delete();
    } 
    else if (command === '$viewloss') {
      let playerName = args.join(' ').toLowerCase();

      if (!playerName) {
        message.channel.send('Please provide a player name or rank (e.g., $ViewLoss 1 or $ViewLoss PlayerName)');
        return;
      }

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

      const searchingMessage = await message.channel.send(`Searching for losses...`);
      await fetchAndDisplayLosses(playerName, message, searchingMessage); // Pass the searchingMessage to delete it later
    }
    else if (command === '$braacket') {
      const regionOrUrl = args.join(' ').trim(); // Get the region or URL

      if (popularRegions[regionOrUrl.toUpperCase()]) {
        // If region exists in the popularRegions object, update the URL
        BRAACKET_URL = popularRegions[regionOrUrl.toUpperCase()];
        message.react(`🫡`);
        message.channel.send(`Braacket URL updated to: ${BRAACKET_URL}`);
      } else if (regionOrUrl) {
        // If it's a direct URL, update it
        BRAACKET_URL = regionOrUrl;
        message.react(`🫡`);
        message.channel.send(`Braacket URL updated to: ${BRAACKET_URL}`);
      } else {
        message.channel.send('Please provide a valid region or URL.');
      }
    }
    else if (command === '$help') {
      message.channel.send(`
        **Available Commands:**
        **$ViewCurrent [1-200] [Region]** - View the current player rankings. Default is top 15 players.
        **$ViewLoss [PlayerName or PlayerRank]** - View the losses for a specific player by name.
        **$Braacket [Popular Region or Link]** - Change the braacket URL to a region or custom URL. Current available regions [MDVA], [DFW], [SC]
      `);
    } 
    else if (message.content.startsWith('$')) {
      message.channel.send('Invalid command. Type `$Help` for a list of available commands.');
    }
  } catch (error) {
    console.error(error);
    message.channel.send(`An error occurred: ${error.message}`);
  }
});

async function fetchAndPromptPlayers(listSize, message, region) {
  try {
    const players = await getPlayersList();
    if (players.length === 0) {
      return message.channel.send('No players found. Please try again later.');
    }

    const displayedPlayers = players.slice(0, listSize);

    const playerList = await Promise.all(
      displayedPlayers.map(async (p, idx) => {
        const characterNames = await getCharacterNamesForPlayer(p.name);
        
        const emotes = characterNames
          .map(characterName => characterEmojis[characterName] || `No emoji found for ${characterName}`)
          .join('');

        return `${idx + 1}. ${p.name} ${emotes}`;
      })
    );

    const maxMessageLength = 2000;
    let currentMessage = `**Braacket's current Top ${listSize} Players in ${region}**\n\n`;
    let messageCount = 0;

    for (let i = 0; i < playerList.length; i++) {
      const line = playerList[i] + '\n';

      if ((currentMessage + line).length > maxMessageLength) {
        await message.channel.send(currentMessage);
        currentMessage = line;
        messageCount++;
      } else {
        currentMessage += line;
      }
    }

    if (currentMessage.length > 0) {
      await message.channel.send(currentMessage);
    }
  } catch (error) {
    console.error(error);
    message.channel.send(`An error occurred: ${error.message}`);
  }
}

async function fetchAndDisplayLosses(playerName, message, searchingMessage) {
  try {
    const playerUrl = await scrapePlayerUrl(playerName);
    const losses = await scrapePlayerLosses(playerUrl);

    if (losses.length === 0) {
      return message.channel.send(`Holy goat... No losses found for ${playerName}.`);
    }

    const lossCounts = losses.reduce((acc, opponent) => {
      acc[opponent] = (acc[opponent] || 0) + 1;
      return acc;
    }, {});

    const sortedLosses = Object.entries(lossCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(async ([opponent, count]) => {
        const characterNames = await getCharacterNamesForPlayer(opponent);
        const emotes = characterNames
          .map(characterName => characterEmojis[characterName] || `No emoji found for ${characterName}`)
          .join('');
        return `${opponent} ${emotes} x${count}`;
      });

    const lossMessage = (await Promise.all(sortedLosses)).join('\n');

    await message.channel.send(`# Losses for \*\*${playerName}\*\*:\n\n${lossMessage}`);

    // Delete the initial "Searching for losses..." message
    await searchingMessage.delete();
  } catch (error) {
    console.error(error);
    message.channel.send(`An error occurred while fetching losses: ${error.message}`);
  }
}

client.login(process.env.BOT_TOKEN);

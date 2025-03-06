import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { cacheAll, cacheLosses, fetchAndSaveHTML, loadCache } from './utils/cacheStuff.js';
dotenv.config();

export let BRAACKET_URL = 'https://braacket.com/league/DFWSMASH2/ranking?rows=200';
let url = BRAACKET_URL;
await fetchAndSaveHTML();


// Popular Region URLs
const popularRegions = {
  'DFW': 'https://braacket.com/league/DFWSMASH2/ranking/F89DCB56-148F-481C-BE77-75D54D242763?rows=200',
  'MDVA': 'https://braacket.com/league/NYC/ranking/12345ABCD12345?rows=200',
  'SC': 'https://braacket.com/league/scultimate/ranking?rows=200',
};

const CACHE_FILE_PATH = './cache.json';
// Load initial cache
let cache = loadCache();

const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', async () => {
  await cacheAll();
  await cacheLosses();
  console.log('');
  console.log(`${client.user.tag} is online!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.split(' ').slice(1); // Get command arguments
  const command = message.content.split(' ')[0].toLowerCase(); // Convert the command part of the message to lowercase

  try {
    if (command === '$viewcurrent') {
      cache = loadCache();
      let listSize = 15;
      if (args.length > 0 && !isNaN(args[0])) {
        listSize = Math.min(Math.max(parseInt(args[0]), 1), 50); // Limit the list size to 1-50
      }
      const waitingMessage = await message.channel.send(`Fetching top ${listSize} players, please wait...`);
      await fetchAndPromptPlayers(listSize, message);
      await waitingMessage.delete();
    } else if (command === '$braacket') {
      const regionOrUrl = args.join(' ').trim();

      if (popularRegions[regionOrUrl.toUpperCase()]) {
        BRAACKET_URL = popularRegions[regionOrUrl.toUpperCase()];
        message.react(`🫡`);
        message.channel.send(`Braacket URL updated to: ${BRAACKET_URL}`);
      } else if (regionOrUrl) {
        BRAACKET_URL = regionOrUrl;
        message.react(`🫡`);
        message.channel.send(`Braacket URL updated to: ${BRAACKET_URL}`);
      } else {
        message.channel.send('Please provide a valid region or URL.');
      }
    } else if (command === '$clearcache') {
      cache = {};
      message.channel.send('Cache cleared successfully!');
    } else if (command === '$viewloss') {
      cache = loadCache();
      let playerName = args.join(' ').toLowerCase();  // Convert to lowercase to handle case-insensitivity.
    
      if (!playerName) {
        message.channel.send('Please provide a player name or rank (e.g., $ViewLoss 1 or $ViewLoss PlayerName)');
        return;
      }
    
      // Search for the player in the cache.
      let playerData = null;
      for (let playerKey in cache) {
        // Check if the player's name matches (case insensitive)
        if (cache[playerKey].playerData.toLowerCase() === playerName) {
          playerData = cache[playerKey];
          break;
        }
      }
    
      if (!playerData) {
        message.channel.send(`Player ${playerName} not found in cache.`);
        return;
      }
    
      // Now, we can display the losses directly from the cache.
      const losses = playerData.losses;
      if (losses && losses.length > 0) {
        const lossesMessage = `# Losses for **${playerData.playerData}**:\n${losses.join('\n')}`;
        message.channel.send(lossesMessage);
      } else {
        message.channel.send(`No losses found for **${playerData.playerData}**.`);
      }
    }
    
     else if (command === '$help') {
      message.channel.send(`
        **Available Commands:**
        **$ViewCurrent [1-50]** - View the current player rankings. Default is top 15 players.
        **$Braacket [Popular Region or Link]** - Change the Braacket URL to a region or custom URL. Current available regions [MDVA], [DFW], [SC]
        **$ClearCache** - Clear cached data.
      `);
    } else if (message.content.startsWith('$')) {
      message.channel.send('Invalid command. Type `$Help` for a list of available commands.');
    }

  } catch (error) {
    console.error(error);
    message.channel.send(`An error occurred: ${error.message}`);
  }
});

// Function for $viewcurrent
async function fetchAndPromptPlayers(listSize, message) {
  try {
    // Build the player list from the cache
    const playerList = [];
    for (let i = 1; i <= listSize; i++) {
      const playerName = cache[`player_${i}`]?.playerData || `Player ${i} (not cached yet)`;
      const characters = cache[`player_${i}`]?.character || ['Unknown'];
      const emotes = characters
        .join('');
      playerList.push(`${i}. ${playerName} ${emotes}`);
    }

    const maxMessageLength = 2000;
    let currentMessage = `**Braacket's current Top ${listSize} Players**\n\n`;
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
    console.error('Error fetching players:', error.message);
    message.channel.send('An error occurred while fetching the player list.');
  }
}


client.login(process.env.BOT_TOKEN);

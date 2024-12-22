import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { cache200, getPlayer, loadCache, saveCache, testNext } from './utils/cacheStuff.js';
import { characterEmojis } from './utils/emojiMap.js';
import { scrapePlayerLosses } from './utils/lossUtils.js';
import { getCharacterNamesForPlayerLosses, scrapePlayerUrl } from './utils/scrapeUtils.js';
dotenv.config();

export let BRAACKET_URL = 'https://braacket.com/league/DFWSMASH2/ranking/B96401A8-7387-4BC1-B80B-7064F93AF2D5?rows=200';
testNext();
// Popular Region URLs
const popularRegions = {
  'DFW': 'https://braacket.com/league/DFWSMASH2/ranking/B96401A8-7387-4BC1-B80B-7064F93AF2D5?rows=200',
  'MDVA': 'https://braacket.com/league/NYC/ranking/12345ABCD12345?rows=200',
  'SC': 'https://braacket.com/league/scultimate/ranking?rows=200',
};

// Load initial cache
let cache = loadCache();

const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
const CACHE_FILE_PATH = './cache.json';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', async () => {
  await cache200();
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
        listSize = Math.min(Math.max(parseInt(args[0]), 1), 200); // Limit the list size to 1-200
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
      let playerName = args.join(' ').toLowerCase();

      if (!playerName) {
        message.channel.send('Please provide a player name or rank (e.g., $ViewLoss 1 or $ViewLoss PlayerName)');
        return;
      }

      if (!isNaN(playerName)) {
        if (playerName >= 0 && playerName < 201) {
          playerName = await getPlayer(playerName);
        } else {
          message.channel.send('Invalid rank number.');
          return;
        }
      }

      const searchingMessage = await message.channel.send('Searching for losses...');
      await fetchAndDisplayLosses(playerName, message, searchingMessage);
    } else if (command === '$help') {
      message.channel.send(`
        **Available Commands:**
        **$ViewCurrent [1-200]** - View the current player rankings. Default is top 15 players.
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

async function fetchAndDisplayLosses(playerName, message, searchingMessage) {
  try {
    playerName = playerName.toLowerCase();
    const cacheKey = `losses_${playerName}`;
    const now = Date.now();


    if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_EXPIRY) {
      
      await message.channel.send(`# Losses for **${playerName}**:\n` + cache[cacheKey].data);
      await searchingMessage.delete();
      return;
    }

    const playerUrl = await scrapePlayerUrl(playerName);
    const losses = await scrapePlayerLosses(playerUrl);

    if (losses.length === 0) {
      return message.channel.send(`No losses found for ${playerName}.`);
    }

    const lossCounts = losses.reduce((acc, opponent) => {
      acc[opponent] = (acc[opponent] || 0) + 1;
      return acc;
    }, {});

    const sortedLosses = Object.entries(lossCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(async ([opponent, count]) => {
        const characterNames = await getCharacterNamesForPlayerLosses(playerName, opponent);
        const emotes = characterNames
          .map(characterName => characterEmojis[characterName] || `No emoji found for ${characterName}`)
          .join('');
        return `${opponent} ${emotes} x${count}`;
      });

    const lossMessage = (await Promise.all(sortedLosses)).join('\n');

    await message.channel.send(`# Losses for **${playerName}**:\n\n${lossMessage}`);

    cache[cacheKey] = { timestamp: now, data: lossMessage };
    saveCache(cache);

    await searchingMessage.delete();
  } catch (error) {
    console.error(error);
    message.channel.send(`An error occurred while fetching losses: ${error.message}`);
  }
}




client.login(process.env.BOT_TOKEN);

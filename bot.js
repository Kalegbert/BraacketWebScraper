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
  if (!message.content.startsWith('!viewlosses') || message.author.bot) return;

  const args = message.content.split(' ').slice(1); // Get command arguments

  try {
    if (args.length === 0) {
      // Ask for list size
      const sentMessage = await message.reply('How many players would you like to display (1-200)?');
      
      const filter = (response) =>
        !isNaN(response.content) &&
        parseInt(response.content, 10) >= 1 &&
        parseInt(response.content, 10) <= 200 &&
        response.author.id === message.author.id;

      const collector = message.channel.createMessageCollector({
        filter,
        time: 30000, // 30 seconds to respond
        max: 1,
      });

      collector.on('collect', async (response) => {
        const listSize = parseInt(response.content, 10);
        message.reply(`Fetching top ${listSize} players, please wait...`);
        await fetchAndPromptPlayers(listSize, message);
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          message.reply('No response received. Please try the command again.');
        }
      });
    } else {
      // Direct player lookup by name
      const playerName = args.join(' ').toLowerCase();
      message.reply(`Searching for losses of ${playerName}...`);
      await fetchAndDisplayLosses(playerName, message);
    }
  } catch (error) {
    console.error(error);
    message.reply(`An error occurred: ${error.message}`);
  }
});

async function fetchAndPromptPlayers(listSize, message) {
  try {
      const players = await getPlayersList();
      if (players.length === 0) {
          return message.reply('No players found. Please try again later.');
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

      const sentMessage = await message.reply(
          `Top ${listSize} players:\n${playerList.join('\n')}\n\nReply with the number corresponding to the player to view their losses.`
      );

      const filter = (response) =>
          !isNaN(response.content) &&
          parseInt(response.content, 10) >= 1 &&
          parseInt(response.content, 10) <= listSize &&
          response.author.id === message.author.id;

      const collector = message.channel.createMessageCollector({
          filter,
          time: 30000, // 30 seconds to respond
          max: 1,
      });

      collector.on('collect', async (response) => {
          const selectedIndex = parseInt(response.content, 10) - 1;
          const selectedPlayer = displayedPlayers[selectedIndex];
          console.log(`Fetching losses for ${selectedPlayer.name}, please wait...`);
          await fetchAndDisplayLosses(selectedPlayer.name, message);
      });

      collector.on('end', (collected) => {
          if (collected.size === 0) {
              message.reply('No selection was made. Please try again.');
          }
      });
  } catch (error) {
      console.error(error);
      message.reply(`An error occurred: ${error.message}`);
  }
}



// Function to fetch and display losses
async function fetchAndDisplayLosses(playerName, message) {
  try {
    const playerUrl = await scrapePlayerUrl(playerName);
    const losses = await scrapePlayerLosses(playerUrl);

    if (losses.length === 0) {
      return message.reply(`No losses found for ${playerName}.`);
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

    message.reply(`Losses for ${playerName}:\n${lossMessage}`);
  } catch (error) {
    console.error(error);
    message.reply(`An error occurred while fetching losses: ${error.message}`);
  }
}










// Log in to Discord
client.login(process.env.BOT_TOKEN);


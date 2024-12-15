import axios from 'axios';
import * as cheerio from 'cheerio';
import { characterEmojis } from './emojiMap.js';  // Import the emoji mapping


const BRAACKET_URL = 'https://braacket.com/league/DFWSMASH2/ranking/B96401A8-7387-4BC1-B80B-7064F93AF2D5?rows=200';


export const getPlayersList = async () => {
    try {
        const response = await axios.get(BRAACKET_URL);
        const $ = cheerio.load(response.data);

        const players = [];

        // Loop through the player rows
        $("section").eq(4).find(".table-hover tbody tr td.ellipsis a").each((_, element) => {
            const playerName = $(element).text().trim();

            // Get the associated character icons
            const characterIcons = [];
            $(element).closest('tr') // Find the row for the current player
                .find("td.ellipsis span.game_characters img.data-original-title")
                .each((_, imgElement) => {
                    const characterName = $(imgElement).attr("data-original-title").trim();  // Extract character name

                    // Debugging: log the characterName and check the emoji map
                    console.log(`Found character: ${characterName}`);

                    if (characterEmojis[characterName]) {
                        characterIcons.push(characterEmojis[characterName]);  // Get emoji ID from mapping
                    } else {
                        console.log(`No emoji found for character: ${characterName}`);
                    }
                });

            // Add the player and their associated characters to the players list
            players.push({
                name: playerName,
                characters: characterIcons.join(' '),  // Join all character icons into one string
            });
        });

        if (players.length === 0) {
            throw new Error('No players found. The page structure might have changed.');
        }

        return players;
    } catch (error) {
        console.error('Error fetching player list:', error.message);
        throw new Error('Failed to retrieve player list. Please try again later.');
    }
};




    




export const scrapePlayerUrl = async (playerName) => {
  try {
    const response = await axios.get(BRAACKET_URL);
    const $ = cheerio.load(response.data);

    let playerUrl = null;
    $("section").eq(4).find(".table-hover tbody tr td.ellipsis a").each((_, element) => {
      const name = $(element).text().trim().toLowerCase();
      if (name === playerName.toLowerCase()) {
        playerUrl = $(element).attr('href');
        return false; // Stop iteration
      }
    });

    if (!playerUrl) {
      throw new Error(`Player "${playerName}" not found.`);
    }

    return `https://braacket.com${playerUrl}`;
  } catch (error) {
    console.error('Error scraping player URL:', error.message);
    throw new Error(`Failed to retrieve URL for "${playerName}".`);
  }
};

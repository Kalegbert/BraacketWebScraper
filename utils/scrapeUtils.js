import axios from 'axios';
import * as cheerio from 'cheerio';
import { BRAACKET_URL } from '../bot.js';


export const getPlayersList = async () => {
    try {
        const response = await axios.get(BRAACKET_URL);
        const $ = cheerio.load(response.data);

        const players = [];

        // Loop through the player rows
        $("section").eq(4).find(".table-hover tbody tr").each((_, row) => {
            const playerName = $(row).find("td.ellipsis a").text().trim();

            // Add the player to the players list
            players.push({
                name: playerName,
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

export async function getPlayer(rankNum) {
    try {
        const response = await axios.get(BRAACKET_URL);
        const $ = cheerio.load(response.data);

        let player = null;

        // Loop through the player rows
        $("section").eq(4).find(".table-hover tbody tr").each((_, row) => {
            $(row).find("td.ellipsis a").each((index, element) => {
                const playerName = $(element).text().trim();
                
                if (index + 1 === rankNum) {
                    player = playerName;
                    return false; // This breaks the inner loop after finding the player
                }
            });

            if (player) {
                return false; // Break out of the outer
            }
        });

        // Check if player was found
        if (player === null) {
            throw new Error('No player found or the page structure might have changed.');
        }

        return player;

    } catch (error) {
        console.error('Error fetching player list:', error.message);
        throw new Error('Failed to retrieve player list. Please try again later.');
    }
}








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


// Function to fetch the character names associated with a player
export const getCharacterNamesForPlayer = async (playerName) => {
    try {
        // Fetch the HTML of the page containing player and character data
        const response = await axios.get(BRAACKET_URL);
        const $ = cheerio.load(response.data);

        const characterNames = [];

        // Loop through the player rows and find the player
        $("section").eq(4).find(".table-hover tbody tr").each((_, row) => {
            const currentPlayerName = $(row).find("td.ellipsis a").text().trim();

            // If the current row matches the player's name, extract the character names
            if (currentPlayerName === playerName) {
                // Find all character images associated with this player
                $(row)
                    .find("td.ellipsis span.game_characters img")
                    .each((_, imgElement) => {
                        // Extract character name from the image's data-original-title, alt, or title attribute
                        const characterName = $(imgElement).attr("data-original-title")?.trim() ||
                            $(imgElement).attr("alt")?.trim() ||
                            $(imgElement).attr("title")?.trim();

                        if (characterName) {
                            characterNames.push(characterName);
                        }
                    });
            }
        });

        return characterNames;
    } catch (error) {
        console.error(`Error fetching character names for player ${playerName}:`, error.message);
        throw new Error(`Failed to retrieve character names for player ${playerName}. Please try again later.`);
    }
};

export const getCharacterNamesForPlayerLosses = async (playerName, opponentName) => {
    try {
        // Fetch the HTML of the page containing player and character data
        const playerUrl = await scrapePlayerUrl(playerName);
        const response = await axios.get(playerUrl);
        const $ = cheerio.load(response.data);

        const characterNamesSet = new Set(); // players can show up multiple times here, this array only allows unique strings

        // Loop through the player rows and find the player
        $("table.my-table-show_max tbody tr").each((_, el) => {
            const currentPlayerName = $(el).find("td.ellipsis a").text().trim();

            // If the current row matches the player's name, extract the character names
            if (currentPlayerName === opponentName) {
                // Find all character images associated with this player
                $(el)
                    .find("td.ellipsis span.game_characters img")
                    .each((_, imgElement) => {
                        // Extract character name from the image's data-original-title, alt, or title attribute
                        const characterName = $(imgElement).attr("data-original-title")?.trim() ||
                            $(imgElement).attr("alt")?.trim() ||
                            $(imgElement).attr("title")?.trim();

                        if (characterName) {
                            characterNamesSet.add(characterName);
                        }
                    });
            }
        });

        return [...characterNamesSet];
    } catch (error) {
        console.error(`Error fetching character names for player ${playerName}:`, error.message);
        throw new Error(`Failed to retrieve character names for player ${playerName}. Please try again later.`);
    }
};
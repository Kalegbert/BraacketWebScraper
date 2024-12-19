import axios from 'axios';
import * as cheerio from 'cheerio';
import { BRAACKET_URL } from '../bot.js';
import { characterEmojis } from './emojiMap.js';



cache200();


function cache200(){
    for (let i = 1; i < 200; i++) {
        const playerName = getPlayer(i);
        const character = getCharacter(playerName);

        storePlayerInCache(i, playerName, character);
        console.log(`${i} ${playerName} ${character}`)

      } 

}



export function storePlayerInCache(playerId, playerData, character) {
    const cacheKey = `player_${playerId}`;  // Key for caching
    playerCache.set(cacheKey, playerData, character);
    console.log(`Stored ${playerId} in cache`);
}


function getPlayerFromCache(playerId) {
    const cacheKey = `player_${playerId}`;
    const cachedData = playerCache.get(cacheKey);
    if (cachedData) {
        console.log(`Cache hit for ${playerId}`);
        return cachedData;
    } else {
        console.log(`Cache miss for ${playerId}`);
        return null;  // Will fetch from the original source if not found
    }function storePlayerInCache(playerId, playerData) {
    const cacheKey = `player_${playerId}`;  // Key for caching
    playerCache.set(cacheKey, playerData);
    console.log(`Stored ${playerId} in cache`);
}

}


function getCharacter(playerName) {
    try {
        // Fetch the HTML of the page containing player and character data
        const response = axios.get(BRAACKET_URL);
        const $ = cheerio.load(response.data);

        const characterNames = [];
        const characterEmotes = [];

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
                            const emote = characterEmojis[characterName];
                    if (emote) {
                        characterEmotes.push(emote); // Store the emote in the array
                    }
                        }
                    });
            }
        });

        return characterNames;
    } catch (error) {
        console.error(`Error fetching character names for player ${playerName}:`, error.message);
        throw new Error(`Failed to retrieve character names for player ${playerName}. Please try again later.`);
    }
}


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
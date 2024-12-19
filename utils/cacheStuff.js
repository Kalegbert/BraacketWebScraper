import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as cheerio from 'cheerio';
import fs from 'fs';
import { BRAACKET_URL } from '../bot.js';
import { characterEmojis } from './emojiMap.js';

// File path to the cache file
const CACHE_FILE_PATH = './cache.json';

// Retry logic for Axios
axiosRetry(axios, {
    retries: 3, // Retry up to 3 times
    retryDelay: (retryCount) => retryCount * 1000, // Wait 1s, 2s, 3s
    retryCondition: (error) => error.code === 'ECONNABORTED' || error.response?.status >= 500,
});

// Create an Axios instance with a timeout
const axiosInstance = axios.create({
    timeout: 10000, // 10 seconds timeout
});

// Function to load the cache from the JSON file
export function loadCache() {
    if (fs.existsSync(CACHE_FILE_PATH)) {
        const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    }
    return {}; // Return an empty object if no cache file exists
}

// Function to save the cache to the JSON file
export function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

// Initialize the cache from the file
let playerCache = loadCache();

export async function cache200() {
    for (let i = 1; i <= 200; i++) {
        const playerName = await getPlayer(i); // Await the player name
        const character = await getCharacter(playerName); // Await the character data

        storePlayerInCache(i, playerName, character); // Store the player in the cache
        console.log(`${i} ${playerName} ${character}`);
        saveCache(playerCache);
    }
    console.log('Finished caching 200');

}

export function storePlayerInCache(playerId, playerData, character) {
    const cacheKey = `player_${playerId}`; // Key for caching
    playerCache[cacheKey] = { playerData, character }; // Store both player data and character in cache
    console.log(`Stored ${playerId} in cache`);
}

async function getCharacter(playerName) {
    try {
        const response = await axiosInstance.get(BRAACKET_URL); // Use the axios instance with timeout
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
                        const characterName =
                            $(imgElement).attr("data-original-title")?.trim() ||
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

        return characterNames.length ? characterNames : characterEmotes; // Return either character names or emotes
    } catch (error) {
        console.error(`Error fetching character names for player ${playerName}:`, error.message);
        throw new Error(`Failed to retrieve character names for player ${playerName}. Please try again later.`);
    }
}

export async function getPlayer(rankNum) {
    try {
        // Check if the player is in cache
        const cacheKey = `player_${rankNum}`;
        if (playerCache[cacheKey]) {
            console.log(`Cache hit for player ${rankNum}`);
            return playerCache[cacheKey].playerData;
        }

        const response = await axiosInstance.get(BRAACKET_URL); // Use the axios instance with timeout
        const $ = cheerio.load(response.data);

        let player = null;

        // Loop through the player rows
        $("section").eq(4).find(".table-hover tbody tr").each((index, row) => {
            $(row).find("td.ellipsis a").each((_, element) => {
                const playerName = $(element).text().trim();

                if (index + 1 === rankNum) {
                    player = playerName;
                    return false; // This breaks the inner loop after finding the player
                }
            });

            if (player) {
                return false; // Break out of the outer loop
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

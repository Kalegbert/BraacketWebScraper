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


export async function cacheAll() {
    const totalPlayers = await getTotalPlayers(BRAACKET_URL)
    console.log((totalPlayers*10)/60 + " minutes to cache all players");
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    for (let i = 1; i <= totalPlayers; i++) {
      
        let player = null;

        // Loop through the player rows on the current page
        $("section").eq(4).find(".table-hover tbody tr").each((index, row) => {
            const playerName = $(row).find("td.ellipsis a").text().trim();

            // Calculate the global rank: the rank across all pages, not just this page
            const globalRank = (neededPage - 1) * 200 + (index + 1);

            if (globalRank === rankNum) {
                player = playerName;
                return false; // Break the loop after finding the player
            }
        });

        // If no player was found
        if (player === null) {
            throw new Error('No player found or the page structure might have changed.');
        }
        let playerName = player;

        const character = [];



        const response = await axiosInstance.get(currentLink); // Use the axios instance with timeout
        const $ = cheerio.load(response.data);



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



        storePlayerInCache(i, player, character); // Store the player in the cache
        console.log(`${i} ${player} ${character}`);
        saveCache(playerCache);
        await delay(3000); // Delay for 3 seconds to avoid rate limiting


        const neededPage = Math.ceil(rankNum / 200);
        let bool = false;
        if (neededPage > 1 && !bool) {
            const response = await axios.get(getNextPageUrl(BRAACKET_URL));
            const $ = cheerio.load(response.data);
            bool = true;
        }
    }
    console.log(`Finished caching ${totalPlayers}`);

}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}




export function storePlayerInCache(playerId, playerData, character) {
    const cacheKey = `player_${playerId}`; // Key for caching
    playerCache[cacheKey] = { playerData, character }; // Store both player data and character in cache
    console.log(`Stored ${playerId} in cache`);
}

export async function getCharacter(playerName, rankNum) {
    try {


        // Check if the player is in cache
        const cacheKey = `player_${rankNum}`;
        if (playerCache[cacheKey]) {
            return playerCache[cacheKey].character;
        }

        let currentLink = BRAACKET_URL;

        const neededPage = Math.ceil(rankNum / 200);
        for (let i = 1; i < neededPage; i++) {
            currentLink = await getNextPageUrl(currentLink); // Update the link to the next page
        }


        const characterNames = [];
        const characterEmotes = [];


        const response = await axiosInstance.get(currentLink); // Use the axios instance with timeout
        const $ = cheerio.load(response.data);



        // Loop through the player rows and find the player

        $("section").eq(4).find(".table-hover tbody tr").each((_, row) => {
            const currentPlayerName = $(row).find("td.ellipsis a").text().trim();

            // If the current row matches the player's name, extract the character names
            if (currentPlayerName === playerName) {
                playerFound = true;
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



async function getCharacterForCacheAll(playerName, rankNum) {
    try {
        const cachePlayer = playerName;


        // can uncomment to make testing faster
        // const cacheKey = `player_${rankNum}`;
        // if (playerCache[cacheKey] && playerCache[cacheKey].playerData === cachePlayer) {
        //     return playerCache[cacheKey].character;
        // }

        let currentLink = BRAACKET_URL;

        const neededPage = Math.ceil(rankNum / 200);
        for (let i = 1; i < neededPage; i++) {
            currentLink = await getNextPageUrl(currentLink); // Update the link to the next page
        }


        const totalPlayers = await getTotalPlayers(BRAACKET_URL);
        const totalPages = await getPageAmt(BRAACKET_URL);


        const characterNames = [];
        const characterEmotes = [];



        const response = await axiosInstance.get(currentLink); // Use the axios instance with timeout
        const $ = cheerio.load(response.data);



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


        return characterEmotes;
    } catch (error) {
        console.error(`Error fetching character names for player ${playerName}:`, error.message);
        throw new Error(`Failed to retrieve character names for player ${playerName}. Please try again later.`);
    }
}



export async function getPlayer(rankNum) {
    try {
        let playerRank = rankNum;
        let currentLink = BRAACKET_URL;
        const totalPages = await getPageAmt(BRAACKET_URL);

        const neededPage = Math.ceil(playerRank / 200);
        if (neededPage <= totalPages) {

            currentLink = await getNextPageUrl(currentLink);
        }

        if (isNaN(playerRank)) {

        }


        // Check if the player is in cache
        const cacheKey = `player_${playerRank}`;
        if (playerCache[cacheKey]) {
            console.log(`Cache hit for player ${rankNum}`);
            return playerCache[cacheKey].playerData;
        }

        if (isNaN(rankNum)) {
            playerRank = getPlayerRank(rankNum, CACHE_FILE_PATH);
        }


        const response = await axiosInstance.get(currentLink); // Use the axios instance with timeout
        const $ = cheerio.load(response.data);

        let player = null;

        // Loop through the player rows
        $("section").eq(4).find(".table-hover tbody tr").each((index, row) => {
            $(row).find("td.ellipsis a").each((_, element) => {
                const playerName = $(element).text().trim();

                const globalRank = (neededPage - 1) * 200 + (index + 1);

                if (globalRank === playerRank) {
                    player = playerName;
                    return false; // Break the loop after finding the player
                }

                if (globalRank === playerRank) {
                    player = playerName;
                    return false; // Break the loop after finding the player
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


export async function getPlayerForCacheAll(rankNum) {
    try {
        let currentLink = BRAACKET_URL;

        // Calculate which page is needed to find rankNum
        const neededPage = Math.ceil(rankNum / 200); // Get the page number that the player would be on

        if (neededPage > 1) {
            for (let i = 1; i < neededPage; i++) {
                currentLink = await getNextPageUrl(currentLink); // Navigate to the next page
            }
        }


        const response = await axiosInstance.get(currentLink); // Get the current page
        const $ = cheerio.load(response.data);

        let player = null;

        // Loop through the player rows on the current page
        $("section").eq(4).find(".table-hover tbody tr").each((index, row) => {
            const playerName = $(row).find("td.ellipsis a").text().trim();

            // Calculate the global rank: the rank across all pages, not just this page
            const globalRank = (neededPage - 1) * 200 + (index + 1);

            if (globalRank === rankNum) {
                player = playerName;
                return false; // Break the loop after finding the player
            }
        });

        // If no player was found
        if (player === null) {
            throw new Error('No player found or the page structure might have changed.');
        }

        return player;

    } catch (error) {
        console.error('Error fetching player list:', error.message);
        throw new Error('Failed to retrieve player list. Please try again later.');
    }
}



export async function getPageAmt(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const pageAmount = $("section")
        .eq(5)
        .find("div.input-group.form-group")
        .find("div.input-group-addon")
        .first()
        .text() // Get the raw text
        .trim() // Remove surrounding whitespace
        .split('/')[1] // Split by '/' and get the second part
        .trim(); // Remove any extra whitespace

    return pageAmount;
}


export async function getTotalPlayers(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Extract raw text from the specified element
        const rawText = $("section")
            .eq(5)
            .find("div.input-group.form-group")
            .eq(2)
            .find("div.input-group-addon.my-input-group-addon")
            .first()
            .text()
            .trim();


        // Extract the last number using a regular expression
        const match = rawText.match(/\d+/g); // Find all sequences of digits
        const totalPlayers = match ? match[match.length - 1] : null; // Extract the last match

        if (!totalPlayers) {
            console.error("Failed to extract total players. Text may not contain the expected format.");
        }

        return totalPlayers;
    } catch (error) {
        console.error("Error in getTotalPlayers:", error);
        return null;
    }
}



export async function getNextPageUrl(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Select the "next page" link using the corrected selector
        const nextPageLink = $("section")
            .eq(5)
            .find("div.input-group-btn")
            .eq(1)
            .find("a.btn.btn-default")
            .first()
            .attr('href');

        // If the next page link exists, return the full URL
        if (nextPageLink) {
            return `https://braacket.com${nextPageLink}`; // Complete the URL if it's relative
        }

        // If no next page link is found, return null
        console.log('No next page link found');
        return null;
    } catch (error) {
        console.error('Error fetching next page URL:', error);
        return null;
    }
}


export async function getPlayerRank(playerName) {
    try {
        // Read and parse the cache file
        const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));

        // Iterate through the cache and find the player
        for (const [key, value] of Object.entries(cacheData)) {
            if (value.playerData.toLowerCase() === playerName) {
                // Extract the player number from the key
                const playerNumber = key.split('_')[1];
                return playerNumber;
            }
        }

        // If no match is found
        return null;
    } catch (error) {
        console.error('Error reading or parsing cache:', error.message);
        return null;
    }
}


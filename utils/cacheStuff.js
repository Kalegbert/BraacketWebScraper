import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as cheerio from 'cheerio';
import fs from 'fs';
import { BRAACKET_URL } from '../bot.js';
import { characterEmojis } from './emojiMap.js';
import { getPlayerChar, getPlayerName, lossHandler } from './scrapeUpdated.js';

// File path to the cache file
const CACHE_FILE_PATH = './cache.json';
export const PAGE1 = './htmlPages/page1.html';
export const PAGE2 = './htmlPages/page2.html';

let url = 'https://braacket.com/league/DFWSMASH2/ranking?rows=200';

export async function fetchAndSaveHTML() {
    try {
        // Fetch first page
        const { data } = await axios.get(url);
        fs.writeFileSync(PAGE1, data, 'utf-8');
        console.log('HTML page 1 saved successfully!');

        // Load the first page into cheerio
        const $ = cheerio.load(data);

        // Select the "next page" link
        const nextPageLink = $("section")
            .eq(5)
            .find("div.input-group-btn")
            .eq(1)
            .find("a.btn.btn-default")
            .first()
            .attr('href');

        let page2link = nextPageLink ? `https://braacket.com${nextPageLink}` : null;

        // Fetch second page if link exists
        if (page2link) {
            const { data: data2 } = await axios.get(page2link);
            fs.writeFileSync(PAGE2, data2, 'utf-8');
            console.log('HTML page 2 saved successfully!');
        } else {
            console.log('No next page found.');
        }
    } catch (error) {
        console.error('Error fetching the page:', error);
    }
}

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



    const response = await axios.get(url);
    let $ = cheerio.load(response.data);
    let bool = true;
    const url2 = await getNextPageUrl(url);
    let currentPath = null;

    const totalPlayers = await getTotalPlayers(BRAACKET_URL)
    console.log((totalPlayers * 0.1) / 60 + " minutes to cache all players");

    for (let i = 1; i <= totalPlayers; i++) {
        
        if((i / 200) <= 1){
            currentPath = PAGE1;
        } else {
            currentPath = PAGE2;
        }



        const rankNum = i;
        let neededPage = Math.ceil(rankNum / 200);
        let player = null;
        player = await getPlayerName(currentPath, i);

        // If no player was found
        if (player === null) {
            throw new Error('No player found or the page structure might have changed.');
        }

        let playerName = player;
        const character = await getPlayerChar(currentPath, playerName);





        storePlayerInCache(i, player, character); // Store the player in the cache
        saveCache(playerCache);
        console.log('Stored player in cache:', player, ' Rank:', i);
        await delay(50); // Delay for 3 seconds to avoid rate limiting


        neededPage = Math.ceil(rankNum / 199);
        if (neededPage > 1 && bool) {

            const response = await axios.get(url2);
            $ = cheerio.load(response.data);
            bool = false;
        }





    }
    console.log(`Finished caching ${totalPlayers}`);

}


/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////

export function storeLossesInCache(playerId, losses) {
    const cacheKey = `player_${playerId}`; // Key for caching

    // Ensure playerCache exists (if it's a global object)
    if (!playerCache[cacheKey]) {
        playerCache[cacheKey] = {}; // Initialize if it doesn't exist
    }

    // Replace the losses array while preserving other data
    playerCache[cacheKey].losses = losses;
}

export async function cacheLosses() {
    const totalPlayers = await getTotalPlayers(BRAACKET_URL)
    console.log((totalPlayers * 0.51) / 60 + " minutes to cache all players");

    await fetchAndSaveHTML();
    let currentPath = null;

    for (let i = 1; i <= totalPlayers; i++) {

        if((i / 200) <= 1){
            currentPath = PAGE1;
        } else {
            currentPath = PAGE2;
        }

        
        let rankNum = i;
        let html;
        let $;

        let neededPage = Math.ceil(rankNum / 199);
        if (neededPage === 1) {
            html = fs.readFileSync(PAGE1, 'utf-8');
        } else {
            html = fs.readFileSync(PAGE2, 'utf-8');
        }
        $ = cheerio.load(html);


        //get the players name
        let player = null;
        player = await getPlayerName(currentPath, i);

        let lossList = await lossHandler(currentPath, player);

        storeLossesInCache(i, lossList); // Store the losses in the cache
        saveCache(playerCache);
        console.log(`Cached losses for player ${i}`);
        await delay(15); // Delay for 3 seconds to avoid rate
    }

}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function storePlayerInCache(playerId, playerData, character) {
    const cacheKey = `player_${playerId}`; // Key for caching
    playerCache[cacheKey] = { playerData, character }; // Store both player data and character in cache
    // console.log(`Stored ${playerId} in cache`);
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

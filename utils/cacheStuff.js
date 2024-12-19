import axios from 'axios';
import * as cheerio from 'cheerio';
import { BRAACKET_URL } from '../bot.js';


function cache200(){
    for (let i = 1; i < 200; i++) {
        const playerName = getPlayer(i);
        storePlayerInCache(i, playerName);

      } 

}



function storePlayerInCache(playerId, playerData) {
    const cacheKey = `player_${playerId}`;  // Key for caching
    playerCache.set(cacheKey, playerData);
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
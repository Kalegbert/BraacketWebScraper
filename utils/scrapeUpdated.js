import axios from 'axios';
import * as cheerio from 'cheerio';
import fs, { readFileSync } from 'fs';
import { resolve } from "path";
import { characterEmojis } from './emojiMap.js';
export const PLAYERPAGE = './htmlPages/playerPage.html';




/////////////////////////////////////////////////////////////////////////////////// PLAYER RELATED
export async function getPlayerChar(htmlPath, playerName) {

    const filePath = resolve(htmlPath);
    const html = readFileSync(filePath, "utf8");
    const $ = cheerio.load(html);
    const player = playerName.toLowerCase();

    const characterNames = [];
    const character = [];
    let emote = null;

    $("section").eq(4).find(".table-hover tbody tr").each((_, row) => {
        const currentPlayerName = $(row).find("td.ellipsis a").text().trim().toLowerCase();

        // If the current row matches the player's name, extract the character names
        if (currentPlayerName === player) {
            // Find all character images associated with this player
            $(row)
                .find("td.ellipsis span.game_characters img")
                .each((_, imgElement) => {
                    const characterName =
                        $(imgElement).attr("data-original-title")?.trim() ||
                        $(imgElement).attr("alt")?.trim() ||
                        $(imgElement).attr("title")?.trim();

                    if (characterName) {
                        emote = characterEmojis[characterName];
                        if (emote) {
                            character.push(emote); // Store the emote in the array
                        }
                    }
                });
        }
    });
    return character;

}

export async function getPlayerName(htmlPath, rankNum) {
    let player = null;
    const filePath = resolve(htmlPath);
    const html = readFileSync(filePath, "utf8");
    const $ = cheerio.load(html);


    let neededPage = Math.ceil(rankNum / 200);

    $("section").eq(4).find(".table-hover tbody tr").each((index, row) => {
        const playerName = $(row).find("td.ellipsis a").text().trim();

        // Calculate the global rank: the rank across all pages, not just this page
        const globalRank = (neededPage - 1) * 200 + (index + 1);


        if (globalRank === rankNum) {
            player = playerName;
            return false; // Break the loop after finding the player
        }
    });
    return player;
}


///////////////////////////////////////////////////////////////////////////////////////// LOSS RELATED
export async function lossHandler(htmlPath, player) {
    await savePlayerHTML(htmlPath, player);
    const filePath = resolve(PLAYERPAGE);
    const html = readFileSync(filePath, "utf8");

    let losses = await getLossOpponent(html);
    let trimmedLosses = await trimLosses(losses);
    let lossList = [];
    for (const value of trimmedLosses) {
        lossList.push(`${value.opponent} x${value.count} ${await getLossChar(html, value.opponent)}`);

    }
    return lossList;
}

export async function getLossOpponent(html) {
    const $ = cheerio.load(html);
    const losses = [];

    $("table.my-table-show_max tbody tr").each((i, el) => {
        const result = $(el).find("td.ellipsis span.text-bold.number-danger").text().trim();
        if (result === "Lose") {
            const opponent = $(el).find("td.ellipsis a[href^='/league/']").text().trim();
            losses.push(opponent);
        }
    });

    return losses;
}

export async function getLossChar(html, opponentName) {
    const $ = cheerio.load(html);

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

    // Now, for each character name, get the corresponding emoji from the characterEmojis object
    const emotes = [...characterNamesSet]
        .map(characterName => characterEmojis[characterName] || `No emoji found for ${characterName}`)
        .join(''); // Join the emojis with a space

    return emotes; // Return the combined string of emojis
}

export async function trimLosses(losses) {
    const lossCounts = losses.reduce((acc, opponent) => {
        acc[opponent] = (acc[opponent] || 0) + 1;
        return acc;
    }, {});

    // Convert the object into an array of key-value pairs and sort by count in descending order
    return Object.entries(lossCounts)
        .map(([opponent, count]) => ({ opponent, count })) // Convert to array of objects
        .sort((a, b) => b.count - a.count); // Sort by count (highest to lowest)
}



/////////////////////////////////////////////////////////////////////////////////////// PAGE RELATED
export async function getPlayerUrl(htmlPath, player) {
    const filePath = resolve(htmlPath);
    const html = readFileSync(filePath, "utf8");
    const $ = cheerio.load(html);




    let playerUrl = null;
    $("section").eq(4).find(".table-hover tbody tr td.ellipsis a").each((_, element) => {
        const name = $(element).text().trim().toLowerCase();
        if (name === player.toLowerCase()) {
            playerUrl = $(element).attr('href');
            return false; // Stop iteration
        }
    });

    if (!playerUrl) {
        throw new Error(`Player "${player}" not found.`);
    }

    let playerLink = `https://braacket.com${playerUrl}`;
    return playerLink;


}

export async function getPageAmt(html) {
    const $ = cheerio.load(html);

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

export async function savePlayerHTML(htmlPath, player) {
    try {
        let currentUrl = await getPlayerUrl(htmlPath, player);

        const { data } = await axios.get(currentUrl);
        fs.writeFileSync(PLAYERPAGE, data, 'utf-8');
        console.log('Player HTML page saved successfully!');

    } catch (error) {
        console.error('Error fetching the page:', error);
    }
}
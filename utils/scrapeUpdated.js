import axios from 'axios';
import * as cheerio from 'cheerio';
import { BRAACKET_URL } from '../bot.js';
import { getNextPageUrl, getPlayerRank, fetchAndSaveHTML, PAGE1, PAGE2 } from './cacheStuff.js';
import { readFileSync } from "fs";
import { resolve } from "path";
import { characterEmojis } from './emojiMap.js';

///////////// PLAYER RELATED

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




///////// PAGE RELATED

export async function getUrl(html) {

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

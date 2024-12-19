import * as cheerio from "cheerio"; // Use named import here
import fetch from "node-fetch";

export async function scrapePlayerLosses(playerUrl) {
  try {
    const response = await fetch(playerUrl);
    const html = await response.text();
    const $ = cheerio.load(html);  // Load the HTML into cheerio
    const losses = [];

    $("table.my-table-show_max tbody tr").each((i, el) => {
      const result = $(el).find("td.ellipsis span.text-bold.number-danger").text().trim();
      if (result === "Lose") {
        const opponent = $(el).find("td.ellipsis a[href^='/league/']").text().trim();
        losses.push(opponent);
      }
    });

    return losses;
  } catch (error) {
    console.error("Error fetching the player's page:", error);
    return [];
  }
}

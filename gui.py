import tkinter as tk
from tkinter import PhotoImage, Label, Tk
import json
import re
import sys, os

def resource_path(relative_path):
    try:
        return os.path.join(sys._MEIPASS, relative_path)
    except AttributeError:
        return os.path.join(os.path.abspath("."), relative_path)


with open(resource_path("cache.json"), "r") as file:
    cache = json.load(file)

class AutocompleteEntry(tk.Entry):

    def __init__(self, names_list, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.names_list = sorted(names_list, key=str.lower)
        self.var = self["textvariable"] = tk.StringVar()
        self.var.trace_add("write", self.on_change)
        self.listbox = None

    def on_change(self, *_):
        typed = self.var.get().lower()

        # Destroy old listbox
        if self.listbox:
            self.listbox.destroy()
            self.listbox = None

        if typed == "":
            return

        matching = [name for name in self.names_list if typed in name.lower()]
        if matching:
            self.listbox = tk.Listbox(window, height=min(5, len(matching)))
            self.listbox.bind("<<ListboxSelect>>", self.on_select)

            for name in matching:
                self.listbox.insert(tk.END, name)

            # Place listbox below entry
            x, y, width, height = self.bbox(0)
            self.listbox.place(x=self.winfo_x(), y=self.winfo_y() + self.winfo_height())
        else:
            if self.listbox:
                self.listbox.destroy()
                self.listbox = None

    def on_select(self, event):
        if self.listbox:
            selection = self.listbox.get(self.listbox.curselection())
            self.var.set(selection)
            self.listbox.destroy()
            self.listbox = None

def extract_char_name(emoji_str):
    """
    Extract character name from a Discord emoji string like '<:mario:123456>'.
    Returns 'mario'. If not matching, returns the original string.
    """
    match = re.match(r"<:([^:]+):\d+>", emoji_str)
    return match.group(1) if match else emoji_str

def get_losses_for_player(player_name):
    """Find player by playerData and return formatted string of losses."""
    for player_id, player_info in cache.items():
        if player_info.get("playerData", "").lower() == player_name.lower():
            losses = player_info.get("losses", [])
            if not losses:
                return f"No losses found for player '{player_name}'."
            
            results = []
            for loss_entry in losses:
                # loss_entry example: "Vibe x2 <:pokemon_trainer:1317799515238957109>"
                # Split by ' x' to separate opponent and count + emoji
                # We want opponent name and count (the number after x)
                try:
                    # Find the ' x' to split opponent name and rest
                    opponent_part, rest = loss_entry.split(' x', 1)
                    # rest starts with a number, get the number before space or emoji
                    count_str = ''
                    for ch in rest:
                        if ch.isdigit():
                            count_str += ch
                        else:
                            break
                    count = int(count_str) if count_str else 1
                    results.append(f"{opponent_part.strip()}: x{count}")
                except Exception:
                    # Fallback: just print raw entry if parsing fails
                    results.append(loss_entry)
            return "\n".join(results)
    return f"Player '{player_name}' not found."



################## Not functions finally

player_names = [data["playerData"] for data in cache.values() if "playerData" in data]

window = tk.Tk()
window.title("Braacket Stats")
window.geometry("500x700")


labelTitle = tk.Label(window, text="Braacket Visualizer")
labelTitle.grid(row=0, column=0, sticky="nw", padx=10, pady=10)

entry = AutocompleteEntry(player_names, window)
entry.grid(row=1, column=0, sticky="e")


image = PhotoImage(file="")
currentPlayer = ""

def on_click():
    user_input = entry.get().strip().lower()
    found = False

    x = -1
    for data in cache.values():
        x += 1
        if data["playerData"].lower() == user_input:
            x += 1
            label.config(text=f"{data['playerData']}: {x}", font=("Arial", 16, "bold"))
            currentPlayer = data["playerData"]

            losses_text = get_losses_for_player(data["playerData"])
            text_output.delete("1.0", tk.END)
            text_output.insert(tk.END, losses_text)


            if data["character"]:  # make sure character list isn't empty
                image_path = resource_path(f"images/{extract_char_name(data['character'][0])}.png")
                image = PhotoImage(file=image_path)

                image = image.subsample(2, 2)
                image_label.config(image=image)
                image_label.image = image  # prevent garbage collection
            else:
                # add no character found symbol here
                label.config(text="Found, but no character data.")


            found = True
            break

    if not found:
        label.config(text="Player not found.")



def get_player_data_and_character_image(cache, player_key):
    player_info = cache.get(player_key)
    if not player_info:
        return None, None  # Player not found

    part1 = player_info.get("playerData", "")
    characters = player_info.get("character", [])

    if not characters:
        return part1, None  # No character listed

    # Extract character name from the first character string: "<:charname:id>"
    first_char = characters[0]
    # The format is <:charname:id>, we want to extract charname between <: and :
    start = first_char.find("<:") + 2
    end = first_char.find(":", start)
    char_name = first_char[start:end]

    image_path = f'./images/{char_name}.png'
    return part1, image_path

button = tk.Button(window, text="Search", command=on_click)
button.grid(row=1, column=1, sticky="w")

# how to do image stuff kinda
image_label = tk.Label(window, image=image)
image_label.grid(row=3, column=1, sticky="w")

label = tk.Label(window, text="Player")
label.grid(row=3, column=0, sticky="e", padx=10, pady=10)


text_output = tk.Text(window, width=60, height=30, wrap="word")
text_output.grid(row=4, column=0, columnspan=3, pady=10)
text_output.config(font=(20))

scrollbar = tk.Scrollbar(window, command=text_output.yview)
scrollbar.grid(row=4, column=3, sticky="ns", pady=10)
text_output.configure(yscrollcommand=scrollbar.set)



window.mainloop()
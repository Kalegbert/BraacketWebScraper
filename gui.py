import tkinter as tk
from tkinter import PhotoImage, Label, Tk
import json
import re

with open("cache.json", "r") as file:
    cache = json.load(file)

player_names = [data["playerData"] for data in cache.values() if "playerData" in data]


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

window = tk.Tk()
window.title("Braacket Stats")
window.geometry("800x700")


labelTitle = tk.Label(window, text="Braacket Visualizer")
labelTitle.grid(row=0, column=0, sticky="nw", padx=10, pady=10)

entry = AutocompleteEntry(player_names, window)
entry.grid(row=1, column=0, sticky="e")


image = PhotoImage(file="")
currentPlayer = ""

def on_click():
    user_input = entry.get().strip().lower()
    found = False

    for data in cache.values():
        if data["playerData"].lower() == user_input:
            label.config(text=f"{data['playerData']}", font=("Arial", 16, "bold"))
            currentPlayer = data["playerData"]


            if data["character"]:  # make sure character list isn't empty
                image = PhotoImage(file=f"./images/{extract_char_name(data["character"][0])}.png")
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

button = tk.Button(window, text="Search", command=on_click)
button.grid(row=1, column=1, sticky="w")

# how to do image stuff kinda
image_label = tk.Label(window, image=image)
image_label.grid(row=3, column=1, sticky="w")

label = tk.Label(window, text="Player")
label.grid(row=3, column=0, sticky="e", padx=10, pady=10)

losses_text = tk.Text(window, width=60, height=20)
losses_text.grid(row=4, column=0, columnspan=2, padx=10, pady=10)


window.mainloop()

import * as api from "./api";

// Usage example
try {
  await api.deleteList("pokemon", "pwd");
  await api.deleteList("random", "pwd");
} catch (e) {}
await api.createList("pokemon", {}, "pwd");
await api.changePassword("pokemon", "pwd", "new_password");
await api.changePassword("pokemon", "new_password", "pwd");
console.assert(await api.checkPassword("pokemon", "pwd"));
console.assert(!(await api.checkPassword("pokemon", "wrong_pass")));
await api.createList("random", {}, "your_list_password");
await api.addItem(
  "pokemon",
  {
    name: "Pikachu",
    data: {
      picture:
        "https://cdn03.ciceksepeti.com/cicek/kc4235987-1/XL/otografik-pikacu-pikachu-renkli-oto-sticker-11cm-x-11cm-kc4235987-1-bcfdccd4cc9544318b4c896de47c6707.jpg",
      info: "pika pika!",
    },
  },
  "pwd"
);
await api.addItem(
  "pokemon",
  {
    name: "Charizard",
    data: {
      picture:
        "https://assets.pokemon.com/assets/cms2/img/pokedex/full/006.png",
      info: "blows flames",
    },
  },
  "pwd"
);
await api.addItem("pokemon", { name: "Ekans", picture: "bleh" }, "pwd");
await api.getPairForVoting("pokemon");
await api.vote("pokemon", "Pikachu", "Ekans");
await api.vote("pokemon", "Charizard", "Pikachu");
await api.deleteItem("pokemon", "Ekans", "pwd");
await api.getSortedList("pokemon");
await api.getListsWithPopularity();
await api.deleteList("random", "your_list_password");

console.log("pass.");

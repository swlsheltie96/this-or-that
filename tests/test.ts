import * as api from "./api";

// Usage example
try {
  await api.deleteList("pokemon", "your_list_password");
  await api.deleteList("random", "your_list_password");
} catch (e) {}
await api.createList("pokemon", "your_list_password");
await api.changePassword("pokemon", "your_list_password", "new_password");
await api.changePassword("pokemon", "new_password", "pwd");
console.assert(await api.checkPassword("pokemon", "pwd"));
console.assert(!(await api.checkPassword("pokemon", "wrong_pass")));
await api.createList("random", "your_list_password");
await api.addItem("pokemon", { name: "Pikachu", data: "bleh" }, "pwd");
await api.addItem("pokemon", { name: "Charizard", data: "bleh" }, "pwd");
await api.addItem("pokemon", { name: "Ekans", picture: "bleh" }, "pwd");
await api.getPairForVoting("pokemon");
await api.vote("pokemon", "Pikachu", "Ekans");
await api.vote("pokemon", "Charizard", "Pikachu");
await api.deleteItem("pokemon", "Ekans", "pwd");
await api.getSortedList("pokemon");
await api.getListsWithPopularity();
await api.deleteList("random", "your_list_password");

console.log("pass.");

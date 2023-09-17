import * as api from './api';

// Usage example
await api.createList("pokemon", "your_list_password");
await api.changePassword("pokemon", "your_list_password", "new_password");
console.assert(await api.checkPassword("pokemon", "new_password"));
console.assert(! await api.checkPassword("pokemon", "wrong_pass"));
await api.createList("random", "new_password");
await api.addItem("pokemon", { name: "Pikachu", data: 'bleh' }, "new_password");
await api.addItem("pokemon", { name: "Charizard", data: 'bleh' }, "new_password");
await api.addItem("pokemon", { name: "Ekans", picture: 'bleh' }, "new_password");
await api.getPairForVoting("pokemon");
await api.vote("pokemon", "Pikachu", "Ekans");
await api.vote("pokemon", "Charizard", "Pikachu");
await api.deleteItem("pokemon", "Ekans", "new_password");
await api.testGetSortedList("pokemon");
await api.getListsWithPopularity();
await api.deleteList("random", "new_password");

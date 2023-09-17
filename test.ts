const PORT = process.env.PORT || 3000;

// Create a new list with a password
async function createList(listName, password) {
  const response = await fetch(`http://localhost:${PORT}/create-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, password: password }) // Include the password
  });
  const data = await response.json();
  console.log(data);
}

// Check the password for a list
async function checkPassword(listName, password) {
  const response = await fetch(`http://localhost:${PORT}/check-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, password: password })
  });
  const data = await response.json();
  return response.ok; // Return true if the password is valid, false otherwise
}

// Delete a list and its associated items with a password
async function deleteList(listName, password) {
  const response = await fetch(`http://localhost:${PORT}/delete-list`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, password: password }) // Include the password
  });
  const data = await response.json();
  console.log(data);
}

// Add an item to a list with a password
async function addItem(listName, item, password) {
  const response = await fetch(`http://localhost:${PORT}/add-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, item: item, password: password }) // Include the password
  });
  const data = await response.json();
  console.log(data);
}

// Delete an item from a list with a password
async function deleteItem(listName, itemName, password) {
  const response = await fetch(`http://localhost:${PORT}/delete-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, itemName: itemName, password: password }) // Include the password
  });
  const data = await response.json();
  console.log(data);
}

// Get a random pair of items for voting
async function getPairForVoting(listName) {
  const response = await fetch(`http://localhost:${PORT}/get-pair?listName=${encodeURIComponent(listName)}`);
  const data = await response.json();
  console.log(data);
}

// Vote on a pair of items
async function vote(listName, winner, loser) {
  const response = await fetch(`http://localhost:${PORT}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, winner: winner, loser: loser })
  });
  const data = await response.json();
  console.log(data);
}

// Test function for the /get-sorted-list endpoint
async function testGetSortedList(listName) {
  const response = await fetch(`http://localhost:${PORT}/get-sorted-list?listName=${encodeURIComponent(listName)}`);
  const data = await response.json();

  if (response.ok) {
    console.log(`Sorted items in ${listName}:`, data.list);
  } else {
    console.error('Error:', data.error);
  }
}

// Function to test the get-lists endpoint
async function getListsWithPopularity() {
  try {
    const response = await fetch(`http://localhost:${PORT}/get-lists`);
    if (!response.ok) {
      throw new Error(`Failed to fetch lists: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

// Usage example
await createList("pokemon", "your_list_password");
console.assert(await checkPassword("pokemon", "your_list_password"));
console.assert(! await checkPassword("pokemon", "wrong_pass"));
await createList("random", "your_list_password");
await addItem("pokemon", { name: "Pikachu", data: 'bleh' }, "your_list_password");
await addItem("pokemon", { name: "Charizard", data: 'bleh' }, "your_list_password");
await addItem("pokemon", { name: "Ekans", picture: 'bleh' }, "your_list_password");
await getPairForVoting("pokemon");
await vote("pokemon", "Pikachu", "Ekans");
await vote("pokemon", "Charizard", "Pikachu");
await deleteItem("pokemon", "Ekans", "your_list_password");
await testGetSortedList("pokemon");
await getListsWithPopularity();
await deleteList("random", "your_list_password");

const PORT = process.env.PORT || 3000;
// Create a new list
async function createList(listName) {
  const response = await fetch(`localhost:${PORT}/create-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName })
  });
  const data = await response.json();
  console.log(data);
}

// Add an item to a list
async function addItem(listName, item) {
  const response = await fetch(`localhost:${PORT}/add-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, item: item })
  });
  const data = await response.json();
  console.log(data);
}

// Get a random pair of items for voting
async function getPairForVoting(listName) {
  const response = await fetch(`localhost:${PORT}/get-pair?listName=${encodeURIComponent(listName)}`);
  const data = await response.json();
  console.log(data);
}

// Vote on a pair of items
async function vote(listName, winner, loser) {
  const response = await fetch(`localhost:${PORT}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, winner: winner, loser: loser })
  });
  const data = await response.json();
  console.log(data);
}

// Test function for the /get-sorted-list endpoint
async function testGetSortedList(listName) {
  const response = await fetch(`localhost:${PORT}/get-sorted-list?listName=${encodeURIComponent(listName)}`);
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
await createList("pokemon");
await createList("random");
await addItem("pokemon", {name: "Pikachu", picture: 'bleh'});
await addItem("pokemon", {name: "Charizard", picture: 'bleh'});
await addItem("pokemon", {name: "Ekans", picture: 'bleh'});
await getPairForVoting("pokemon");
await vote("pokemon", "Pikachu", "Ekans");
await vote("pokemon", "Charizard", "Pikachu");
await testGetSortedList("pokemon");
await getListsWithPopularity();

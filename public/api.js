const server = window.location.origin;

// Create a new list with a password
async function createList(listName, password) {
  const response = await fetch(`${server}/create-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, password: password }) // Include the password
  });
  const data = await response.json();
  return data;
}

// Check the password for a list
async function checkPassword(listName, password) {
  const response = await fetch(`${server}/check-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, password: password })
  });
  const data = await response.json();
  return response.ok; // Return true if the password is valid, false otherwise
}

// Delete a list and its associated items with a password
async function deleteList(listName, password) {
  const response = await fetch(`${server}/delete-list`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, password: password }) // Include the password
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Add an item to a list with a password
async function addItem(listName, item, password) {
  const response = await fetch(`${server}/add-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, item: item, password: password }) // Include the password
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Delete an item from a list with a password
async function deleteItem(listName, itemName, password) {
  const response = await fetch(`${server}/delete-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, itemName: itemName, password: password }) // Include the password
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Get a random pair of items for voting
async function getPairForVoting(listName) {
  const response = await fetch(`${server}/get-pair?listName=${encodeURIComponent(listName)}`);
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Vote on a pair of items
async function vote(listName, winner, loser) {
  const response = await fetch(`${server}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, winner: winner, loser: loser })
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Test function for the /get-sorted-list endpoint
async function getSortedList(listName) {
  const response = await fetch(`${server}/get-sorted-list?listName=${encodeURIComponent(listName)}`);
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();

  if (response.ok) {
    console.log('dlist', data.list);
    return data.list.map((d) => ({
      name: d.name,
      data: d.data ? JSON.parse(d.data) : {},
    }));
  } else {
    console.error('Error:', data.error);
  }
  return null;
}

// Function to test the get-lists endpoint
async function getListsWithPopularity() {
  const response = await fetch(`${server}/get-lists`);
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

// Change the password for a list
async function changePassword(listName, currentPassword, newPassword) {
  const response = await fetch(`${server}/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listName: listName,
      currentPassword: currentPassword, // Provide the current password
      newPassword: newPassword // Provide the new password
    })
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}


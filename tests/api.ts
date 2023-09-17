const PORT = process.env.PORT || 3000;
const SERVER = process.env.SERVER || 'localhost';
const DEBUG = process.env.DEBUG || false;//(SERVER == 'localhost');

function log(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Create a new list with a password
export async function createList(listName, password) {
  const response = await fetch(`http://${SERVER}:${PORT}/create-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, password: password }) // Include the password
  });
  const data = await response.json();
  log(data);
  return data;
}

// Check the password for a list
export async function checkPassword(listName, password) {
  const response = await fetch(`http://${SERVER}:${PORT}/check-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, password: password })
  });
  const data = await response.json();
  return response.ok; // Return true if the password is valid, false otherwise
}

// Delete a list and its associated items with a password
export async function deleteList(listName, password) {
  const response = await fetch(`http://${SERVER}:${PORT}/delete-list`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, password: password }) // Include the password
  });
  const data = await response.json();
  log(data);
  return data;
}

// Add an item to a list with a password
export async function addItem(listName, item, password) {
  const response = await fetch(`http://${SERVER}:${PORT}/add-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, item: item, password: password }) // Include the password
  });
  const data = await response.json();
  log(data);
  return data;
}

// Delete an item from a list with a password
export async function deleteItem(listName, itemName, password) {
  const response = await fetch(`http://${SERVER}:${PORT}/delete-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, itemName: itemName, password: password }) // Include the password
  });
  const data = await response.json();
  log(data);
  return data;
}

// Get a random pair of items for voting
export async function getPairForVoting(listName) {
  const response = await fetch(`http://${SERVER}:${PORT}/get-pair?listName=${encodeURIComponent(listName)}`);
  const data = await response.json();
  log(data);
  return data;
}

// Vote on a pair of items
export async function vote(listName, winner, loser) {
  const response = await fetch(`http://${SERVER}:${PORT}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listName: listName, winner: winner, loser: loser })
  });
  const data = await response.json();
  log(data);
  return data;
}

// Test function for the /get-sorted-list endpoint
export async function testGetSortedList(listName) {
  const response = await fetch(`http://${SERVER}:${PORT}/get-sorted-list?listName=${encodeURIComponent(listName)}`);
  const data = await response.json();

  if (response.ok) {
    log(`Sorted items in ${listName}:`, data.list);
  return data.list;
  } else {
    console.error('Error:', data.error);
  }
  return null;
}

// Function to test the get-lists endpoint
export async function getListsWithPopularity() {
  try {
    const response = await fetch(`http://${SERVER}:${PORT}/get-lists`);
    if (!response.ok) {
      throw new Error(`Failed to fetch lists: ${response.statusText}`);
    }

    const data = await response.json();
    log(data);
    return data;
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
  return null;
}

// Change the password for a list
export async function changePassword(listName, currentPassword, newPassword) {
  const response = await fetch(`http://${SERVER}:${PORT}/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listName: listName,
      currentPassword: currentPassword, // Provide the current password
      newPassword: newPassword // Provide the new password
    })
  });
  const data = await response.json();
  log(data);
  return data;
}


// taken from shumai
const chars = ['⡆', '⠇', '⠋', '⠙', '⠸', '⢰', '⣠', '⣄']
export function tuiLoad(str: string) {
  const t = Math.floor(performance.now() / 100)
  console.log(`\u001b[2K${chars[t % chars.length]}${str}\u001b[A`)
}

function formatSeconds(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds - hours * 3600) / 60)
  seconds = Math.floor(seconds - hours * 3600 - minutes * 60)

  let out = `${seconds} second${seconds !== 1 ? 's' : ''}`
  if (minutes) {
    out = `${minutes} minute${minutes !== 1 ? 's' : ''} and ${out}`
  }
  if (hours) {
    out = `${hours} hour${hours !== 1 ? 's' : ''}, ${out}`
  }
  return out
}

export function* viter(arrayLike: util.ArrayLike | number, callback?: (_: number) => string) {
  let len: number,
    is_num = false
  if (typeof arrayLike === 'number') {
    len = arrayLike
    is_num = true
  } else {
    len = arrayLike.length
  }
  if (!len) {
    throw `Cannot yet viter over unbounded iterables. Please file an issue!`
  }
  const formatter = Intl.NumberFormat('en', {
    notation: 'compact',
    minimumSignificantDigits: 3,
    maximumSignificantDigits: 3
  })
  const eta = (i, run_per_sec) => {
    const eta_tot = (len - i) / (run_per_sec + 1e-3)
    return `@ ${formatter.format(run_per_sec)} iter/sec, done in ~${formatSeconds(eta_tot)}`
  }
  let last_run = performance.now()
  let total_run = 0
  for (let i = 0; i < len; ++i) {
    const new_run = performance.now()
    total_run += new_run - last_run
    last_run = new_run
    const run_per_sec = (1e3 * i) / total_run
    tuiLoad(
      `${Math.floor((100 * i) / len)
        .toString()
        .padStart(2)}% (${i + 1}/${len} ${eta(i, run_per_sec)})${callback ? ' ' + callback(i) : ''}`
    )
    yield is_num ? i : arrayLike[i]
  }
  const run_per_sec = (1e3 * len) / total_run
  console.log(
    `\u001b[2K100% (${len}/${len} @ ${formatter.format(run_per_sec)} iter/sec)${
      callback ? ' ' + callback(len) : ''
    }\u001b[A\n`
  )
}


import { Database } from 'bun:sqlite';

const PORT = process.env.PORT || 3000;
const LRU_SIZE = process.env.LRU_SIZE || 1024 * 1024;
const BENCHMARK = process.env.BENCHMARK || false;

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      // To implement LRU, we delete and re-insert the key to update its position
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return -1;
  }

  put(key, value) {
    if (this.cache.has(key)) {
      // If the key already exists, update its value and re-insert it
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // If the cache is at capacity, remove the least recently used item (first key in the map)
      const lruKey = this.cache.keys().next().value;
      this.cache.delete(lruKey);
    }
    this.cache.set(key, value);
  }
}


class Server {
  get_map = {};
  post_map = {};
  delete_map = {};
  rate_limit_map = {};

  get(path, callback) {
    this.get_map[path] = callback;
  }

  get_static(path, file, content_type) {
    this.get(path, async (req) => {
      return new Response(Bun.file(file), {
        headers: new Headers({
          "Content-Type": content_type,
        })
      });
    });
  }

  post(path, rate_limit, callback) {
    this.post_map[path] = [callback, rate_limit];
    this.rate_limit_map[path] = new LRUCache(LRU_SIZE);
  }

  delete(path, callback) {
    this.delete_map[path] = callback;
  }

  check_rate_limit(req, path, rate) {
    const userId = req.headers.has('x-forwarded-for') ? req.headers.get('x-forwarded-for') : 0;
    const map = this.rate_limit_map[path];
    const now = performance.timeOrigin + performance.now();
    if (!BENCHMARK && map.get(userId) >= 0) {
      const diff = now - map.get(userId);
      if (diff < rate) {
        return true;
      }
    }
    map.put(userId, now);
    return false;
  }

  serve() {
    console.log(`Serving on port ${PORT}`);
    const self = this;
    Bun.serve({
        port: PORT,
        async fetch(req) {
          const url = new URL(req.url);
          switch (req.method) {
            case 'GET':
              if (url.pathname in self.get_map) {
                return await self.get_map[url.pathname](req);
              }
              break;
            case 'POST':
              if (url.pathname in self.post_map) {
                const [callback, rate_limit] = self.post_map[url.pathname];
                if (self.check_rate_limit(req, url.pathname, rate_limit)) {
                  return jsonError('Rate limited');
                }
                return await callback(req);
              }
              break;
            case 'DELETE':
              if (url.pathname in self.delete_map) {
                return await self.delete_map[url.pathname](req);
              }
              break;
          }
          return new Response('Invalid path or method', {status:400});
        },
    });
  }
};

const app = new Server();

app.get_static('/', 'public/index.html', 'text/html; charset=utf-8');
app.get_static('/index.html', 'public/index.html', 'text/html; charset=utf-8');
app.get_static('/create.html', 'public/create.html', 'text/html; charset=utf-8');
app.get_static('/list.html', 'public/list.html', 'text/html; charset=utf-8');
app.get_static('/vote.html', 'public/vote.html', 'text/html; charset=utf-8');
app.get_static('/style.css', 'public/style.css', 'text/css');
app.get_static('/script.js', 'public/script.js', 'text/javascript');
app.get_static('/list.js', 'public/list.js', 'text/javascript');
app.get_static('/api.js', 'public/api.js', 'text/javascript');

const db = new Database('lists.db');

// Create a table for storing lists
db.query(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    data JSON, -- Add a column to store JSON data
    password TEXT -- Add a column to store list passwords
  )
`).run();

// Create a table for storing items with a foreign key reference to the list
db.query(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER,
    name TEXT,
    data JSON, -- Add a column to store JSON data
    FOREIGN KEY (list_id) REFERENCES lists (id)
  )
`).run();

// Create a table for storing Elo ratings
db.query(`
  CREATE TABLE IF NOT EXISTS elo_ratings (
    list_name TEXT,
    item_name TEXT,
    rating REAL,
    PRIMARY KEY (list_name, item_name)
  )
`).run();

// Create a table for storing list votes
db.query(`
  CREATE TABLE IF NOT EXISTS list_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_name TEXT,
    user_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_name) REFERENCES lists (name)
    -- You can add a foreign key to reference the user table for user_id if needed
  )
`).run();

// Placeholder Elo ranking parameters (adjust as needed)
const K = 32; // Elo constant, controls rating update magnitude

function jsonError(msg, error_status=400) {
  return Response.json({error: msg}, {status: error_status});
}

// Helper function to wrap bun:sqlite queries and handle errors
function runQueries(sql, params, successMessage, errorMessage) {
  try {
    if (sql.length != params.length) {
      throw Error('Invalid input to runQueries');
    }
    const queries = [];
    for (let q of sql) {
      queries.push(db.query(q));
    }
    const transaction = db.transaction((queries, params) => {
      for (let i = 0; i < queries.length; ++i) {
        const result = queries[i].run(params[i]);
      }
    });
    transaction(queries, params);
    return Response.json({ message: successMessage });
  } catch (error) {
    return jsonError(errorMessage);
  }
}

function runQuery(sql, params, successMessage, errorMessage) {
  return runQueries([sql], [params], successMessage, errorMessage);
}

// Endpoint to create a new list
app.post('/create-list', 10000, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const data = body.data;
  const password = body.password; // Add password parameter

  const sql = 'INSERT INTO lists (name, data, password) VALUES (?, ?, ?)';
  const params = [listName, JSON.stringify(data), password];
  const successMessage = `List "${listName}" created successfully.`;
  const errorMessage = `Failed to create list "${listName}".`;

  return runQuery(sql, params, successMessage, errorMessage);
});

// Endpoint to check the password for a list
app.post('/check-password', 0, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const password = body.password;

  // Query the database to retrieve the stored password for the given list
  const sqlGetListPassword = 'SELECT password FROM lists WHERE name = ?';
  const paramsGetListPassword = [listName];

  const queryGetListPassword = db.query(sqlGetListPassword);
  const resultGetListPassword = queryGetListPassword.get(paramsGetListPassword);

  if (!resultGetListPassword) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const storedPassword = resultGetListPassword.password;

  // Compare the provided password with the stored password
  if (password === storedPassword) {
    return Response.json({ message: 'Password is valid.' });
  } else {
    return jsonError('Invalid password for this list.', 401);
  }
});

// Endpoint to change the password for a list
app.post('/change-password', 0, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const currentPassword = body.currentPassword; // Current password
  const newPassword = body.newPassword; // New password

  // Query the database to retrieve the stored password for the given list
  const sqlGetListPassword = 'SELECT password FROM lists WHERE name = ?';
  const paramsGetListPassword = [listName];

  const queryGetListPassword = db.query(sqlGetListPassword);
  const resultGetListPassword = queryGetListPassword.get(paramsGetListPassword);

  if (!resultGetListPassword) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const storedPassword = resultGetListPassword.password;

  // Compare the provided current password with the stored password
  if (currentPassword !== storedPassword) {
    console.log(currentPassword, storedPassword);
    return jsonError('Invalid current password for this list.', 401);
  }

  // Update the password in the 'lists' table
  const sqlUpdatePassword = 'UPDATE lists SET password = ? WHERE name = ?';
  const paramsUpdatePassword = [newPassword, listName];
   
  return runQuery(sqlUpdatePassword, paramsUpdatePassword, `Password for list "${listName}" changed successfully.`, `Failed to change password for list "${listName}".`);
});



// Endpoint to add items to a list (with uniqueness check)
app.post('/add-item', 0, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const newItem = body.item;
  const password = body.password; // Add password parameter

  const sqlGetListId = 'SELECT id, password FROM lists WHERE name = ?';
  const paramsGetListId = [listName];

  const queryGetListId = db.query(sqlGetListId);
  const resultGetListId = queryGetListId.get(paramsGetListId);
  if (!resultGetListId) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const listId = resultGetListId.id;
  const storedPassword = resultGetListId.password;

  // Check if the provided password matches the stored password
  if (password !== storedPassword) {
    return jsonError('Invalid password for this list.', 401);
  }

  // Check for existing items with the same name in the 'items' table
  const sqlCheckExistingItem = 'SELECT * FROM items WHERE list_id = ? AND name = ?';
  const paramsCheckExistingItem = [listId, newItem.name];

  const queryCheckExistingItem = db.query(sqlCheckExistingItem);
  const resultCheckExistingItem = queryCheckExistingItem.get(paramsCheckExistingItem);

  if (resultCheckExistingItem) {
    return jsonError(`Item "${newItem.name}" already exists in list "${listName}".`);
  }

  // Insert the new item into the 'items' table with JSON data
  const sqlInsertNewItem = 'INSERT INTO items (list_id, name, data) VALUES (?, ?, ?)';
  const paramsInsertNewItem = [listId, newItem.name, JSON.stringify(newItem.data)];

  return runQuery(sqlInsertNewItem, paramsInsertNewItem, `Item "${newItem.name}" added to list "${listName}" successfully.`, `Failed to add item to list "${listName}".`);
});

// Endpoint to delete a list and its associated items
app.delete('/delete-list', async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const password = body.password; // Add password parameter

  const sqlGetListId = 'SELECT id, password FROM lists WHERE name = ?';
  const paramsGetListId = [listName];

  const queryGetListId = db.query(sqlGetListId);
  const resultGetListId = queryGetListId.get(paramsGetListId);
  if (!resultGetListId) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const listId = resultGetListId.id;
  const storedPassword = resultGetListId.password;

  // Check if the provided password matches the stored password
  if (password !== storedPassword) {
    return jsonError('Invalid password for this list.', 401);
  }

  // Delete the items associated with the list from the 'items' table
  const sqlDeleteItems = 'DELETE FROM items WHERE list_id = ?';
  const paramsDeleteItems = [listId];

  try {
    const queryDeleteItems = db.query(sqlDeleteItems);
    queryDeleteItems.run(paramsDeleteItems);
  } catch (error) {
    return jsonError(`Failed to delete items from list "${listName}".`);
  }

  // Delete the Elo ratings for the items from the 'elo_ratings' table
  const sqlDeleteEloRatings = 'DELETE FROM elo_ratings WHERE list_name = ?';
  const paramsDeleteEloRatings = [listName];

  try {
    const queryDeleteEloRatings = db.query(sqlDeleteEloRatings);
    queryDeleteEloRatings.run(paramsDeleteEloRatings);
  } catch (error) {
    return jsonError(`Failed to delete Elo ratings for list "${listName}".` );
  }

  // Delete the list from the 'lists' table
  const sqlDeleteList = 'DELETE FROM lists WHERE name = ?';
  const paramsDeleteList = [listName];

  return runQuery(sqlDeleteList, paramsDeleteList, `List "${listName}" and its items deleted successfully.`, `Failed to delete list "${listName}".`);
});

app.post('/delete-item', 0, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const itemName = body.itemName;
  const password = body.password; // Add password parameter

  const sqlGetListId = 'SELECT id, password FROM lists WHERE name = ?';
  const paramsGetListId = [listName];

  try {
    const queryGetListId = db.query(sqlGetListId);
    const resultGetListId = queryGetListId.get(paramsGetListId);
    if (!resultGetListId) {
      return jsonError(`List "${listName}" does not exist.`);
    }

    const listId = resultGetListId.id;
    const storedPassword = resultGetListId.password;

    // Check if the provided password matches the stored password
    if (password !== storedPassword) {
      return jsonError('Invalid password for this list.', 401);
    }

    // Delete the item from the 'items' table
    const sqlDeleteItem = 'DELETE FROM items WHERE list_id = ? AND name = ?';
    const paramsDeleteItem = [listId, itemName];

    return runQuery(sqlDeleteItem, paramsDeleteItem, `Item "${itemName}" deleted from list "${listName}" successfully.`, `Failed to delete item "${itemName}" from list "${listName}".`);
  } catch (error) {
    return jsonError(`Failed to fetch list ID for list "${listName}".`);
  }
});

// Endpoint to get a random pair of items for voting
app.get('/get-pair', (req) => {
  const params = (new URL(req.url)).searchParams;
  if (!params.has("listName")) {
    return jsonError(`Invalid query, listName= required`);
  }
  const listName = params.get("listName");

  const sqlGetListId = 'SELECT id FROM lists WHERE name = ?';
  const paramsGetListId = [listName];

  try {
    const queryGetListId = db.query(sqlGetListId);
    const resultGetListId = queryGetListId.get(paramsGetListId);
    if (!resultGetListId) {
      return jsonError(`List "${listName}" does not exist.`);
    }

    const listId = resultGetListId.id;

    // Fetch items associated with the list from the 'items' table
    const sqlGetItems = 'SELECT * FROM items WHERE list_id = ?';
    const paramsGetItems = [listId];

    try {
      const queryGetItems = db.query(sqlGetItems);
      const resultsGetItems = queryGetItems.all(paramsGetItems);

      if (resultsGetItems.length >= 2) {
        const randomIndex1 = Math.floor(Math.random() * resultsGetItems.length);
        let randomIndex2 = Math.floor(Math.random() * resultsGetItems.length);

        while (randomIndex2 === randomIndex1) {
          randomIndex2 = Math.floor(Math.random() * resultsGetItems.length);
        }

        const item1 = resultsGetItems[randomIndex1];
        const item2 = resultsGetItems[randomIndex2];

        return Response.json({ item1, item2 });
      } else {
        return jsonError(`Not enough items in list "${listName}" for voting.`);
      }
    } catch (error) {
      return jsonError(`Failed to retrieve items from list "${listName}".`);
    }
  } catch (error) {
    jsonError(`Failed to fetch list ID for list "${listName}".`);
  }
});

// Endpoint to get items in a list sorted by Elo rating
app.get('/get-sorted-list', (req) => {
  const params = (new URL(req.url)).searchParams;
  if (!params.has("listName")) {
    return jsonError(`Invalid query, listName= required`);
  }
  const listName = params.get("listName");

  const sqlGetListId = 'SELECT id FROM lists WHERE name = ?';
  const paramsGetListId = [listName];

  const queryGetListId = db.query(sqlGetListId);
  const resultGetListId = queryGetListId.get(paramsGetListId);
  if (!resultGetListId) {
    return jsonError(`List "${listName}" does not exist.`);
  }

  const listId = resultGetListId.id;

  // Fetch items associated with the list from the 'items' table
  const sqlGetItems = 'SELECT * FROM items WHERE list_id = ?';
  const paramsGetItems = [listId];

  const queryGetItems = db.query(sqlGetItems);
  const resultsGetItems = queryGetItems.all(paramsGetItems);

  if (!resultsGetItems) {
    return jsonError(`Failed to retrieve items from list "${listName}".`);
  }

  // Fetch Elo ratings for items from the 'elo_ratings' table
  const sqlGetEloRatings = 'SELECT item_name, rating FROM elo_ratings WHERE list_name = ?';
  const paramsGetEloRatings = [listName];

  const queryGetEloRatings = db.query(sqlGetEloRatings);
  const eloRows = queryGetEloRatings.all(paramsGetEloRatings);
  if (!eloRows) {
    return jsonError(`Failed to fetch Elo ratings for list "${listName}".`);
  }

  const eloRatings = {};
  eloRows.forEach((row) => {
    eloRatings[row.item_name] = row.rating;
  });

  // Sort items based on Elo ratings
  const sortedItems = resultsGetItems.slice().sort((itemA, itemB) => {
    const ratingA = eloRatings[itemA.name] || 1000; // Default rating if not available
    const ratingB = eloRatings[itemB.name] || 1000;
    return ratingB - ratingA; // Sort in descending order
  });

  sortedItems.forEach((item) => {
    item.elo = eloRatings[item.name] || 1000;
  });

  return Response.json({ list: sortedItems });
});

app.post('/vote', 1000, async (req) => {
  const body = await req.json();
  const listName = body.listName;
  const winner = body.winner; // Winner item from the pair
  const loser = body.loser;   // Loser item from the pair


  const sqlGetWinnerRating = 'SELECT rating FROM elo_ratings WHERE list_name = ? AND item_name = ?';
  const paramsGetWinnerRating = [listName, winner];

  const queryGetWinnerRating = db.query(sqlGetWinnerRating);
  const resultGetWinnerRating = queryGetWinnerRating.get(paramsGetWinnerRating);
  const winnerRating = resultGetWinnerRating ? resultGetWinnerRating.rating : 1000; // Default rating if not available

  const sqlGetLoserRating = 'SELECT rating FROM elo_ratings WHERE list_name = ? AND item_name = ?';
  const paramsGetLoserRating = [listName, loser];

  const queryGetLoserRating = db.query(sqlGetLoserRating);
  const resultGetLoserRating = queryGetLoserRating.get(paramsGetLoserRating);
  const loserRating = resultGetLoserRating ? resultGetLoserRating.rating : 1000;

  // Calculate Elo updates
  const winnerExpected = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const loserExpected = 1 - winnerExpected;

  const winnerNewRating = winnerRating + K * (1 - winnerExpected);
  const loserNewRating = loserRating + K * (0 - loserExpected);

  // Update or insert Elo ratings in the database
  const sqlUpdateWinnerRating = 'INSERT OR REPLACE INTO elo_ratings (list_name, item_name, rating) VALUES (?, ?, ?)';
  const paramsUpdateWinnerRating = [listName, winner, winnerNewRating];

  const sqlUpdateLoserRating = 'INSERT OR REPLACE INTO elo_ratings (list_name, item_name, rating) VALUES (?, ?, ?)';
  const paramsUpdateLoserRating = [listName, loser, loserNewRating];

  const userId = req.headers.has('x-forwarded-for') ? req.headers.get('x-forwarded-for') : 0;
  const sqlInsertVote = 'INSERT INTO list_votes (list_name, user_id) VALUES (?, ?)';
  const paramsInsertVote = [listName, userId];

  return runQueries(
      [
        sqlUpdateWinnerRating,
        sqlUpdateLoserRating,
        sqlInsertVote,
      ],
      [
        paramsUpdateWinnerRating,
        paramsUpdateLoserRating,
        paramsInsertVote,
      ],
      `Elo for "${winner}" and "${loser}" updated successfully.`,
      `Failed to update Elo for "${winner}" and "${loser}".`
      );
});

// Endpoint to get the names of all available lists
app.get('/get-lists', (req) => {
  const sqlGetLists = `
    SELECT lists.name, COUNT(list_votes.id) as vote_count
    FROM lists
    LEFT JOIN list_votes ON lists.name = list_votes.list_name
    GROUP BY lists.name
    ORDER BY vote_count DESC
  `;

  const queryGetLists = db.query(sqlGetLists);
  const resultsGetLists = queryGetLists.all([]);
  if (!resultsGetLists) {
  return jsonError('Failed to fetch list names.');
  }

  const sortedLists = resultsGetLists.map((row) => ({
    name: row.name,
    voteCount: row.vote_count
  }));

  return Response.json({ lists: sortedLists });
});


app.serve();

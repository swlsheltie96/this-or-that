const express = require('express');
const bodyParser = require('body-parser');
const { Database } = require('bun:sqlite'); // Import bun:sqlite

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const db = new Database('lists.db');

// Create a table for storing lists
db.query(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
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

// Helper function to wrap bun:sqlite queries and handle errors
function runQuery(sql, params, successMessage, errorMessage, res) {
  try {
    const query = db.query(sql);
    const result = query.run(params);
    res.status(200).json({ message: successMessage });
  } catch (error) {
    res.status(400).json({ error: errorMessage });
  }
}

// Endpoint to create a new list
app.post('/create-list', (req, res) => {
  const listName = req.body.listName;
  const password = req.body.password; // Add password parameter

  const sql = 'INSERT INTO lists (name, password) VALUES (?, ?)';
  const params = [listName, password];
  const successMessage = `List "${listName}" created successfully.`;
  const errorMessage = `Failed to create list "${listName}".`;

  runQuery(sql, params, successMessage, errorMessage, res);
});

// Endpoint to check the password for a list
app.post('/check-password', (req, res) => {
  const listName = req.body.listName;
  const password = req.body.password;

  // Query the database to retrieve the stored password for the given list
  const sqlGetListPassword = 'SELECT password FROM lists WHERE name = ?';
  const paramsGetListPassword = [listName];

  try {
    const queryGetListPassword = db.query(sqlGetListPassword);
    const resultGetListPassword = queryGetListPassword.get(paramsGetListPassword);

    if (!resultGetListPassword) {
      return res.status(400).json({ error: `List "${listName}" does not exist.` });
    }

    const storedPassword = resultGetListPassword.password;

    // Compare the provided password with the stored password
    if (password === storedPassword) {
      return res.status(200).json({ message: 'Password is valid.' });
    } else {
      return res.status(401).json({ error: 'Invalid password for this list.' });
    }
  } catch (error) {
    res.status(400).json({ error: `Failed to check the password for list "${listName}".` });
  }
});

// Endpoint to change the password for a list
app.post('/change-password', (req, res) => {
  const listName = req.body.listName;
  const currentPassword = req.body.currentPassword; // Current password
  const newPassword = req.body.newPassword; // New password

  // Query the database to retrieve the stored password for the given list
  const sqlGetListPassword = 'SELECT password FROM lists WHERE name = ?';
  const paramsGetListPassword = [listName];

  try {
    const queryGetListPassword = db.query(sqlGetListPassword);
    const resultGetListPassword = queryGetListPassword.get(paramsGetListPassword);

    if (!resultGetListPassword) {
      return res.status(400).json({ error: `List "${listName}" does not exist.` });
    }

    const storedPassword = resultGetListPassword.password;

    // Compare the provided current password with the stored password
    if (currentPassword !== storedPassword) {
      return res.status(401).json({ error: 'Invalid current password for this list.' });
    }

    // Update the password in the 'lists' table
    const sqlUpdatePassword = 'UPDATE lists SET password = ? WHERE name = ?';
    const paramsUpdatePassword = [newPassword, listName];

    runQuery(sqlUpdatePassword, paramsUpdatePassword, `Password for list "${listName}" changed successfully.`, `Failed to change password for list "${listName}".`, res);
  } catch (error) {
    res.status(400).json({ error: `Failed to change the password for list "${listName}".` });
  }
});



// Endpoint to add items to a list (with uniqueness check)
app.post('/add-item', (req, res) => {
  const listName = req.body.listName;
  const newItem = req.body.item;
  const password = req.body.password; // Add password parameter

  const sqlGetListId = 'SELECT id, password FROM lists WHERE name = ?';
  const paramsGetListId = [listName];

  try {
    const queryGetListId = db.query(sqlGetListId);
    const resultGetListId = queryGetListId.get(paramsGetListId);
    if (!resultGetListId) {
      return res.status(400).json({ error: `List "${listName}" does not exist.` });
    }

    const listId = resultGetListId.id;
    const storedPassword = resultGetListId.password;

    // Check if the provided password matches the stored password
    if (password !== storedPassword) {
      return res.status(401).json({ error: 'Invalid password for this list.' });
    }

    // Check for existing items with the same name in the 'items' table
    const sqlCheckExistingItem = 'SELECT * FROM items WHERE list_id = ? AND name = ?';
    const paramsCheckExistingItem = [listId, newItem.name];

    const queryCheckExistingItem = db.query(sqlCheckExistingItem);
    const resultCheckExistingItem = queryCheckExistingItem.get(paramsCheckExistingItem);

    if (resultCheckExistingItem) {
      return res.status(400).json({ error: `Item "${newItem.name}" already exists in list "${listName}".` });
    }

    // Insert the new item into the 'items' table with JSON data
    const sqlInsertNewItem = 'INSERT INTO items (list_id, name, data) VALUES (?, ?, ?)';
    const paramsInsertNewItem = [listId, newItem.name, JSON.stringify(newItem.data)];

    runQuery(sqlInsertNewItem, paramsInsertNewItem, `Item "${newItem.name}" added to list "${listName}" successfully.`, `Failed to add item to list "${listName}".`, res);
  } catch (error) {
    res.status(400).json({ error: `Failed to check for existing item.` });
  }
});

// Endpoint to delete a list and its associated items
app.delete('/delete-list', (req, res) => {
  const listName = req.body.listName;
  const password = req.body.password; // Add password parameter

  const sqlGetListId = 'SELECT id, password FROM lists WHERE name = ?';
  const paramsGetListId = [listName];

  try {
    const queryGetListId = db.query(sqlGetListId);
    const resultGetListId = queryGetListId.get(paramsGetListId);
    if (!resultGetListId) {
      return res.status(400).json({ error: `List "${listName}" does not exist.` });
    }

    const listId = resultGetListId.id;
    const storedPassword = resultGetListId.password;

    // Check if the provided password matches the stored password
    if (password !== storedPassword) {
      return res.status(401).json({ error: 'Invalid password for this list.' });
    }

    // Delete the items associated with the list from the 'items' table
    const sqlDeleteItems = 'DELETE FROM items WHERE list_id = ?';
    const paramsDeleteItems = [listId];

    try {
      const queryDeleteItems = db.query(sqlDeleteItems);
      queryDeleteItems.run(paramsDeleteItems);
    } catch (error) {
      return res.status(400).json({ error: `Failed to delete items from list "${listName}".` });
    }

    // Delete the Elo ratings for the items from the 'elo_ratings' table
    const sqlDeleteEloRatings = 'DELETE FROM elo_ratings WHERE list_name = ?';
    const paramsDeleteEloRatings = [listName];

    try {
      const queryDeleteEloRatings = db.query(sqlDeleteEloRatings);
      queryDeleteEloRatings.run(paramsDeleteEloRatings);
    } catch (error) {
      return res.status(400).json({ error: `Failed to delete Elo ratings for list "${listName}".` });
    }

    // Delete the list from the 'lists' table
    const sqlDeleteList = 'DELETE FROM lists WHERE name = ?';
    const paramsDeleteList = [listName];

    runQuery(sqlDeleteList, paramsDeleteList, `List "${listName}" and its items deleted successfully.`, `Failed to delete list "${listName}".`, res);
  } catch (error) {
    res.status(400).json({ error: `Failed to fetch list ID for list "${listName}".` });
  }
});

app.post('/delete-item', (req, res) => {
  const listName = req.body.listName;
  const itemName = req.body.itemName;
  const password = req.body.password; // Add password parameter

  const sqlGetListId = 'SELECT id, password FROM lists WHERE name = ?';
  const paramsGetListId = [listName];

  try {
    const queryGetListId = db.query(sqlGetListId);
    const resultGetListId = queryGetListId.get(paramsGetListId);
    if (!resultGetListId) {
      return res.status(400).json({ error: `List "${listName}" does not exist.` });
    }

    const listId = resultGetListId.id;
    const storedPassword = resultGetListId.password;

    // Check if the provided password matches the stored password
    if (password !== storedPassword) {
      return res.status(401).json({ error: 'Invalid password for this list.' });
    }

    // Delete the item from the 'items' table
    const sqlDeleteItem = 'DELETE FROM items WHERE list_id = ? AND name = ?';
    const paramsDeleteItem = [listId, itemName];

    runQuery(sqlDeleteItem, paramsDeleteItem, `Item "${itemName}" deleted from list "${listName}" successfully.`, `Failed to delete item "${itemName}" from list "${listName}".`, res);
  } catch (error) {
    res.status(400).json({ error: `Failed to fetch list ID for list "${listName}".` });
  }
});

// Endpoint to get a random pair of items for voting
app.get('/get-pair', (req, res) => {
  const listName = req.query.listName;

  const sqlGetListId = 'SELECT id FROM lists WHERE name = ?';
  const paramsGetListId = [listName];

  try {
    const queryGetListId = db.query(sqlGetListId);
    const resultGetListId = queryGetListId.get(paramsGetListId);
    if (!resultGetListId) {
      return res.status(400).json({ error: `List "${listName}" does not exist.` });
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

        res.status(200).json({ item1, item2 });
      } else {
        res.status(400).json({ error: `Not enough items in list "${listName}" for voting.`, data: resultsGetItems });
      }
    } catch (error) {
      res.status(400).json({ error: `Failed to retrieve items from list "${listName}".` });
    }
  } catch (error) {
    res.status(400).json({ error: `Failed to fetch list ID for list "${listName}".` });
  }
});

// Endpoint to get items in a list sorted by Elo rating
app.get('/get-sorted-list', (req, res) => {
  const listName = req.query.listName;

  const sqlGetListId = 'SELECT id FROM lists WHERE name = ?';
  const paramsGetListId = [listName];

  try {
    const queryGetListId = db.query(sqlGetListId);
    const resultGetListId = queryGetListId.get(paramsGetListId);
    if (!resultGetListId) {
      return res.status(400).json({ error: `List "${listName}" does not exist.` });
    }

    const listId = resultGetListId.id;

    // Fetch items associated with the list from the 'items' table
    const sqlGetItems = 'SELECT * FROM items WHERE list_id = ?';
    const paramsGetItems = [listId];

    try {
      const queryGetItems = db.query(sqlGetItems);
      const resultsGetItems = queryGetItems.all(paramsGetItems);

      // Fetch Elo ratings for items from the 'elo_ratings' table
      const sqlGetEloRatings = 'SELECT item_name, rating FROM elo_ratings WHERE list_name = ?';
      const paramsGetEloRatings = [listName];

      try {
        const queryGetEloRatings = db.query(sqlGetEloRatings);
        const eloRows = queryGetEloRatings.all(paramsGetEloRatings);

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

        res.status(200).json({ list: sortedItems });
      } catch (error) {
        res.status(400).json({ error: `Failed to fetch Elo ratings for list "${listName}".` });
      }
    } catch (error) {
      res.status(400).json({ error: `Failed to retrieve items from list "${listName}".` });
    }
  } catch (error) {
    res.status(400).json({ error: `Failed to fetch list ID for list "${listName}".` });
  }
});

app.post('/vote', (req, res) => {
  const listName = req.body.listName;
  const winner = req.body.winner; // Winner item from the pair
  const loser = req.body.loser;   // Loser item from the pair

  const sqlGetWinnerRating = 'SELECT rating FROM elo_ratings WHERE list_name = ? AND item_name = ?';
  const paramsGetWinnerRating = [listName, winner];

  try {
    const queryGetWinnerRating = db.query(sqlGetWinnerRating);
    const resultGetWinnerRating = queryGetWinnerRating.get(paramsGetWinnerRating);

    const winnerRating = resultGetWinnerRating ? resultGetWinnerRating.rating : 1000; // Default rating if not available

    const sqlGetLoserRating = 'SELECT rating FROM elo_ratings WHERE list_name = ? AND item_name = ?';
    const paramsGetLoserRating = [listName, loser];

    try {
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

      runQuery(sqlUpdateWinnerRating, paramsUpdateWinnerRating, `Elo rating for "${winner}" updated successfully.`, `Failed to update Elo rating for "${winner}".`, res);
      runQuery(sqlUpdateLoserRating, paramsUpdateLoserRating, `Elo rating for "${loser}" updated successfully.`, `Failed to update Elo rating for "${loser}".`, res);

      // Insert a record in the list_votes table to track the vote
      const userId = req.headers.has('x-forwarded-for') ? req.headers.get('x-forwarded-for') : 0;
      const sqlInsertVote = 'INSERT INTO list_votes (list_name, user_id) VALUES (?, ?)';
      const paramsInsertVote = [listName, userId];

      runQuery(sqlInsertVote, paramsInsertVote, 'Vote recorded successfully.', 'Failed to record the vote.', res);
    } catch (error) {
      res.status(400).json({ error: `Failed to fetch Elo rating for "${loser}".` });
    }
  } catch (error) {
    res.status(400).json({ error: `Failed to fetch Elo rating for "${winner}".` });
  }
});

// Endpoint to get the names of all available lists
app.get('/get-lists', (req, res) => {
  const sqlGetLists = `
    SELECT lists.name, COUNT(list_votes.id) as vote_count
    FROM lists
    LEFT JOIN list_votes ON lists.name = list_votes.list_name
    GROUP BY lists.name
    ORDER BY vote_count DESC
  `;

  try {
    const queryGetLists = db.query(sqlGetLists);
    const resultsGetLists = queryGetLists.all([]);

    const sortedLists = resultsGetLists.map((row) => ({
      name: row.name,
      voteCount: row.vote_count
    }));

    res.status(200).json({ lists: sortedLists });
  } catch (error) {
    res.status(400).json({ error: 'Failed to fetch list names.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const db = new sqlite3.Database('lists.db');

// Create a table for storing lists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    )
  `);

  // Create a table for storing items with a foreign key reference to the list
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER,
      name TEXT,
      FOREIGN KEY (list_id) REFERENCES lists (id)
    )
  `);
});
// Create a table for storing Elo ratings
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS elo_ratings (
      list_name TEXT,
      item_name TEXT,
      rating REAL,
      PRIMARY KEY (list_name, item_name)
    )
  `);
});


// Placeholder Elo ranking parameters (adjust as needed)
const K = 32; // Elo constant, controls rating update magnitude

// Placeholder user voting history (you should store this in a database)
const userVotes = {};

// Endpoint to create a new list
app.post('/create-list', (req, res) => {
  const listName = req.body.listName;

  // Insert the list into the 'lists' table
  db.run('INSERT INTO lists (name) VALUES (?)', [listName], (err) => {
    if (err) {
      console.log(err);
      return res.status(400).json({ error: `Failed to create list "${listName}".` });
    }
    res.status(200).json({ message: `List "${listName}" created successfully.` });
  });
});

// Endpoint to add items to a list (with uniqueness check)
app.post('/add-item', (req, res) => {
  const listName = req.body.listName;
  const newItem = req.body.item;

  // Fetch the list ID from the 'lists' table
  db.get('SELECT id FROM lists WHERE name = ?', [listName], (err, row) => {
    if (err || !row) {
      return res.status(400).json({ error: `List "${listName}" does not exist.` });
    }

    const listId = row.id;

    // Check for existing items with the same name in the 'items' table
    db.get('SELECT * FROM items WHERE list_id = ? AND name = ?', [listId, newItem.name], (err, row) => {
      if (err) {
        return res.status(400).json({ error: `Failed to check for existing item.` });
      }

      if (row) {
        return res.status(400).json({ error: `Item "${newItem.name}" already exists in list "${listName}".` });
      }

      // Insert the new item into the 'items' table
      db.run(
        'INSERT INTO items (list_id, name) VALUES (?, ?)',
        [listId, newItem.name],
        (err) => {
          if (err) {
            return res.status(400).json({ error: `Failed to add item to list "${listName}".` });
          }
          res.status(200).json({ message: `Item "${newItem.name}" added to list "${listName}" successfully.` });
        }
      );
    });
  });
});

// Endpoint to get a random pair of items for voting
app.get('/get-pair', (req, res) => {
  const listName = req.query.listName;

  // Fetch the list ID from the 'lists' table
  db.get('SELECT id FROM lists WHERE name = ?', [listName], (err, row) => {
    if (err || !row) {
      return res.status(400).json({ error: `List "${listName}" does not exist.` });
    }

    const listId = row.id;

    // Fetch items associated with the list from the 'items' table
    db.all('SELECT * FROM items WHERE list_id = ?', [listId], (err, rows) => {
      if (err) {
        return res.status(400).json({ error: `Failed to retrieve items from list "${listName}".` });
      }

      if (rows.length >= 2) {
        const randomIndex1 = Math.floor(Math.random() * rows.length);
        let randomIndex2 = Math.floor(Math.random() * rows.length);

        while (randomIndex2 === randomIndex1) {
          randomIndex2 = Math.floor(Math.random() * rows.length);
        }

        const item1 = rows[randomIndex1];
        const item2 = rows[randomIndex2];

        res.status(200).json({ item1, item2 });
      } else {
        res.status(400).json({ error: `Not enough items in list "${listName}" for voting.`, data: rows });
      }
    });
  });
});

// Endpoint to get items in a list sorted by Elo rating
app.get('/get-sorted-list', (req, res) => {
  const listName = req.query.listName;

  // Fetch the list ID from the 'lists' table
  db.get('SELECT id FROM lists WHERE name = ?', [listName], (err, row) => {
    if (err || !row) {
      return res.status(400).json({ error: `List "${listName}" does not exist.` });
    }

    const listId = row.id;

    // Fetch items associated with the list from the 'items' table
    db.all('SELECT * FROM items WHERE list_id = ?', [listId], (err, rows) => {
      if (err) {
        return res.status(400).json({ error: `Failed to retrieve items from list "${listName}".` });
      }

      // Fetch Elo ratings for items from the 'elo_ratings' table
      db.all('SELECT item_name, rating FROM elo_ratings WHERE list_name = ?', [listName], (err, eloRows) => {
        if (err) {
          return res.status(400).json({ error: `Failed to fetch Elo ratings for list "${listName}".` });
        }

        const eloRatings = {};
        eloRows.forEach((row) => {
          eloRatings[row.item_name] = row.rating;
        });

        // Sort items based on Elo ratings
        const sortedItems = rows.slice().sort((itemA, itemB) => {
          const ratingA = eloRatings[itemA.name] || 1000; // Default rating if not available
          const ratingB = eloRatings[itemB.name] || 1000;
          return ratingB - ratingA; // Sort in descending order
        });

        sortedItems.forEach((item) => {
          item.elo = eloRatings[item.name] || 1000;
        });

        res.status(200).json({ list: sortedItems });
      });
    });
  });
});


app.post('/vote', (req, res) => {
  const listName = req.body.listName;
  const winner = req.body.winner; // Winner item from the pair
  const loser = req.body.loser;   // Loser item from the pair

  // Fetch or initialize Elo ratings from the database
  db.get('SELECT rating FROM elo_ratings WHERE list_name = ? AND item_name = ?', [listName, winner], (err, rowWinner) => {
    if (err) {
      return res.status(400).json({ error: `Failed to fetch Elo rating for "${winner}".` });
    }

    db.get('SELECT rating FROM elo_ratings WHERE list_name = ? AND item_name = ?', [listName, loser], (err, rowLoser) => {
      if (err) {
        return res.status(400).json({ error: `Failed to fetch Elo rating for "${loser}".` });
      }

      const winnerRating = rowWinner ? rowWinner.rating : 1000; // Default rating if not available
      const loserRating = rowLoser ? rowLoser.rating : 1000;

      // Calculate Elo updates
      const winnerExpected = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
      const loserExpected = 1 - winnerExpected;

      const winnerNewRating = winnerRating + K * (1 - winnerExpected);
      const loserNewRating = loserRating + K * (0 - loserExpected);

      // Update or insert Elo ratings in the database
      db.run('INSERT OR REPLACE INTO elo_ratings (list_name, item_name, rating) VALUES (?, ?, ?)', [listName, winner, winnerNewRating], (err) => {
        if (err) {
          return res.status(400).json({ error: `Failed to update Elo rating for "${winner}".` });
        }

        db.run('INSERT OR REPLACE INTO elo_ratings (list_name, item_name, rating) VALUES (?, ?, ?)', [listName, loser, loserNewRating], (err) => {
          if (err) {
            return res.status(400).json({ error: `Failed to update Elo rating for "${loser}".` });
          }

          res.status(200).json({ message: 'Elo rankings updated successfully.' });
        });
      });
    });
  });
});

// Endpoint to get the names of all available lists
app.get('/get-lists', (req, res) => {
  // Fetch all list names from the 'lists' table
  db.all('SELECT name FROM lists', [], (err, rows) => {
    if (err) {
      return res.status(400).json({ error: 'Failed to fetch list names.' });
    }

    const listNames = rows.map((row) => row.name);
    res.status(200).json({ lists: listNames });
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



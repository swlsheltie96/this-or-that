const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// Sample data structure to store lists and their items
const lists = {};

// Placeholder Elo ranking parameters (adjust as needed)
const K = 32; // Elo constant, controls rating update magnitude

// Placeholder user voting history (you should store this in a database)
const userVotes = {};

// Endpoint to create a new list
app.post('/create-list', (req, res) => {
  const listName = req.body.listName;
  if (!lists[listName]) {
    lists[listName] = {};
    res.status(200).json({ message: `List "${listName}" created successfully.` });
  } else {
    res.status(400).json({ error: `List "${listName}" already exists.` });
  }
});

// Endpoint to add items to a list (with uniqueness check)
app.post('/add-item', (req, res) => {
  const listName = req.body.listName;
  const newItem = req.body.item;

  if (!lists[listName]) {
    return res.status(400).json({ error: `List "${listName}" does not exist.` });
  }

  // Check for existing items with the same name
  const existingItemIndex = newItem.name in lists[listName]
  if (existingItemIndex) {
    return res.status(400).json({ error: `Item "${newItem.name}" already exists in list "${listName}".` });
  }

  lists[listName][newItem.name] = newItem;
  res.status(200).json({ message: `Item "${newItem.name}" added to list "${listName}" successfully.` });
});


// Endpoint to get a random pair of items for voting
app.get('/get-pair', (req, res) => {
  const listName = req.query.listName;
  
  if (lists[listName] && Object.keys(lists[listName]).length >= 2) {
    const keys = Object.keys(lists[listName])
    const randomIndex1 = Math.floor(Math.random() * keys.length);
    let randomIndex2 = Math.floor(Math.random() * keys.length);
    
    while (randomIndex2 === randomIndex1) {
      randomIndex2 = Math.floor(Math.random() * keys.length);
    }
    
    const item1 = lists[listName][keys[randomIndex1]];
    const item2 = lists[listName][keys[randomIndex2]];
    
    res.status(200).json({ item1, item2 });
  } else {
    res.status(400).json({ error: `Not enough items in list "${listName}" for voting.`, data: lists[listName] });
  }
});

// Endpoint to get items in a list sorted by Elo rating
app.get('/get-sorted-list', (req, res) => {
  const listName = req.query.listName;

  if (!lists[listName]) {
    return res.status(400).json({ error: `List "${listName}" does not exist.` });
  }

  if (!userVotes[listName]) {
    return res.status(400).json({ error: `No Elo ratings available for list "${listName}".` });
  }

  const sortedItems = Object.keys(lists[listName]).slice().sort((itemA, itemB) => {
    const ratingA = userVotes[listName][itemA] || 1000; // Default rating if not available
    const ratingB = userVotes[listName][itemB] || 1000;
    return ratingB - ratingA; // Sort in descending order
  });
  console.log(sortedItems, sortedItems.map((x)=>lists[listName][x]));

  res.status(200).json({list: sortedItems.map(x=>lists[listName][x])});
});

app.post('/vote', (req, res) => {
  const listName = req.body.listName;
  const winner = req.body.winner; // Winner item from the pair
  const loser = req.body.loser;   // Loser item from the pair
  
  if (!lists[listName]) {
    return res.status(400).json({ error: `List "${listName}" does not exist.` });
  }
  
  if (!lists[listName][winner] || !lists[listName][loser]) {
    return res.status(400).json({ error: 'Invalid winner or loser items.' });
  }
  
  if (!userVotes[listName]) {
    userVotes[listName] = {};
  }
  
  // Update Elo ranking
  const winnerRating = userVotes[listName][winner] || 1000; // Default rating if not available
  const loserRating = userVotes[listName][loser] || 1000;
  
  const winnerExpected = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const loserExpected = 1 - winnerExpected;
  
  const winnerNewRating = winnerRating + K * (1 - winnerExpected);
  const loserNewRating = loserRating + K * (0 - loserExpected);
  
  userVotes[listName][winner] = winnerNewRating;
  userVotes[listName][loser] = loserNewRating;
  
  res.status(200).json({ message: 'Elo ranking updated successfully.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

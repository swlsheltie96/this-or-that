// Function to create a card element
function createCard(item, index) {
    var card = document.createElement("div");
    card.className = "card";

    var nameElement = document.createElement("h2");
    nameElement.textContent = item.name;

    var eloElement = document.createElement("p");
    eloElement.textContent = item.elo.toFixed(2);

    var indexElement = document.createElement("p");
    indexElement.textContent = index;
    indexElement.classList.add("index");

    card.appendChild(indexElement);
    card.appendChild(nameElement);
    card.appendChild(eloElement);

    var data = item.data;

    if (data.picture) {
        var pictureElement = document.createElement("img");
        pictureElement.src = data.picture;
        card.appendChild(pictureElement);
    }

    return card;
}

// Get the card container element
var cardContainer = document.getElementById("card-container");
const queryString = window.location.search;
const searchParams = new URLSearchParams(queryString);
const listName = searchParams.get("listName");

// Create and append cards for each item in the JSON data
getSortedList(listName).then((data) => {
  console.log(data);
  data.forEach(function(item, index) {
      var card = createCard(item, index);
      cardContainer.appendChild(card);
  });
});
const voteButton = document.getElementById("voteButton");
const viewButton = document.getElementById("viewButton");
viewButton.href = `list.html?listName=${listName}`;
voteButton.href = `vote.html?listName=${listName}`;

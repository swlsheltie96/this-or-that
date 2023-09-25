// Function to create a card element
function createCard(item, index) {
    var card = document.createElement("div");
    card.classList.add("card");
    card.classList.add("box");

    var nameElement = document.createElement("span");
    nameElement.textContent = item.name;

    var eloElement = document.createElement("div");
    eloElement.style.padding = '0px 5px 5px 5px';
    const description = item.data ? item.data.description ? item.data.description : '' : '';
    eloElement.textContent = `${description} (Elo: ${item.elo.toFixed(2)})`;

    var indexElement = document.createElement("span");
    indexElement.textContent = `#${index}`;
    indexElement.classList.add("index");

    const header = document.createElement('div');
    header.classList.add('header');
    header.classList.add('flex-justify');
    header.appendChild(indexElement);
    header.appendChild(nameElement);
    card.appendChild(header)

    var data = item.data;

    if (data.picture) {
        var pictureElement = document.createElement("img");
        pictureElement.src = data.picture;
        pictureElement.classList.add('inner-box')
        card.appendChild(pictureElement);
    }
    card.appendChild(eloElement);

    return card;
}

// Get the card container element
var cardContainer = document.getElementById("card-container");
const queryString = window.location.search;
const searchParams = new URLSearchParams(queryString);
const listName = searchParams.get("listName");
document.getElementById('listName').textContent = listName;

// Create and append cards for each item in the JSON data
getSortedList(listName).then((data) => {
  data.forEach(function(item, index) {
      var card = createCard(item, index);
      cardContainer.appendChild(card);
  });
});
const voteButton = document.getElementById("voteButton");
const viewButton = document.getElementById("viewButton");
viewButton.href = `list.html?listName=${listName}`;
voteButton.href = `vote.html?listName=${listName}`;

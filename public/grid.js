// Function to create a card element
function createCard(item, index) {
  var card = document.createElement("div");
  card.classList.add("card");
  card.classList.add("box");
  card.classList.add("largeSquare");

  var nameElement = document.createElement("h4");
  nameElement.textContent = item.name;
  nameElement.classList.add("itemName");
  var eloElement = document.createElement("div");
  var eloElementP = document.createElement("p");
  eloElement.classList.add("eloTag", "largeSquare");

  const description = item.data
    ? item.data.description
      ? item.data.description
      : ""
    : "";

  eloElementP.textContent = `${item.elo.toFixed(2)}`;
  eloElement.appendChild(eloElementP);

  var indexElement = document.createElement("h4");
  indexElement.textContent = `#${index}`;
  indexElement.classList.add("index");

  const header = document.createElement("div");
  header.classList.add("header");
  header.classList.add("flex", "align");
  header.classList.add("largeSquare");
  header.appendChild(indexElement);
  header.appendChild(nameElement);
  card.appendChild(header);

  var data = item.data;

  if (data.picture) {
    var pictureElement = document.createElement("img");
    pictureElement.src = data.picture;
    pictureElement.classList.add("inner-box");
    pictureElement.classList.add("largeSquare");
    card.appendChild(pictureElement);
  }
  card.appendChild(eloElement);
  if (description != "") {
    var eloElementDes = document.createElement("div");
    var eloElementDesP = document.createElement("p");
    eloElementDesP.textContent = `${description}`;
    eloElementDes.appendChild(eloElementDesP);
    card.appendChild(eloElementDes);
    eloElementDes.classList.add("eloTag", "description", "largeSquare");
  }

  return card;
}

// Get the card container element
var cardContainer = document.getElementById("card-container");
const queryString = window.location.search;
const searchParams = new URLSearchParams(queryString);
const listName = searchParams.get("listName");
document.getElementById("listName").textContent = listName;

getListInfo(listName).then((d) => {
  document.getElementById("listDescription").textContent =
    "Description: " + d.description;
});
// Create and append cards for each item in the JSON data
getSortedList(listName).then((data) => {
  data.forEach(function (item, index) {
    var card = createCard(item, index + 1);
    cardContainer.appendChild(card);
  });
  encodeURIComponent;
  loadViewTypes();
});
const voteButton = document.getElementById("voteButtonA");
const editButton = document.getElementById("editButtonA");
editButton.href = `list.html?listName=${listName}`;
voteButton.href = `vote.html?listName=${listName}`;

function loadViewTypes() {
  const smallSquare = document.getElementById("smallSquare");
  const largeSquare = document.getElementById("largeSquare");
  smallSquare.addEventListener("click", () => {
    let largeStyle = document.querySelectorAll(".largeSquare");
    if (!smallSquare.classList.contains("clicked")) {
      smallSquare.classList.add("clicked");
      largeSquare.classList.remove("clicked");
    }
    largeStyle.forEach((el) => {
      el.classList.remove("largeSquare");
      el.classList.add("smallSquare");
    });
  });

  largeSquare.addEventListener("click", () => {
    let smallStyle = document.querySelectorAll(".smallSquare");
    if (!largeSquare.classList.contains("clicked")) {
      largeSquare.classList.add("clicked");
      smallSquare.classList.remove("clicked");
    }
    smallStyle.forEach((el) => {
      el.classList.remove("smallSquare");
      el.classList.add("largeSquare");
    });
  });
}

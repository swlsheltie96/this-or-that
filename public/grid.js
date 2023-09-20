console.log("grid");

// Your JSON data
var jsonData = [{
        id: 1,
        list_id: 1,
        name: "Pikachu",
        data: '{"picture":"https://cdn03.ciceksepeti.com/cicek/kc4235987-1/XL/otografik-pikacu-pikachu-renkli-oto-sticker-11cm-x-11cm-kc4235987-1-bcfdccd4cc9544318b4c896de47c6707.jpg","info":"pika pika!"}',
        elo: 1016.1234552326052,
    },
    {
        id: 2,
        list_id: 1,
        name: "Charizard",
        data: '{"picture":"https://assets.pokemon.com/assets/cms2/img/pokedex/full/006.png","info":"blows flames"}',
        elo: 999.8765447673948,
    },
    {
        id: 1,
        list_id: 1,
        name: "Pikachu",
        data: '{"picture":"https://cdn03.ciceksepeti.com/cicek/kc4235987-1/XL/otografik-pikacu-pikachu-renkli-oto-sticker-11cm-x-11cm-kc4235987-1-bcfdccd4cc9544318b4c896de47c6707.jpg","info":"pika pika!"}',
        elo: 1016.1234552326052,
    },
    {
        id: 2,
        list_id: 1,
        name: "Charizard",
        data: '{"picture":"https://assets.pokemon.com/assets/cms2/img/pokedex/full/006.png","info":"blows flames"}',
        elo: 999.8765447673948,
    },
    {
        id: 1,
        list_id: 1,
        name: "Pikachu",
        data: '{"picture":"https://cdn03.ciceksepeti.com/cicek/kc4235987-1/XL/otografik-pikacu-pikachu-renkli-oto-sticker-11cm-x-11cm-kc4235987-1-bcfdccd4cc9544318b4c896de47c6707.jpg","info":"pika pika!"}',
        elo: 1016.1234552326052,
    },
    {
        id: 2,
        list_id: 1,
        name: "Charizard",
        data: '{"picture":"https://assets.pokemon.com/assets/cms2/img/pokedex/full/006.png","info":"blows flames"}',
        elo: 999.8765447673948,
    },
    {
        id: 1,
        list_id: 1,
        name: "Pikachu",
        data: '{"picture":"https://cdn03.ciceksepeti.com/cicek/kc4235987-1/XL/otografik-pikacu-pikachu-renkli-oto-sticker-11cm-x-11cm-kc4235987-1-bcfdccd4cc9544318b4c896de47c6707.jpg","info":"pika pika!"}',
        elo: 1016.1234552326052,
    },
    {
        id: 2,
        list_id: 1,
        name: "Charizard",
        data: '{"picture":"https://assets.pokemon.com/assets/cms2/img/pokedex/full/006.png","info":"blows flames"}',
        elo: 999.8765447673948,
    },
];

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

    var data = JSON.parse(item.data);

    if (data.picture) {
        var pictureElement = document.createElement("img");
        pictureElement.src = data.picture;
        card.appendChild(pictureElement);
    }

    return card;
}

// Get the card container element
var cardContainer = document.getElementById("card-container");

// Create and append cards for each item in the JSON data
jsonData.forEach(function(item, index) {
    var card = createCard(item, index);
    cardContainer.appendChild(card);
});

const queryString = window.location.search;
const searchParams = new URLSearchParams(queryString);
const listName = searchParams.get("listName");
const voteButton = document.getElementById("voteButton");
const viewButton = document.getElementById("viewButton");
viewButton.href = `list.html?listName=${listName}`;
voteButton.href = `vote.html?listName=${listName}`;
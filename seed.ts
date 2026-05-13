import { Database } from "bun:sqlite";

const db = new Database("lists.db");
const password = await Bun.password.hash("seed");

const lists = [
  {
    name: "Fast Food Chains",
    data: { description: "Which fast food chain reigns supreme?", author: "seed" },
    items: ["McDonald's", "Chick-fil-A", "In-N-Out Burger", "Wendy's", "Burger King", "Taco Bell", "Chipotle", "Five Guys", "Shake Shack", "Popeyes", "KFC", "Subway", "Panda Express", "Domino's", "Pizza Hut", "Whataburger", "Sonic", "Wingstop", "Jersey Mike's", "Raising Cane's"],
  },
  {
    name: "NYC Subway Lines",
    data: { description: "The definitive NYC subway line ranking", author: "seed" },
    items: ["1 Train", "2 Train", "3 Train", "4 Train", "5 Train", "6 Train", "7 Train", "A Train", "B Train", "C Train", "D Train", "E Train", "F Train", "G Train", "J Train", "L Train", "M Train", "N Train", "Q Train", "R Train", "W Train", "Z Train", "S Shuttle"],
  },
  {
    name: "Airports",
    data: { description: "Best airports in the world", author: "seed" },
    items: ["JFK - John F. Kennedy", "LAX - Los Angeles", "ATL - Hartsfield-Jackson", "ORD - O'Hare", "DFW - Dallas Fort Worth", "DEN - Denver", "SFO - San Francisco", "SEA - Seattle-Tacoma", "MIA - Miami", "BOS - Logan", "LHR - Heathrow", "CDG - Charles de Gaulle", "NRT - Narita", "DXB - Dubai", "SIN - Changi", "AMS - Schiphol", "FRA - Frankfurt", "HKG - Hong Kong", "ICN - Incheon", "SYD - Sydney"],
  },
  {
    name: "Pasta Shapes",
    data: { description: "The ultimate pasta shape showdown", author: "seed" },
    items: ["Spaghetti", "Rigatoni", "Penne", "Fettuccine", "Farfalle", "Orecchiette", "Tagliatelle", "Bucatini", "Fusilli", "Paccheri", "Conchiglie", "Pappardelle", "Linguine", "Cavatappi", "Gemelli", "Tortellini", "Ravioli", "Lasagna", "Gnocchi", "Radiatori"],
  },
  {
    name: "Condiments",
    data: { description: "Which condiment is king?", author: "seed" },
    items: ["Ketchup", "Mustard", "Mayonnaise", "Hot Sauce", "Ranch", "Sriracha", "Soy Sauce", "Balsamic Glaze", "Tahini", "Salsa", "Guacamole", "Chimichurri", "Aioli", "Horseradish", "Fish Sauce", "Miso", "Hoisin", "Chili Oil", "Worcestershire", "Tzatziki"],
  },
  {
    name: "Luxury Brands",
    data: { description: "The most coveted luxury fashion houses", author: "seed" },
    items: ["Louis Vuitton", "Chanel", "Hermès", "Gucci", "Prada", "Bottega Veneta", "Burberry", "Dior", "Saint Laurent", "Valentino", "Balenciaga", "Givenchy", "Versace", "Fendi", "Celine", "Loewe", "Miu Miu", "Jacquemus", "The Row", "Loro Piana"],
  },
  {
    name: "Cacti Types",
    data: { description: "The spikiest ranking on the internet", author: "seed" },
    items: ["Saguaro", "Prickly Pear", "Barrel Cactus", "Christmas Cactus", "Moon Cactus", "Organ Pipe", "Cholla", "Golden Barrel", "Hedgehog Cactus", "Totem Pole", "Bunny Ears", "Old Man Cactus", "Fairy Castle", "Mammillaria", "Echinopsis", "Cereus", "Gymnocalycium", "Blue Myrtle", "Ferocactus", "Bishop's Cap"],
  },
  {
    name: "Cloud Types",
    data: { description: "Look up and vote", author: "seed" },
    items: ["Cumulus", "Stratus", "Cirrus", "Cumulonimbus", "Stratocumulus", "Nimbostratus", "Altostratus", "Altocumulus", "Cirrostratus", "Cirrocumulus", "Lenticular", "Mammatus", "Kelvin-Helmholtz", "Asperitas", "Contrails", "Pileus", "Virga", "Arcus", "Fog", "Pyrocumulus"],
  },
  {
    name: "Famous Houses",
    data: { description: "The most iconic buildings and residences ever built", author: "seed" },
    items: ["Fallingwater", "Villa Savoye", "Farnsworth House", "Glass House", "Monticello", "Versailles", "Hearst Castle", "Winchester Mystery House", "Graceland", "The Biltmore Estate", "Casa Milà", "Château de Chambord", "The Breakers", "Villa Rotonda", "Taliesin West", "Peterhof Palace", "Villa d'Este", "The Royal Pavilion", "Schloss Neuschwanstein", "Fallingwater"],
  },
  {
    name: "Window Types",
    data: { description: "Ranking windows. Yes, really.", author: "seed" },
    items: ["Casement", "Double-Hung", "Single-Hung", "Awning", "Hopper", "Sliding", "Bay", "Bow", "Picture", "Jalousie", "Transom", "Skylight", "Clerestory", "Oriel", "Fanlight", "Palladian", "Rose Window", "Porthole", "Fixed", "Egress"],
  },
  {
    name: "Cardcaptor Sakura Cards",
    data: { description: "Which Clow Card is the most powerful?", author: "seed" },
    items: ["The Windy", "The Watery", "The Fiery", "The Earthy", "The Wood", "The Shadow", "The Thunder", "The Fly", "The Jump", "The Shield", "The Sleep", "The Erase", "The Time", "The Move", "The Power", "The Fight", "The Sword", "The Mirror", "The Create", "The Arrow", "The Illusion", "The Song", "The Float", "The Flower", "The Mist", "The Sand", "The Snow", "The Storm", "The Wave", "The Light", "The Dark", "The Return", "The Loop", "The Change", "The Lock", "The Sweet", "The Little", "The Big", "The Through", "The Libra", "The Silent", "The Twin", "The Dash", "The Glow", "The Voice", "The Shot", "The Freeze", "The Bubbles", "The Maze", "The Cloud", "The Fate", "The Hope"],
  },
  {
    name: "Doraemon Inventions",
    data: { description: "Gadgets from the 4D pocket, ranked", author: "seed" },
    items: ["Anywhere Door", "Take-copter", "Small Light", "Big Light", "Memory Bread", "4D Pocket", "Translation Konjac", "Time Machine", "Pass Loop", "Air Cannon", "Invisible Mantle", "Clone Stamp", "Dream Viewer", "Weather Control Box", "Gourmet Tablecloth", "Restoring Ray", "Lie Detector", "Emotion Transmitter", "Shrink Ray", "Tiger Katana", "Moshimo Box", "Translator Jelly", "Helmet of Justice", "Instant Makeover Mirror", "Dokodemo Camera"],
  },
];

for (const list of lists) {
  const existing = db.query("SELECT id FROM lists WHERE name = ?").get([list.name]);
  if (existing) {
    console.log(`Skipping "${list.name}" — already exists`);
    continue;
  }

  db.query("INSERT INTO lists (name, data, password) VALUES (?, ?, ?)").run([
    list.name,
    JSON.stringify(list.data),
    password,
  ]);

  const { id: listId } = db.query("SELECT id FROM lists WHERE name = ?").get([list.name]) as any;

  for (const item of list.items) {
    db.query("INSERT OR IGNORE INTO items (list_id, name, data) VALUES (?, ?, ?)").run([
      listId,
      item,
      JSON.stringify({}),
    ]);
  }

  console.log(`Created "${list.name}" with ${list.items.length} items`);
}

console.log("Done.");

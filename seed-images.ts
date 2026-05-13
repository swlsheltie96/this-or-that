import { Database } from "bun:sqlite";

const db = new Database("lists.db");
db.exec("PRAGMA journal_mode=WAL;");

async function getWikipediaImage(title: string): Promise<string | null> {
  await new Promise((r) => setTimeout(r, 80));
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "EloChamber/1.0 (https://github.com/swlsheltie96)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.thumbnail?.source ?? null;
  } catch (e) {
    return null;
  }
}

function getSearchTitle(listName: string, itemName: string): string {
  switch (listName) {
    case "NYC Subway Lines": {
      const lineMap: Record<string, string> = {
        "1 Train": "IRT Broadway–Seventh Avenue Line",
        "2 Train": "IRT Broadway–Seventh Avenue Line",
        "3 Train": "IRT Broadway–Seventh Avenue Line",
        "4 Train": "IRT Lexington Avenue Line",
        "5 Train": "IRT Lexington Avenue Line",
        "6 Train": "IRT Lexington Avenue Line",
        "7 Train": "IRT Flushing Line",
        "A Train": "IND Eighth Avenue Line",
        "B Train": "IND Sixth Avenue Line",
        "C Train": "IND Eighth Avenue Line",
        "D Train": "IND Sixth Avenue Line",
        "E Train": "IND Queens Boulevard Line",
        "F Train": "IND Queens Boulevard Line",
        "G Train": "IND Crosstown Line",
        "J Train": "BMT Jamaica Line",
        "L Train": "BMT Canarsie Line",
        "M Train": "IND Queens Boulevard Line",
        "N Train": "BMT Broadway Line",
        "Q Train": "BMT Broadway Line",
        "R Train": "BMT Broadway Line",
        "W Train": "BMT Broadway Line",
        "Z Train": "BMT Jamaica Line",
        "S Shuttle": "42nd Street Shuttle",
      };
      return lineMap[itemName] ?? itemName;
    }
    case "Airports": {
      const parts = itemName.split(" - ");
      const name = parts.length > 1 ? parts[1] : itemName;
      const airportNames: Record<string, string> = {
        "John F. Kennedy": "John F. Kennedy International Airport",
        "Los Angeles": "Los Angeles International Airport",
        "Hartsfield-Jackson": "Hartsfield–Jackson Atlanta International Airport",
        "O'Hare": "O'Hare International Airport",
        "Dallas Fort Worth": "Dallas/Fort Worth International Airport",
        "Denver": "Denver International Airport",
        "San Francisco": "San Francisco International Airport",
        "Seattle-Tacoma": "Seattle–Tacoma International Airport",
        "Miami": "Miami International Airport",
        "Logan": "Logan International Airport",
        "Heathrow": "Heathrow Airport",
        "Charles de Gaulle": "Charles de Gaulle Airport",
        "Narita": "Narita International Airport",
        "Dubai": "Dubai International Airport",
        "Changi": "Singapore Changi Airport",
        "Schiphol": "Amsterdam Airport Schiphol",
        "Frankfurt": "Frankfurt Airport",
        "Hong Kong": "Hong Kong International Airport",
        "Incheon": "Incheon International Airport",
        "Sydney": "Sydney Airport",
      };
      return airportNames[name] ?? `${name} Airport`;
    }
    case "Pasta Shapes": {
      const pastaMap: Record<string, string> = {
        "Spaghetti": "Spaghetti",
        "Rigatoni": "Rigatoni",
        "Penne": "Penne",
        "Fettuccine": "Fettuccine",
        "Farfalle": "Farfalle",
        "Orecchiette": "Orecchiette",
        "Tagliatelle": "Tagliatelle",
        "Bucatini": "Bucatini",
        "Fusilli": "Fusilli (pasta)",
        "Paccheri": "Paccheri",
        "Conchiglie": "Conchiglie",
        "Pappardelle": "Pappardelle",
        "Linguine": "Linguine",
        "Cavatappi": "Cavatappi",
        "Gemelli": "Gemelli (pasta)",
        "Tortellini": "Tortellini",
        "Ravioli": "Ravioli",
        "Lasagna": "Lasagna",
        "Gnocchi": "Gnocchi",
        "Radiatori": "Radiatori",
      };
      return pastaMap[itemName] ?? itemName;
    }
    case "Cacti Types": {
      const cactiMap: Record<string, string> = {
        "Saguaro": "Saguaro",
        "Prickly Pear": "Opuntia",
        "Barrel Cactus": "Barrel cactus",
        "Christmas Cactus": "Schlumbergera",
        "Moon Cactus": "Gymnocalycium mihanovichii",
        "Organ Pipe": "Stenocereus thurberi",
        "Cholla": "Cylindropuntia",
        "Golden Barrel": "Echinocactus grusonii",
        "Hedgehog Cactus": "Echinocereus",
        "Totem Pole": "Pachycereus schottii",
        "Bunny Ears": "Opuntia microdasys",
        "Old Man Cactus": "Cephalocereus senilis",
        "Fairy Castle": "Acanthocereus tetragonus",
        "Mammillaria": "Mammillaria",
        "Echinopsis": "Echinopsis",
        "Cereus": "Cereus (plant)",
        "Gymnocalycium": "Gymnocalycium",
        "Blue Myrtle": "Myrtillocactus geometrizans",
        "Ferocactus": "Ferocactus",
        "Bishop's Cap": "Astrophytum myriostigma",
      };
      return cactiMap[itemName] ?? itemName;
    }
    case "Cloud Types": {
      const cloudMap: Record<string, string> = {
        "Cumulus": "Cumulus cloud",
        "Stratus": "Stratus cloud",
        "Cirrus": "Cirrus cloud",
        "Cumulonimbus": "Cumulonimbus cloud",
        "Stratocumulus": "Stratocumulus cloud",
        "Nimbostratus": "Nimbostratus cloud",
        "Altostratus": "Altostratus cloud",
        "Altocumulus": "Altocumulus cloud",
        "Cirrostratus": "Cirrostratus cloud",
        "Cirrocumulus": "Cirrocumulus cloud",
        "Lenticular": "Lenticular cloud",
        "Mammatus": "Mammatus cloud",
        "Kelvin-Helmholtz": "Kelvin–Helmholtz instability",
        "Asperitas": "Asperitas cloud",
        "Contrails": "Contrail",
        "Pileus": "Pileus (meteorology)",
        "Virga": "Virga",
        "Arcus": "Arcus cloud",
        "Fog": "Fog",
        "Pyrocumulus": "Pyrocumulus cloud",
      };
      return cloudMap[itemName] ?? itemName;
    }
    case "Famous Houses": {
      const houseMap: Record<string, string> = {
        "Fallingwater": "Fallingwater",
        "Villa Savoye": "Villa Savoye",
        "Farnsworth House": "Farnsworth House",
        "Glass House": "Glass House",
        "Monticello": "Monticello",
        "Versailles": "Palace of Versailles",
        "Hearst Castle": "Hearst Castle",
        "Winchester Mystery House": "Winchester Mystery House",
        "Graceland": "Graceland",
        "The Biltmore Estate": "Biltmore Estate",
        "Casa Milà": "Casa Milà",
        "Château de Chambord": "Château de Chambord",
        "The Breakers": "The Breakers",
        "Villa Rotonda": "Villa La Rotonda",
        "Taliesin West": "Taliesin West",
        "Peterhof Palace": "Peterhof Palace",
        "Villa d'Este": "Villa d'Este",
        "The Royal Pavilion": "Royal Pavilion",
        "Schloss Neuschwanstein": "Neuschwanstein Castle",
      };
      return houseMap[itemName] ?? itemName;
    }
    case "Window Types": {
      const windowMap: Record<string, string> = {
        "Casement": "Casement window",
        "Double-Hung": "Double-hung window",
        "Single-Hung": "Single-hung window",
        "Awning": "Awning window",
        "Hopper": "Hopper window",
        "Sliding": "Sliding glass door",
        "Bay": "Bay window",
        "Bow": "Bow window",
        "Picture": "Picture window",
        "Jalousie": "Jalousie window",
        "Transom": "Transom (architecture)",
        "Skylight": "Skylight",
        "Clerestory": "Clerestory",
        "Oriel": "Oriel window",
        "Fanlight": "Fanlight",
        "Palladian": "Palladian window",
        "Rose Window": "Rose window",
        "Porthole": "Porthole",
        "Fixed": "Fixed window",
        "Egress": "Egress window",
      };
      return windowMap[itemName] ?? itemName;
    }
    case "Luxury Brands": {
      const brandMap: Record<string, string> = {
        "Louis Vuitton": "Louis Vuitton",
        "Chanel": "Chanel",
        "Hermès": "Hermès",
        "Gucci": "Gucci",
        "Prada": "Prada",
        "Bottega Veneta": "Bottega Veneta",
        "Burberry": "Burberry",
        "Dior": "Christian Dior SE",
        "Saint Laurent": "Yves Saint Laurent (brand)",
        "Valentino": "Valentino SpA",
        "Balenciaga": "Balenciaga",
        "Givenchy": "Givenchy",
        "Versace": "Versace",
        "Fendi": "Fendi",
        "Celine": "Céline (brand)",
        "Loewe": "Loewe",
        "Miu Miu": "Miu Miu",
        "Jacquemus": "Jacquemus",
        "The Row": "The Row (fashion label)",
        "Loro Piana": "Loro Piana",
      };
      return brandMap[itemName] ?? itemName;
    }
    case "Condiments": {
      const condimentMap: Record<string, string> = {
        "Ketchup": "Ketchup",
        "Mustard": "Mustard (condiment)",
        "Mayonnaise": "Mayonnaise",
        "Hot Sauce": "Hot sauce",
        "Ranch": "Ranch dressing",
        "Sriracha": "Sriracha",
        "Soy Sauce": "Soy sauce",
        "Balsamic Glaze": "Balsamic vinegar",
        "Tahini": "Tahini",
        "Salsa": "Salsa (sauce)",
        "Guacamole": "Guacamole",
        "Chimichurri": "Chimichurri",
        "Aioli": "Aioli",
        "Horseradish": "Horseradish",
        "Fish Sauce": "Fish sauce",
        "Miso": "Miso",
        "Hoisin": "Hoisin sauce",
        "Chili Oil": "Chili oil",
        "Worcestershire": "Worcestershire sauce",
        "Tzatziki": "Tzatziki",
      };
      return condimentMap[itemName] ?? itemName;
    }
    case "Fast Food Chains": {
      const fastFoodMap: Record<string, string> = {
        "McDonald's": "McDonald's",
        "Chick-fil-A": "Chick-fil-A",
        "In-N-Out Burger": "In-N-Out Burger",
        "Wendy's": "Wendy's",
        "Burger King": "Burger King",
        "Taco Bell": "Taco Bell",
        "Chipotle": "Chipotle Mexican Grill",
        "Five Guys": "Five Guys",
        "Shake Shack": "Shake Shack",
        "Popeyes": "Popeyes",
        "KFC": "KFC",
        "Subway": "Subway (restaurant)",
        "Panda Express": "Panda Express",
        "Domino's": "Domino's Pizza",
        "Pizza Hut": "Pizza Hut",
        "Whataburger": "Whataburger",
        "Sonic": "Sonic Drive-In",
        "Wingstop": "Wingstop",
        "Jersey Mike's": "Jersey Mike's Subs",
        "Raising Cane's": "Raising Cane's Chicken Fingers",
      };
      return fastFoodMap[itemName] ?? itemName;
    }
    case "Common Sandwiches": {
      const sandwichMap: Record<string, string> = {
        "Reuben": "Reuben sandwich",
        "PB&J": "Peanut butter and jelly sandwich",
        "Tuna Melt": "Tuna melt sandwich",
        "Philly Cheesesteak": "Cheesesteak",
        "Pulled Pork": "Pulled pork",
        "Egg Salad": "Egg salad",
        "French Dip": "French dip sandwich",
        "Cubano": "Cuban sandwich",
        "Meatball Sub": "Meatball sandwich",
        "Veggie Wrap": "Wrap (food)",
        "Caprese": "Caprese salad",
        "Lobster Roll": "Lobster roll",
        "Italian Sub": "Submarine sandwich",
        "Croque Monsieur": "Croque monsieur",
      };
      return sandwichMap[itemName] ?? itemName;
    }
    case "Types of Beans": {
      const beanMap: Record<string, string> = {
        "Adzuki Bean": "Vigna angularis",
        "Black-Eyed Pea": "Black-eyed pea",
        "Great Northern Bean": "Phaseolus vulgaris",
        "Butter Bean": "Lima bean",
      };
      return beanMap[itemName] ?? itemName;
    }
    case "US National Parks": {
      const parkMap: Record<string, string> = {
        "Olympic": "Olympic National Park",
        "Sequoia": "Sequoia National Park",
        "Shenandoah": "Shenandoah National Park",
      };
      return parkMap[itemName] ?? itemName;
    }
    case "Cardcaptor Sakura Cards":
      // These don't have individual Wikipedia pages — skip
      return "";
    case "Doraemon Inventions": {
      const doraemonMap: Record<string, string> = {
        "Anywhere Door": "Anywhere Door",
        "Take-copter": "Takecopter",
        "Small Light": "Small Light (Doraemon)",
        "Big Light": "Small Light (Doraemon)",
        "Memory Bread": "Memory bread",
        "4D Pocket": "Four-dimensional pocket",
        "Time Machine": "Time machine",
        "Pass Loop": "Pass Loop",
        "Air Cannon": "Air cannon",
        "Invisible Mantle": "Mantle of invisibility",
        "Dream Viewer": "Dream",
        "Lie Detector": "Polygraph",
        "Shrink Ray": "Shrink ray",
        "Gourmet Tablecloth": "Gourmet Tablecloth",
      };
      return doraemonMap[itemName] ?? "";
    }
    default:
      return itemName;
  }
}

const lists = db.query("SELECT id, name FROM lists").all() as Array<{ id: number; name: string }>;

for (const list of lists) {
  const items = db.query("SELECT id, name, data FROM items WHERE list_id = ?").all([list.id]) as Array<{
    id: number;
    name: string;
    data: string;
  }>;

  const needsImages = items.filter((i) => {
    const d = i.data ? JSON.parse(i.data) : {};
    return !d.picture;
  });

  if (needsImages.length === 0) continue;

  console.log(`\n${list.name} (${needsImages.length} missing)`);

  for (const item of needsImages) {
    const title = getSearchTitle(list.name, item.name);
    if (!title) {
      console.log(`  – ${item.name} (skipped)`);
      continue;
    }

    const imageUrl = await getWikipediaImage(title);
    const currentData = item.data ? JSON.parse(item.data) : {};

    if (imageUrl) {
      currentData.picture = imageUrl;
      let retries = 5;
      while (retries-- > 0) {
        try {
          db.query("UPDATE items SET data = ? WHERE id = ?").run([JSON.stringify(currentData), item.id]);
          break;
        } catch (e: any) {
          if (e?.code === "SQLITE_BUSY" && retries > 0) await new Promise(r => setTimeout(r, 200));
          else throw e;
        }
      }
      console.log(`  ✓ ${item.name}`);
    } else {
      console.log(`  ✗ ${item.name}`);
    }
  }
}

console.log("\nDone!");

function findObjectDifference(oldList, newList) {
  const oldMap = new Map();
  const newMap = new Map();

  // Create a map for the old list with "name" as the key
  for (const item of oldList) {
    oldMap.set(item.name, item);
  }

  // Create a map for the new list with "name" as the key
  for (const item of newList) {
    newMap.set(item.name, item);
  }

  const added = [];
  const removed = [];
  const updated = [];

  // Check for added and updated items
  for (const [name, newItem] of newMap) {
    const oldItem = oldMap.get(name);

    if (!oldItem) {
      // Item is present in the new list but not in the old list (added)
      added.push(newItem);
    } else if (!isObjectEqual(oldItem, newItem)) {
      // Item is present in both lists but has changed (updated)
      updated.push(newItem);
    }
  }

  // Check for removed items
  for (const [name, oldItem] of oldMap) {
    if (!newMap.has(name)) {
      // Item is present in the old list but not in the new list (removed)
      removed.push(oldItem);
    }
  }

  return {
    added,
    removed,
    updated,
  };
}

function isObjectEqual(objA, objB) {
  // Compare the "picture" and "description" fields for equality
  return objA.picture === objB.picture && objA.description === objB.description;
}

function createButton(existing, buttonTxt_Id, clickHandler) {
  if (!existing) {
    const button = document.createElement("button");
    button.type = type;
    button.textContent = buttonTxt_Id;
    button.addEventListener("click", clickHandler);
    return button;
  } else {
    const button = document.getElementById(buttonTxt_Id);
    if (button) {
      button.addEventListener("click", clickHandler);
    } else {
      console.error("button or parent does not exist");
    }
  }
}

let dirty = false;
window.addEventListener("load", async () => {
  const listContainer = document.getElementById("listContainer");
  const queryString = window.location.search;
  const searchParams = new URLSearchParams(queryString);
  const listName = searchParams.get(`listName`);

  getListInfo(listName).then((d) => {
    document.getElementById("listName").value = listName;
    document.getElementById("listDescription").value = d.description;
    document.getElementById("listPrompt").value = d.prompt;
  });
  getSortedList(listName).then((list) => {
    async function save() {
      const diffs = findObjectDifference(initial_data, table.getData());
      for (let row of diffs.removed) {
        await deleteItem(listName, row.name);
      }
      for (let row of diffs.added) {
        await addItem(listName, rowToItem(row));
      }
      for (let row of diffs.updated) {
        await deleteItem(listName, row.name);
        await addItem(listName, rowToItem(row));
      }
      const saveButtons = document.querySelectorAll(".saveButton");
      Array.from(saveButtons).map((b) => {
        b.style.fontWeight = "normal";
      });
      dirty = false;
    }

    listContainer.innerHTML = ""; // Clear the existing table

    let initial_data = list.map((d) => {
      return {
        name: d.name,
        picture: d.data.picture,
        description: d.data.description,
        elo: d.elo,
      };
    });
    const table = new Tabulator("#listContainer", {
      height: "100%", // set height of table (in CSS or here), this enables the Virtual DOM and improves render speed dramatically (can be any valid css height value)
      data: initial_data.map((x) => Object.assign({}, x)),
      layout: "fitColumns", //fit columns to width of table (optional)
      columns: [
        //Define Table Columns
        {
          title: "Item",
          field: "name",
          editor: "input",
        },
        {
          title: "Picture",
          field: "picture",
          editor: "input",
        },
        {
          title: "Description",
          field: "description",
          editor: "input",
        },
        {
          title: "Elo",
          field: "elo",
        },
        {
          formatter: "buttonCross",
          width: 40,
          align: "center",
          cellClick: function (e, cell) {
            cell.getRow().delete();
          },
        },
      ],
      tabEndNewRow: true,
      clipboard: true,
      clipboardPasteAction: "update",
      history: true,
    });
    table.on("dataChanged", function (data) {
      const diffs = findObjectDifference(initial_data, table.getData());
      if (diffs.added.length || diffs.removed.length || diffs.updated.length) {
        dirty = true;
        const saveButtons = document.querySelectorAll(".saveButton");
        Array.from(saveButtons).map((b) => {
          b.style.fontWeight = "bold";
        });
      } else {
        dirty = false;
        const saveButtons = document.querySelectorAll(".saveButton");
        Array.from(saveButtons).map((b) => {
          b.style.fontWeight = "normal";
        });
      }
    });

    const viewButton = document.getElementById("viewButton");
    const voteButton = document.getElementById("voteButton");
    viewButton.href = `grid.html?listName=${listName}`;
    voteButton.href = `vote.html?listName=${listName}`;

    const addItemButton = document.getElementById("addItemButton");
    addItemButton.addEventListener("click", () => {
      table.addRow();
    });
    const saveButtons = document.querySelectorAll(".saveButton");

    function rowToItem(row) {
      return {
        name: row.name,
        data: {
          picture: row.picture,
          description: row.description,
        },
      };
    }
    Array.from(saveButtons).map((b) => {
      b.addEventListener("click", save);
    });
  });
});

window.addEventListener("beforeunload", function (e) {
  if (!dirty) {
    return undefined;
  }

  var confirmationMessage =
    "It looks like you have been editing something. " +
    "If you leave before saving, your changes will be lost.";

  (e || window.event).returnValue = confirmationMessage; //Gecko + IE
  return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
});

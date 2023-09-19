//DATABASE EDITING FUNCTIONS

function deleteItem(listName, elName, listBody) {
  const inputtedPassword = document.getElementById("confirmedPassword").value;

  fetch("/delete-item", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName,
      itemName: elName,
      password: inputtedPassword,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      // Handle the response from the server here
    })
    .catch((error) => {
      console.error("Error:", error);
    });

  getList(listName)
    .then((data) => {
      listBody.innerHTML = ""; // Clear the existing table
      makeList(data.list, listName, listBody); // Rebuild the table with updated data
    })
    .catch((error) => {
      console.error("Error fetching updated data:", error);
    });
}

function saveAll(listName, listBody) {
  const inputtedPassword = document.getElementById("confirmedPassword").value;
  const fetchPromises = [];

  listBody.querySelectorAll(".listRow.unsaved").forEach((row) => {
    const unsavedRow = {
      name: row.querySelector("#nameInput").value,
      picture: row.querySelector("#pictureInput").value,
    };

    const fetchPromise = fetch("/add-item", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        listName,
        item: {
          name: unsavedRow.name,
          data: {
            image: unsavedRow.picture,
          },
        },
        password: inputtedPassword,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          console.error(data.error);
        } else {
          console.log(data.message);
          listBody.removeChild(row);
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
    fetchPromises.push(fetchPromise);
  });

  Promise.all(fetchPromises)
    .then(() => {
      getList(listName).then((data) => {
        makeList(data.list, listName, listBody);
      });
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function saveItem(listName, listBody, itemName, itemPicture) {
  const inputtedPassword = document.getElementById("confirmedPassword").value;
  const newItemName = itemNameInput.value;
  const newItemPicture = pictureInput.value;

  console.log("saving", newItemName, newItemPicture);

  fetch("/add-item", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName,
      item: {
        name: newItemName,
        data: {
          image: newItemPicture,
        },
      },
      password: inputtedPassword,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        console.error(data.error);
      } else {
        console.log(data.message);
        listBody.removeChild(newRow);

        //if anything else is unsaved, store that, and regenerate it
        const unsavedRows = [];
        listBody.querySelectorAll(".listRow.unsaved").forEach((row) => {
          const unsavedRow = {
            name: row.querySelector("#nameInput").value,
            picture: row.querySelector("#pictureInput").value,
          };
          unsavedRows.push(unsavedRow);
        });

        getList(listName)
          .then((data) => {
            listBody.innerHTML = ""; // Clear the existing table
            makeList(data.list, listName, listBody);

            unsavedRows.forEach((row) => {
              addRow(listName, listBody, row.name, row.picture);
            });
          })
          .catch((error) => {
            console.error("Error fetching updated data:", error);
          });
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

//LIST GETTERS

async function getList(listName) {
  const response = await fetch(
    `/get-sorted-list?listName=${encodeURIComponent(listName)}`
  );
  const data = await response.json();
  console.log(data);
  return data;
}

function makeList(data, listName, listBody) {
  const listTitle = document.getElementById("listName");
  listTitle.textContent = listName;
  let hasImage = false;

  listBody.innerHTML = ""; // Clear the existing table

  data.forEach((element, index) => {
    const listItem = document.createElement("div");
    listItem.classList.add("listRow");

    const deleteCell = document.createElement("div");
    deleteCell.classList.add("listCell", "delete");
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      deleteItem(listName, element.name, listBody);
    });
    deleteCell.appendChild(deleteButton);

    const rankCell = createCell("listCell", index + 1);
    const itemCell = createCell("listCell", element.name || "");
    const eloCell = createCell("listCell", element.elo || "");
    const pictureCell = createCell("listCell");

    if (element.data && element.data.image) {
      const image = document.createElement("img");
      image.src = element.data.image;
      pictureCell.appendChild(image);
      hasImage = true;
    }

    const saveCell = document.createElement("div");
    saveCell.classList.add("listCell", "save");

    listItem.appendChild(deleteCell);
    listItem.appendChild(rankCell);
    listItem.appendChild(itemCell);
    listItem.appendChild(eloCell);
    listItem.appendChild(pictureCell);
    listItem.appendChild(saveCell);

    listBody.appendChild(listItem);
  });
}

//DOM CREATION

function createCell(className, text = "") {
  const cell = document.createElement("div");
  cell.classList.add(className);
  cell.textContent = text;
  return cell;
}

function addRow(listName, listBody, unsavedName = "", unsavedPicture = "") {
  const newRow = document.createElement("div");
  newRow.classList.add("listRow", "unsaved");

  // Create and append the cells
  const deleteCell = createCell("listCell", "");
  const rankCell = createCell("listCell");
  const itemCell = createCell("listCell");
  const itemNameInput = createInput(
    "text",
    "nameInput",
    unsavedName || "Item Name"
  );
  const eloCell = createCell("listCell", "");
  const pictureCell = createCell("listCell");
  const pictureInput = createInput(
    "text",
    "pictureInput",
    unsavedPicture || "Picture URL"
  );
  const saveCell = createCell("listCell", "");

  const cancelButton = createButton(false, "Cancel", () => {
    listBody.removeChild(newRow);
  });

  const saveButton = createButton(false, "Save", () => {
    saveItem(listName, listBody, unsavedName, unsavedPicture);
  });

  deleteCell.appendChild(cancelButton);
  pictureCell.appendChild(pictureInput);
  saveCell.appendChild(saveButton);

  newRow.appendChild(deleteCell);
  newRow.appendChild(rankCell);
  newRow.appendChild(itemCell);
  newRow.appendChild(eloCell);
  newRow.appendChild(pictureCell);
  newRow.appendChild(saveCell);

  listBody.appendChild(newRow);
}

function createInput(type, id, placeholder) {
  const input = document.createElement("input");
  input.type = type;
  input.id = id;
  input.placeholder = placeholder;
  return input;
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

window.addEventListener("load", async () => {
  const listContainer = document.getElementById("listContainer");
  const queryString = window.location.search;
  const searchParams = new URLSearchParams(queryString);
  const listName = searchParams.get("listName");

  getList(listName).then((data) => {
    listContainer.innerHTML = ""; // Clear the existing table

    const table = new Tabulator("#listContainer", {
      height: "100%", // set height of table (in CSS or here), this enables the Virtual DOM and improves render speed dramatically (can be any valid css height value)
      data: data.list.map((d) => ({name: d.name, picture: null})), //assign data to table
      layout: "fitColumns", //fit columns to width of table (optional)
      columns: [
        //Define Table Columns
        { title: "Item", field: "name", editor: "input" },
        { title: "Picture", field: "picture", editor: "input" },
        { title: "Elo", field: "elo" },
      ],
      tabEndNewRow: true,
      clipboard: true,
      clipboardPasteAction: "update",
      history: true,
    });
    table.on("dataChanged", function(data){
      console.log('datachange', data);
    });
  });

  const backButton = document.getElementById("backButton");
  backButton.href = "index.html";
  const voteButton = document.getElementById("voteButton");
  voteButton.addEventListener("click", () => {
    window.location.href = `vote.html?listName=${listName}`;
  });

  const editButton = document.getElementById("editButton");
  const editList = document.querySelector(".editList");

  editButton.addEventListener("click", () => {
    // Create an input element
    const inputElement = document.createElement("input");
    const hiddenElement = document.createElement("input");
    hiddenElement.type = "hidden";
    inputElement.type = "text";

    inputElement.placeholder = "Input password here to edit the list"; // Set the initial value
    hiddenElement.name = "hiddenPassword";
    hiddenElement.id = "hiddenPassword";

    // Create an "Enter" button
    const enterButton = document.createElement("button");
    enterButton.textContent = "Enter";

    // Replace the "Edit List" button with the input and "Enter" button
    editList.replaceChild(inputElement, editButton);
    editList.appendChild(hiddenElement);
    editList.appendChild(enterButton);

    // Add an event listener for the "Enter" button
    enterButton.addEventListener("click", () => {
      // Retrieve the entered value
      const password = inputElement.value;

      const data = {
        listName: listName,
        password: password,
      };

      fetch("/check-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
        .then((response) => response.json())
        .then((data) => {
          // Handle the response from the server
          if (data.message) {
            console.log(data.message); // Password is valid
            let editButtons = document.querySelectorAll(".edit");
            let deleteButtons = document.querySelectorAll(".delete");
            let saveButtons = document.querySelectorAll(".save");
            editButtons.forEach((el) => {
              el.style.display = "inline";
            });
            deleteButtons.forEach((el) => {
              el.style.display = "block";
            });

            saveButtons.forEach((el) => {
              el.style.display = "block";
            });

            let tempPass = inputElement.value;
            hiddenElement.value = tempPass;
            hiddenElement.id = "confirmedPassword";
            inputElement.disabled = true;
            enterButton.style.display = "none";
          } else if (data.error) {
            console.error(data.error); // Invalid password or other errors
            // Add your logic for an invalid password or error here
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          // Handle network or server errors here
        });
    });
  });

  const addItemButton = document.getElementById("addItemButton");
  addItemButton.addEventListener("click", () => {
    addRow(listName, listContainer);
  });

  const saveAllButton = document.getElementById("saveAllButton");
  saveAllButton.addEventListener("click", () => {
    saveAll(listName, listContainer);
  });

  document.getElementById("addItemButtonTop").addEventListener("click", () => {
    addRow(listName, listContainer);
    listContainer.lastChild.scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("saveAllButtonTop").addEventListener("click", () => {
    saveAll(listName, listContainer);
  });
});

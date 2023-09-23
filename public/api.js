const server = window.location.origin;

class CookieManager {
  // Get a cookie by its name
  static getCookie(name) {
    const cookies = document.cookie.split('; ');
    for (const cookie of cookies) {
      const [cookieName, cookieValue] = cookie.split('=');
      if (cookieName === name) {
        return decodeURIComponent(cookieValue);
      }
    }
    return null;
  }

  // Set a cookie with a specified name, value, and optional options
  static setCookie(name, value, options = {}) {
    const { expires, path, domain, secure } = options;
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    
    if (expires instanceof Date) {
      cookieString += `; expires=${expires.toUTCString()}`;
    }
    if (path) {
      cookieString += `; path=${path}`;
    }
    if (domain) {
      cookieString += `; domain=${domain}`;
    }
    if (secure) {
      cookieString += '; secure';
    }
    
    document.cookie = cookieString;
  }

  // Delete a cookie by setting its expiration date to the past
  static deleteCookie(name) {
    const expirationDate = new Date(0);
    this.setCookie(name, '', { expires: expirationDate });
  }
}

function createCustomPrompt(prompt_text) {
    return new Promise((resolve, reject) => {
        // Create a form element
        const form = document.createElement('form');

        // Create a label and input field for the prompt
        const label = document.createElement('label');
        label.textContent = prompt_text;
        const input = document.createElement('input');
        input.type = 'text';
        input.required = true;

        // Create a submit button
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'Submit';

        // Append elements to the form
        form.appendChild(label);
        form.appendChild(input);
        form.appendChild(submitButton);

        // Handle form submission
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const userInput = input.value;
            resolve(userInput); // Resolve the promise with the user input
            document.body.removeChild(form); // Remove the form from the DOM
        });

        // Append the form to the body
        document.body.appendChild(form);
    });
}

async function login(listName) {
  const password = CookieManager.getCookie(listName);
  if (password) {
    return password;
  }
  const login_prompt = () => {
    const d = document.createElement('div');
    return new Promise
  };
  let possible_pw = await createCustomPrompt('Enter password:');
  while (possible_pw && !(await checkPassword(listName, possible_pw))) {
    possible_pw = await createCustomPrompt('Enter password:');
  }
  if (possible_pw) {
    CookieManager.setCookie(listName, possible_pw, { expires: new Date(Date.now() + 86400 * 1000), path: '/' });
    return possible_pw;
  }
  return '';
}

// Create a new list with a password
async function createList(listName, listData, password) {
  const response = await fetch(`${server}/create-list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      data: listData,
      password: password,
    }), // Include the password
  });
  const data = await response.json();
  return data;
}

// Check the password for a list
async function checkPassword(listName) {
  const password = await login(listName);
  const response = await fetch(`${server}/check-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      password: password,
    }),
  });
  const data = await response.json();
  return response.ok; // Return true if the password is valid, false otherwise
}

// Delete a list and its associated items with a password
async function deleteList(listName) {
  const password = await login(listName);
  const response = await fetch(`${server}/delete-list`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      password: password,
    }), // Include the password
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Add an item to a list with a password
async function addItem(listName, item) {
  const password = await login(listName);
  const response = await fetch(`${server}/add-item`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      item: item,
      password: password,
    }), // Include the password
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Delete an item from a list with a password
async function deleteItem(listName, itemName) {
  const password = await login(listName);
  const response = await fetch(`${server}/delete-item`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      itemName: itemName,
      password: password,
    }), // Include the password
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Get a random pair of items for voting
async function getPairForVoting(listName) {
  const response = await fetch(
    `${server}/get-pair?listName=${encodeURIComponent(listName)}`
  );
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

// Vote on a pair of items
async function vote(listName, winner, loser) {
  const response = await fetch(`${server}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      winner: winner,
      loser: loser,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

async function getSortedList(listName) {
  const response = await fetch(
    `${server}/get-sorted-list?listName=${encodeURIComponent(listName)}`
  );
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();

  if (response.ok) {
    return data.list.map((d) => ({
      name: d.name,
      elo: d.elo,
      data: d.data ? JSON.parse(d.data) : {},
    }));
  } else {
    console.error("Error:", data.error);
  }
  return null;
}

async function getListInfo(listName) {
  const response = await fetch(
    `${server}/get-list-info?listName=${encodeURIComponent(listName)}`
  );
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  if (response.ok) {
    return data;
  }
  console.error("Error:", data.error);
  return null;
}

// Function to test the get-lists endpoint
async function getListsWithPopularity() {
  const response = await fetch(`${server}/get-lists`);
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

// Change the password for a list
async function changePassword(listName, currentPassword, newPassword) {
  const response = await fetch(`${server}/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listName: listName,
      currentPassword: currentPassword, // Provide the current password
      newPassword: newPassword, // Provide the new password
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

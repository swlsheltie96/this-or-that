import * as api from './api';

const lists = {};
const stats = {
  getPair: { count: 0, time: 0},
  vote: { count: 0, time: 0},
  changePassword: { count: 0, time: 0},
  createList: { count: 0, time: 0},
  deleteList: { count: 0, time: 0},
  addItem: { count: 0, time: 0},
  deleteItem: { count: 0, time: 0},
  getSortedList: { count: 0, time: 0},
  getListsWithPopularity: { count: 0, time: 0},
};

function genStr(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

async function track(name, fn) {
  stats[name].count += 1
  const t0 = performance.now();
  const out = await fn();
  const t1 = performance.now();
  stats[name].time += t1 - t0;
  return out;
}

async function randomVote(list) {
  const out = await track('getPair', async () => {
      try {
        return await api.getPairForVoting(list);
      } catch (e) {
        return null;
      }
  });
  // not enough items to vote with
  if (!out) {
    return;
  }
  const winner = Math.random() > 0.5;
  const a = winner ? out.item1 : out.item2;
  const b = winner ? out.item2 : out.item1;
  await track('vote', async () => {
    await api.vote(list, a.name, b.name);
  });
}


async function randomPasswordChange(list) {
  const cur_pwd = lists[list].password;
  const new_pwd = genStr(32);
  await track('changePassword', async () => {
  await api.changePassword(list, cur_pwd, new_pwd);
});
  lists[list].password = new_pwd; 
}

async function randomAddItem(list) {
  const item = genStr(32);
  const data = genStr(1024);
  await track('addItem', async () => {
      await api.addItem(list, { name: item, data: data }, lists[list].password);
  });
  lists[list].items.push(item);
}

async function randomDeleteItem(list) {
  const cur_items = lists[list].items;
  const cur_pwd = lists[list].password;
  const idx = Math.floor(Math.random() * cur_items.length);
  const item = cur_items[idx];
  await track('deleteItem', async () => {
    await api.deleteItem(list, item, cur_pwd);
  });
}

async function randomCreateList() {
  const list = genStr(64);
  const pwd = genStr(32);
  lists[list] = { items: [], password: pwd }
  await track('createList', async () => {
    await api.createList(list, pwd);
  });
  await randomAddItem(list);
  await randomAddItem(list);
}

async function deleteList(list) {
  await track('deleteList', async () => {
      await api.deleteList(list, lists[list].password);
  });
  delete lists[list];
}

function getRandomList() {
  const list_keys = Object.keys(lists);
  const list_key = list_keys[Math.floor(Math.random() * list_keys.length)]
  console.assert(lists[list_key].password);
  return list_key
}

async function randomActions() {
  if (!Object.keys(lists).length) {
    await randomCreateList();
  }
  if (Math.random() < 0.15) {
    await randomCreateList();
  }
  if (Math.random() < 0.7) {
    await randomAddItem(getRandomList());
  }
  if (Math.random() < 0.2) {
    await randomDeleteItem(getRandomList());
  }
  if (Math.random() < 0.8) {
    await randomVote(getRandomList());
  }
  if (Math.random() < 0.1) {
    await randomPasswordChange(getRandomList());
  }
  if (Math.random() < 0.5) {
    track('getSortedList', async () => {
        await api.getSortedList(getRandomList());
    });
  }
  if (Math.random() < 0.5) {
    track('getListsWithPopularity', async () => {
        await api.getListsWithPopularity();
    });
  }
  if (Math.random() < 0.1) {
    await deleteList(getRandomList());
  }
}

async function cleanup() {
  for (let list of Object.keys(lists)) {
    await api.deleteList(list, lists[list].password);
  }
}

for (let i of api.viter(1000)) {
  await randomActions();
}

await cleanup();

for (let stat of Object.keys(stats)) {
  const obj = stats[stat];
  console.log(`${stat.padStart(25,' ')}: \t${obj.count * 1e3 / obj.time} iter/sec`)
}

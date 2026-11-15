// Economy: buy menu, weapon purchase, armour, grenades, income and loss bonus.
const SHOP = {
  'P9': { price: 0, type: 'weapon', label: 'P9 Dart' },
  'VX-9': { price: 1250, type: 'weapon', label: 'VX-9 SMG' },
  'AR-4': { price: 2900, type: 'weapon', label: 'AR-4 Rifle' },
  'Mako': { price: 1800, type: 'weapon', label: 'Mako Shotgun' },
  'Kevlar': { price: 650, type: 'armour', label: 'Kevlar Vest' },
  'Helmet': { price: 1000, type: 'armour', label: 'Kevlar + Helmet' },
  'Frag': { price: 300, type: 'grenade', label: 'Frag Grenade' },
  'Defuse': { price: 400, type: 'kit', label: 'Defuse Kit' },
};

const STARTING_MONEY = 800;
const ROUND_INCOME = 300;
const KILL_REWARD = 325;
const MAX_LOSS_BONUS = 1400;
const LOSS_BONUS_INCREMENT = 500;

export function createEconomy(state) {
  state.economy = {
    lossStreak: 0,
  };

  const buyMenuEl = document.getElementById('buy-menu');
  const buyItemsEl = document.getElementById('buy-menu-items');
  let buyMenuOpen = false;
  let weaponRef = null;

  function canBuy(itemKey) {
    const item = SHOP[itemKey];
    if (!item) return false;
    if (state.player.money < item.price) return false;
    if (item.type === 'grenade' && state.player.grenades >= 1) return false;
    if (item.type === 'kit' && (state.player.team !== 'sentinel' || state.player.hasDefuseKit)) return false;
    return true;
  }

  function buy(itemKey, weapon) {
    const item = SHOP[itemKey];
    if (!item || !canBuy(itemKey)) return false;

    state.player.money -= item.price;

    if (item.type === 'weapon') {
      if (state.weapon.type !== itemKey) {
        state.weapon.switchTime = 0.4;
      }
      state.weapon.type = itemKey;
      weapon.refill(itemKey);
    } else if (item.type === 'armour') {
      if (itemKey === 'Kevlar') {
        state.player.armour = 100;
        state.player.hasHelmet = false;
      } else if (itemKey === 'Helmet') {
        state.player.armour = 100;
        state.player.hasHelmet = true;
      }
    } else if (item.type === 'grenade') {
      state.player.grenades = 1;
    } else if (item.type === 'kit') {
      state.player.hasDefuseKit = true;
    }

    renderBuyMenu();
    return true;
  }

  function renderBuyMenu() {
    buyItemsEl.innerHTML = '';
    for (const [key, item] of Object.entries(SHOP)) {
      if (item.type === 'kit' && state.player.team !== 'sentinel') continue;

      const li = document.createElement('li');
      const canAfford = canBuy(key);
      if (!canAfford) li.classList.add('disabled');

      const name = document.createElement('span');
      name.className = 'buy-item-name';
      name.textContent = item.label;

      const price = document.createElement('span');
      price.className = 'buy-item-price';
      price.textContent = item.price === 0 ? 'Free' : `$${item.price}`;

      if (item.type === 'weapon' && state.weapon.type === key) {
        const owned = document.createElement('span');
        owned.className = 'buy-item-owned';
        owned.textContent = '(Owned)';
        li.appendChild(name);
        li.appendChild(owned);
      } else {
        li.appendChild(name);
      }
      li.appendChild(price);

      li.dataset.itemKey = key;
      buyItemsEl.appendChild(li);
    }
  }

  function showBuyMenu() {
    buyMenuOpen = true;
    buyMenuEl.hidden = false;
    renderBuyMenu();
  }

  function hideBuyMenu() {
    buyMenuOpen = false;
    buyMenuEl.hidden = true;
  }

  function roundIncome(won, survived) {
    let income = ROUND_INCOME;
    if (!won) {
      state.economy.lossStreak = Math.min(4, state.economy.lossStreak + 1);
      income += Math.min(MAX_LOSS_BONUS, state.economy.lossStreak * LOSS_BONUS_INCREMENT);
    } else {
      state.economy.lossStreak = 0;
    }
    if (!survived) {
      state.weapon.type = 'P9';
    }
    state.player.money += income;
  }

  function killReward() {
    state.player.money += KILL_REWARD;
  }

  buyItemsEl.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li || li.classList.contains('disabled')) return;
    const key = li.dataset.itemKey;
    if (key && weaponRef) {
      buy(key, weaponRef);
    }
  });

  return {
    canBuy,
    buy,
    showBuyMenu,
    hideBuyMenu,
    roundIncome,
    killReward,
    isMenuOpen() {
      return buyMenuOpen;
    },
    setWeaponRef(ref) {
      weaponRef = ref;
    },
  };
}

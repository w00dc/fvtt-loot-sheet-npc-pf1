/**
 * Adapted for PF1 system from original module: https://github.com/jopeek/fvtt-loot-sheet-npc-5e
 */ 

window.require=function(name) { throw "Dummy require function!!" };

import { ActorSheetPFNPC } from "../../systems/pf1/module/actor/sheets/npc.js";
import { LootSheetActions } from "./scripts/actions.js";

class QuantityDialog extends Dialog {
  constructor(callback, options) {
    if (typeof(options) !== "object") {
      options = {};
    }

    let applyChanges = false;
    const chooseQuantity = 'quantity' in options ? "" : '<input type=number min="1" id="quantity" name="quantity" value="1">'
    super({
      title: 'title' in options ? options['title'] : game.i18n.localize("ls.quantity"),
      content: `
            <form>
                <div class="form-group">
                    <label>${'label' in options ? options['label'] : game.i18n.localize("ls.quantity")}</label>
                    ${chooseQuantity}
                </div>
            </form>`,
      buttons: {
        yes: {
          icon: "<i class='fas fa-check'></i>",
          label: options.acceptLabel ? options.acceptLabel : game.i18n.localize("ls.accept"),
          callback: () => applyChanges = true
        },
        no: {
          icon: "<i class='fas fa-times'></i>",
          label: game.i18n.localize("ls.cancel")
        },
      },
      default: "yes",
      close: () => {
        if (applyChanges) {
          var quantity = Number('quantity' in options ? options['quantity'] : document.getElementById('quantity').value)

          if (isNaN(quantity)) {
            console.log("Loot Sheet | Item quantity invalid");
            return ui.notifications.error(game.i18n.localize("ERROR.lsItemInvalidQuantity"));
          }

          callback(quantity);

        }
      }
    });
  }
}

class LootSheetPf1NPC extends ActorSheetPFNPC {

  static SOCKET = "module.lootsheetnpcpf1";

  get template() {
    // adding the #equals and #unequals handlebars helper
    Handlebars.registerHelper('equals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('unequals', function(arg1, arg2, options) {
      return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('lootsheetprice', function(basePrice, modifier) {
      return Math.round(basePrice * modifier * 100) / 100;
    });

    const path = "systems/pf1/templates/actors/";
    return "modules/lootsheetnpcpf1/template/npc-sheet.html";
  }

  static get defaultOptions() {
    const options = super.defaultOptions;

    mergeObject(options, {
      classes: ["pf1 sheet actor npc npc-sheet loot-sheet-npc"],
      width: 850,
      height: 750
    });
    return options;
  }
  
  /**
   * Returns the loot price that the player is aware of
   */
  getLootPrice(item) {
    if(game.user.isGM || item.data.identified) {
      return item.data.price;
    }
    return LootSheetActions.getItemCost(item);
  }
  
  /**
   * Returns the loot name that the player knows
   */
  getLootName(item) {
    if(game.user.isGM || item.data.identified) {
      return item.name;
    }
    return LootSheetActions.getItemName(item);
  }

  async getData() {
    const sheetData = super.getData();

    // Prepare GM Settings
    this._prepareGMSettings(sheetData.actor);
    //console.log(sheetData)

    // Prepare isGM attribute in sheet Data

    //console.log("game.user: ", game.user);
    if (game.user.isGM) sheetData.isGM = true;
    else sheetData.isGM = false;
    //console.log("sheetData.isGM: ", sheetData.isGM);
    //console.log(this.actor);

    let lootsheettype = await this.actor.getFlag("lootsheetnpcpf1", "lootsheettype");
    if (!lootsheettype) await this.actor.setFlag("lootsheetnpcpf1", "lootsheettype", "Loot");
    //console.log(`Loot Sheet | Loot sheet type = ${lootsheettype}`);

    let rolltable = await this.actor.getFlag("lootsheetnpcpf1", "rolltable");
    //console.log(`Loot Sheet | Rolltable = ${rolltable}`);

    
    let priceModifier = 1.0;
    if (lootsheettype === "Merchant") {
      priceModifier = await this.actor.getFlag("lootsheetnpcpf1", "priceModifier");
      if (!priceModifier) await this.actor.setFlag("lootsheetnpcpf1", "priceModifier", 1.0);
      priceModifier = await this.actor.getFlag("lootsheetnpcpf1", "priceModifier");
    }
    
    let totalItems = 0
    let totalWeight = 0
    let totalPrice = 0
    let maxCapacity = await this.actor.getFlag("lootsheetnpcpf1", "maxCapacity") || 0;
    let maxLoad = await this.actor.getFlag("lootsheetnpcpf1", "maxLoad") || 0;
    
    Object.keys(sheetData.actor.features).forEach( f => sheetData.actor.features[f].items.forEach( i => {  
      totalItems += i.data.quantity
      totalWeight += i.data.quantity * i.data.weight
      totalPrice += i.data.quantity * LootSheetActions.getItemCost(i)
    }));

    sheetData.lootsheettype = lootsheettype;
    sheetData.rolltable = rolltable;
    sheetData.priceModifier = priceModifier;
    sheetData.rolltables = game.tables.entities;
    sheetData.canAct = game.user.playerId in sheetData.actor.permission && sheetData.actor.permission[game.user.playerId] == 2;
    sheetData.totalItems = totalItems
    sheetData.maxItems = maxCapacity > 0 ? " / " + maxCapacity : ""
    sheetData.itemsWarning = maxCapacity <= 0 || maxCapacity >= totalItems ? "" : "warn"
    sheetData.totalWeight = Math.ceil(totalWeight)
    sheetData.maxWeight = maxLoad > 0 ? " / " + maxLoad : ""
    sheetData.weightWarning = maxLoad <= 0 || maxLoad >= totalWeight ? "" : "warn"
    sheetData.totalPrice = totalPrice
    
    // Return data for rendering
    return sheetData;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers
  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  async activateListeners(html) {
    //console.log("Loot Sheet | activateListeners")
    super.activateListeners(html);
    
    const moduleNamespace = "lootsheetnpcpf1";
    const dragEnabled = await this.actor.getFlag(moduleNamespace, "dragEnabled");
    if(!dragEnabled) {    
      // Remove dragging capability
      let handler = ev => this._onDragItemStart(ev);
      html.find('li.item').each((i, li) => {
        if ( li.classList.contains("inventory-header") ) return;
        li.setAttribute("draggable", false);
        li.removeEventListener("dragstart", handler);
      });
    }
    
    if (this.options.editable) {
      // Toggle Permissions
      html.find('.permission-proficiency').click(ev => this._onCyclePermissionProficiency(ev));

      // Split Coins
      html.find('.split-coins').click(ev => this._distributeCoins(ev));

      // Price Modifier
      html.find('.price-modifier').click(ev => this._priceModifier(ev));

      // Price Modifier
      html.find('.convert-loot').click(ev => this._convertLoot(ev));
      
      //html.find('.merchant-settings').change(ev => this._merchantSettingChange(ev));
      html.find('.update-inventory').click(ev => this._merchantInventoryUpdate(ev));
    }

    // Buy Item
    html.find('.item-buy').click(ev => this._buyItem(ev));

    // Loot Item
    html.find('.item-loot').click(ev => this._lootItem(ev));
  }

  /* -------------------------------------------- */

  /**
   * Handle merchant settings change
   * @private
   */
  async _merchantSettingChange(event, html) {
    event.preventDefault();
    console.log("Loot Sheet | Merchant settings changed", event);

    if(!game.user.isGM) {
      return;
    }
    
    const moduleNamespace = "lootsheetnpcpf1";
    const expectedKeys = ["rolltable", "shopQty", "itemQty"];

    let targetKey = event.target.name.split('.')[3];

    if (expectedKeys.indexOf(targetKey) === -1) {
      console.log(`Loot Sheet | Error changing stettings for "${targetKey}".`);
      return ui.notifications.error(game.i18n.format("ERROR.lsChangingSettingsFor", {name: targetKey}));
    }

    if (event.target.value) {
      await this.actor.setFlag(moduleNamespace, targetKey, event.target.value);
    } else {
      await this.actor.unsetFlag(moduleNamespace, targetKey, event.target.value);
    }
  }
  
  /* -------------------------------------------- */
  /*  Form Submission                             */
  /* -------------------------------------------- */

  _updateObject(event, formData) {
    super._updateObject(event, formData);
    let flags = Object.entries(formData).filter(e => e[0].startsWith("flags."));
    let actor = this.object
    for(let i=0; i<flags.length; i++) {
      const name = flags[i][0].split(".")
      const value = flags[i][1]
      if( name.length == 3 ) {
        actor.setFlag(name[1], name[2], value)
      }
    }
  }


  /* -------------------------------------------- */

  /**
   * Handle merchant inventory update
   * @private
   */
  async _merchantInventoryUpdate(event, html) {
    event.preventDefault();
    //console.log("Loot Sheet | _merchantInventoryUpdate")

    if(!game.user.isGM) {
      return;
    }
    
    console.log(this.actor)
    const moduleNamespace = "lootsheetnpcpf1";
    const rolltableName = await this.actor.getFlag(moduleNamespace, "rolltable");
    const shopQtyFormula = await this.actor.getFlag(moduleNamespace, "shopQty") || "1";
    const itemQtyFormula = await this.actor.getFlag(moduleNamespace, "itemQty") || "1";
    console.log(itemQtyFormula)

    if (!rolltableName || rolltableName.length == 0) {
      return ui.notifications.error(game.i18n.format("ERROR.lsChooseTable"));
    }
    
    let rolltable = game.tables.getName(rolltableName);
    if (!rolltable) {
      console.log(`Loot Sheet | No Rollable Table found with name "${rolltableName}".`);
      return ui.notifications.error(game.i18n.format("ERROR.lsNoRollableTableFound", {name: rolltableName}));
    }

    let clearInventory = game.settings.get("lootsheetnpcpf1", "clearInventory");

    if (clearInventory) {

      let currentItems = this.actor.data.items.map(i => i._id);
      await this.actor.deleteEmbeddedEntity("OwnedItem", currentItems);
      console.log(currentItems);
    }
    //return;
    let shopQtyRoll = new Roll(shopQtyFormula);

    shopQtyRoll.roll();
    console.log(`Loot Sheet | Adding ${shopQtyRoll.result} new items`);

    for (let i = 0; i < shopQtyRoll.result; i++) {
      const rollResult = rolltable.roll();
      console.log(rollResult);
      let newItem = game.items.get(rollResult.results[0].resultId);
      //console.log(newItem);
      if (!newItem || newItem === null) {
          
        for (const pack of game.packs) {
          if (pack.entity == "Item") {
            console.log(rollResult.results[0].resultId)
            newItem = await pack.getEntity(rollResult.results[0].resultId);
            if (newItem) {
              break;
            }
          }
        }
        if (!newItem || newItem === null) {
          console.log(`Loot Sheet | No item found "${rollResult.results[0].resultId}".`);
          return ui.notifications.error(`No item found "${rollResult.results[0].resultId}".`);
        }
      }

      let itemQtyRoll = new Roll(itemQtyFormula);
      itemQtyRoll.roll();
      console.log(`Loot Sheet | Adding ${itemQtyRoll.result} x ${newItem.name}`)
      newItem.data.data.quantity = itemQtyRoll.result;
      console.log(newItem)

      await this.actor.createEmbeddedEntity("OwnedItem", newItem);
    }
  }

  _createRollTable() {
    //console.log("Loot Sheet | _createRollTable")
    
    let type = "weapon";

    game.packs.map(p => p.collection);

    const pack = game.packs.find(p => p.collection === "pf1.items");

    let i = 0;

    let output = [];

    pack.getIndex().then(index => index.forEach(function(arrayItem) {
      var x = arrayItem._id;
      //console.log(arrayItem);
      i++;
      pack.getEntity(arrayItem._id).then(packItem => {

        if (packItem.type === type) {

          //console.log(packItem);

          let newItem = {
            "_id": packItem._id,
            "flags": {},
            "type": 1,
            "text": packItem.name,
            "img": packItem.img,
            "collection": "Item",
            "resultId": packItem._id,
            "weight": 1,
            "range": [
              i,
              i
            ],
            "drawn": false
          };

          output.push(newItem);

        }
      });
    }));

    return;
  }

  /* -------------------------------------------- */

  /**
   * Handle buy item
   * @private
   */
  _buyItem(event) {
    event.preventDefault();
    //console.log("Loot Sheet | _buyItem")

    let targetGm = null;
    game.users.forEach((u) => {
      if (u.isGM && u.active && u.viewedScene === game.user.viewedScene) {
        targetGm = u;
      }
    });

    if (!targetGm) {
      return ui.notifications.error(game.i18n.localize("ERROR.lsNoActiveGM"));
    }

    if (this.token === null) {
      return ui.notifications.error(game.i18n.localize("ERROR.lsPurchaseFromToken"));
    }
    if (game.user.actorId) {
      let itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
      let quantity = Number($(event.currentTarget).parents(".item").attr("data-item-quantity"));
      let itemName = $(event.currentTarget).parents(".item").find("h4").text()

      let options = { acceptLabel: game.i18n.localize("ls.purchase") }
      if(quantity == 1) {
        options['title'] = game.i18n.localize("ls.purchase")
        options['label'] = game.i18n.format("ls.buyContent", { item: itemName })
        options['quantity'] = 1
      } else {
        options['title'] = game.i18n.format("ls.buyTitle", { item: itemName })
      }
      
      let d = new QuantityDialog((quantity) => {
        const packet = {
          type: "buy",
          actorId: game.user.actorId,
          tokenId: this.token ? this.token.id : undefined,
          targetActorId: this.token ? undefined : this.actor.id,
          itemId: itemId,
          quantity: quantity,
          processorId: targetGm.id
        };
        console.log("LootSheetPf1", "Sending buy request to " + targetGm.name, packet);
        game.socket.emit(LootSheetPf1NPC.SOCKET, packet);
      }, options);
      d.render(true);
    } else {
      console.log("Loot Sheet | No active character for user");
      return ui.notifications.error(game.i18n.localize("ERROR.lsNoActiveCharacter"));
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle Loot item
   * @private
   */
  _lootItem(event) {
    event.preventDefault();
    //console.log("Loot Sheet | _lootItem")

    let targetGm = null;
    game.users.forEach((u) => {
      if (u.isGM && u.active && u.viewedScene === game.user.viewedScene) {
        targetGm = u;
      }
    });

    if (!targetGm) {
      return ui.notifications.error(game.i18n.localize("ERROR.lsNoActiveGM"));
    }

    if (game.user.actorId) {
      let itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
      let quantity = Number($(event.currentTarget).parents(".item").attr("data-item-quantity"));
      let itemName = $(event.currentTarget).parents(".item").find("h4").text()

      let options = { acceptLabel: game.i18n.localize("ls.loot") }
      if(quantity == 1) {
        options['title'] = game.i18n.localize("ls.loot")
        options['label'] = game.i18n.format("ls.lootContent", { item: itemName })
        options['quantity'] = 1
      } else {
        options['title'] = game.i18n.format("ls.lootTitle", { item: itemName })
      }
      
      let d = new QuantityDialog((quantity) => {
        const packet = {
          type: "loot",
          userId: game.user._id,
          actorId: game.user.actorId,
          tokenId: this.token ? this.token.id : undefined,
          targetActorId: this.token ? undefined : this.actor.id,
          itemId: itemId,
          quantity: quantity,
          processorId: targetGm.id
        };
        console.log("LootSheetPf1", "Sending loot request to " + targetGm.name, packet);
        game.socket.emit(LootSheetPf1NPC.SOCKET, packet);
      }, options);
      d.render(true);
    } else {
      console.log("Loot Sheet | No active character for user");
      return ui.notifications.error(game.i18n.localize("ERROR.lsNoActiveCharacter"));
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle price modifier.
   * @private
   */
  async _priceModifier(event) {
    event.preventDefault();
    //console.log("Loot Sheet | _priceModifier")

    let priceModifier = await this.actor.getFlag("lootsheetnpcpf1", "priceModifier");
    if (!priceModifier) priceModifier = 1.0;

    priceModifier = Math.round(priceModifier * 100);

    renderTemplate("modules/lootsheetnpcpf1/template/dialog-price-modifier.html", {'priceModifier': priceModifier}).then(html => {
      new Dialog({
        title: game.i18n.localize("ls.priceModifierTitle"),
        content: html,
        buttons: {
          one: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("ls.update"),
            callback: () => this.actor.setFlag("lootsheetnpcpf1", "priceModifier", document.getElementById("price-modifier-percent").value / 100)
          },
          two: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("ls.cancel"),
            callback: () => console.log("Loot Sheet | Price Modifier Cancelled")
          }
        },
        default: "two",
        close: () => console.log("Loot Sheet | Price Modifier Closed")
      }).render(true);
    });

  }
  
  /**
   * Handle conversion to loot. This function converts (and removes) all items
   * on the Loot Sheet into coins. Items are sold according to the normal rule
   * (50% or 100% for trade goods). Price is rounded. Unidentified items are
   * sold according to their unidentified price.
   * 
   * @private
   */
  async _convertLoot(event) {
    event.preventDefault();
    //console.log("Loot Sheet | _convertLoot")
     
    Dialog.confirm({
      title: game.i18n.localize("ls.convertLootTitle"),
      content: game.i18n.localize("ls.convertLootMessage"),
      yes: () => {
        let total = 0
        let deleteList = []
        this.actor.items.forEach( item  => {
            let itemCost = LootSheetActions.getItemCost(item.data)
            if( item.data.data.subType !== "tradeGoods" ) {
              itemCost = Math.round(itemCost / 2)
            }
            total += itemCost * item.data.data.quantity
            deleteList.push(item._id)
          }
        );
        
        let funds = duplicate(this.actor.data.data.currency)
        funds.gp += Math.round(total)
        
        this.actor.update({ "data.currency": funds });
        this.actor.deleteEmbeddedEntity("OwnedItem", deleteList)
      },
      no: () => {}
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle distribution of coins. This function splits all coins
   * into all characters/players that have "act" permissions.
   * 
   * @private
   */
  async _distributeCoins(event) {
    event.preventDefault();
    //console.log("Loot Sheet | Split Coins clicked");

    let actorData = this.actor.data
    let owners = [];
    //console.log("Loot Sheet | actorData", actorData);
    // Calculate owners
    for (let u in actorData.permission) {
      if (u != "default" && actorData.permission[u] == 2) {
        //console.log("Loot Sheet | u in actorData.permission", u);
        let player = game.users.get(u);
        if(player) {
          //console.log("Loot Sheet | player", player);
          let actor = game.actors.get(player.data.character);
          //console.log("Loot Sheet | actor", actor);
          if (actor !== null && (player.data.role === 1 || player.data.role === 2)) owners.push(actor);
        }
      }
    }

    //console.log("Loot Sheet | owners", owners);
    if (owners.length === 0) return;

    // Calculate split of currency
    let currencySplit = duplicate(actorData.data.currency);
    let altCurrencySplit = duplicate(actorData.data.altCurrency);
    let currencyRemains = duplicate(actorData.data.currency);
    let altCurrencyRemains = duplicate(actorData.data.altCurrency);
    //console.log("Loot Sheet | Currency data", currencySplit);
    for (let c in currencySplit) {
      if (owners.length) {
        currencySplit[c] = Math.floor(currencySplit[c] / owners.length);
        altCurrencySplit[c] = Math.floor(altCurrencySplit[c] / owners.length);
      } else {
        currencySplit[c] = 0
        altCurrencySplit[c] = 0
      }
        
      currencyRemains[c] -= currencySplit[c] * owners.length
      altCurrencyRemains[c] -= altCurrencySplit[c] * owners.length
    }
          
    let msg = [];
    for (let u of owners) {
      //console.log("Loot Sheet | u of owners", u);
      if (u === null) continue;

      msg = [];
      let currency = u.data.data.currency;
      let altCurrency = u.data.data.altCurrency;
      let newCurrency = duplicate(u.data.data.currency);
      let newAltCurrency = duplicate(u.data.data.altCurrency);

      //console.log("Loot Sheet | Current Currency", currency);
      for (let c in currency) {
        if (currencySplit[c]) {
          msg.push(game.i18n.format("ls.splitcoins", {quantity: currencySplit[c], currency: game.i18n.localize("ls." + c)}));
          newCurrency[c] = currency[c] + currencySplit[c];
        }
        if (altCurrencySplit[c]) {
          msg.push(game.i18n.format("ls.splitcoins", {quantity: altCurrencySplit[c], currency: game.i18n.localize("ls.wl_" + c)}));
          newAltCurrency[c] = altCurrency[c] + altCurrencySplit[c];
        }        
      }
      
      // Increase currency for players
      u.update({ 'data.currency': newCurrency, 'data.altCurrency': newAltCurrency });
      // Remove currency from loot actor.
      this.actor.update({ "data.currency": currencyRemains, "data.altCurrency": altCurrencyRemains });
      
      // Create chat message for coins received
      if (msg.length != 0) {
        let message = game.i18n.format("ls.receives", {actor: u.data.name});
        message += msg.join(",");
        ChatMessage.create({
          user: game.user._id,
          speaker: {
            actor: this.actor,
            alias: this.actor.name
          },
          content: message
        });
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle cycling permissions
   * @private
   */
  _onCyclePermissionProficiency(event) {
    event.preventDefault();
    //console.log("Loot Sheet | this.actor.data.permission", this.actor.data.permission);
    
    let actorData = this.actor.data;

    let field = $(event.currentTarget).siblings('input[type="hidden"]');

    let level = parseFloat(field.val());
    if (typeof level === undefined) level = 0;

    //console.log("Loot Sheet | current level " + level);

    const levels = [0, 1, 2]; //const levels = [0, 2, 3];

    let idx = levels.indexOf(level),
      newLevel = levels[(idx === levels.length - 1) ? 0 : idx + 1];

    //console.log("Loot Sheet | new level " + newLevel);

    let playerId = field[0].name;

    //console.log("Loot Sheet | Current actor: " + playerId);
    //console.log(`Current entity permissions are: ${JSON.stringify(this.actor.data.permission)}`);
    
    let permissions = duplicate(this.actor.data.permission)
    permissions[playerId] = newLevel;
    //console.log(`About to change permissions are: ${JSON.stringify(permissions)}`);
    this.actor.update( { permission: permissions }, {diff: false});    
    //console.log(`Newly changed entity permissions are: ${JSON.stringify(this.actor.data.permission)}`);
    this._onSubmit(event);
  }


  /* -------------------------------------------- */

  /**
   * Organize and classify Items for Loot NPC sheets
   * @private
   */
  _prepareItems(actorData) {
    console.log("Loot Sheet | _prepareItems")
    // Actions
    const features = {
      weapons: {
        label: game.i18n.localize("ls.weapons"),
        items: [],
        type: "weapon"
      },
      equipment: {
        label: game.i18n.localize("ls.equipment"),
        items: [],
        type: "equipment"
      },
      consumables: {
        label: game.i18n.localize("ls.consumables"),
        items: [],
        type: "consumable"
      },
      loot: {
        label: game.i18n.localize("ls.lootType"),
        items: [],
        type: "loot"
      },

    };
    
    actorData.actor.visible = this.actor.visible
    
    if (!this.actor.visible) {
      return;
    }

    //console.log("Loot Sheet | Prepare Items");
    
    // Iterate through items, allocating to containers
    for (let i of actorData.items) {
      i.img = i.img || DEFAULT_TOKEN;
      i.showPrice = this.getLootPrice(i)
      i.showName = this.getLootName(i)
      
      // Features
      if (i.type === "weapon") features.weapons.items.push(i);
      else if (i.type === "equipment") features.equipment.items.push(i);
      else if (i.type === "consumable") features.consumables.items.push(i);
      else if (i.type === "tool") features.tools.items.push(i);
      else if (["container", "backpack"].includes(i.type)) features.containers.items.push(i);
      else if (i.type === "loot") features.loot.items.push(i);
      else { continue }
    }

    // Assign and return
    actorData.actor.features = features;
  }


  /* -------------------------------------------- */


  /**
   * Get the font-awesome icon used to display the permission level.
   * @private
   */
  _getPermissionIcon(level) {
    const icons = {
      0: '<i class="far fa-circle"></i>',
      1: '<i class="fas fa-eye"></i>',
      2: '<i class="fas fa-check"></i>'
    };
    return icons[level];
  }

  /* -------------------------------------------- */

  /**
   * Get the font-awesome icon used to display the permission level.
   * @private
   */
  _getPermissionDescription(level) {
    //console.log("Loot Sheet | _getPermissionDescription")
    const description = {
      0: game.i18n.localize("ls.permissionNoaccess"),
      1: game.i18n.localize("ls.permissionLimited"),
      2: game.i18n.localize("ls.permissionObserver"),
    };
    return description[level];
  }

  /* -------------------------------------------- */

  /**
   * Prepares GM settings to be rendered by the loot sheet.
   * @private
   */
  _prepareGMSettings(actorData) {
    //console.log("Loot Sheet | _prepareGMSettings")

    const players = [],
      owners = [];
    let users = game.users.entities;

    //console.log("Loot Sheet _prepareGMSettings | actorData.permission", actorData.permission);

    for (let u of users) {
      //console.log("Loot Sheet | Checking user " + u.data.name, u);

      //check if the user is a player 
      if (u.data.role === 1 || u.data.role === 2) {

        // get the name of the primary actor for a player
        const actor = game.actors.get(u.data.character);
        //console.log("Loot Sheet | Checking actor", actor);

        if (actor) {

          u.actor = actor.data.name;
          u.actorId = actor.data._id;
          u.playerId = u.data._id;

          //Check if there are default permissions to the actor
          if (typeof actorData.permission.default !== "undefined") {

            //console.log("Loot Sheet | default permissions", actorData.permission.default);

            u.lootPermission = actorData.permission.default;

            if (actorData.permission.default === 2 && !owners.includes(actor.data._id)) {

              owners.push(actor.data._id);
            }

          } else {

            u.lootPermission = 0;
            //console.log("Loot Sheet | assigning 0 permission to hidden field");
          }

          //if the player has some form of permission to the object update the actorData
          if (u.data._id in actorData.permission && !owners.includes(actor.data._id)) {
            //console.log("Loot Sheet | Found individual actor permission");

            u.lootPermission = actorData.permission[u.data._id];
            //console.log("Loot Sheet | assigning " + actorData.permission[u.data._id] + " permission to hidden field");

            if (actorData.permission[u.data._id] === 2) {
              owners.push(actor.data._id);
            }
          }

          //Set icons and permission texts for html
          //console.log("Loot Sheet | lootPermission", u.lootPermission);
          u.icon = this._getPermissionIcon(u.lootPermission);
          u.lootPermissionDescription = this._getPermissionDescription(u.lootPermission);
          players.push(u);
        }
      }
    }

    // calculate the split of coins between all owners of the sheet.
    let currencySplit = duplicate(actorData.data.currency);
    let altCurrencySplit = duplicate(actorData.data.altCurrency);
    for (let c in currencySplit) {
      if (owners.length) {
        currencySplit[c] = Math.floor(currencySplit[c] / owners.length) + " / " + Math.floor(altCurrencySplit[c] / owners.length)
      } else {
        currencySplit[c] = "0"
      }
    }
    
    let loot = {}
    loot.warning = actorData.permission.default != 0
    loot.players = players;
    loot.ownerCount = owners.length;
    loot.currency = currencySplit;
    loot.altCurrency = altCurrencySplit;
    actorData.flags.loot = loot;
  }

  async _onDrop(event) {
    event.preventDefault();
    
    // Try to extract the data
    let data;
    let extraData = {};
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
      if (data.type !== "Item") return;
    } catch (err) {
      return false;
    }
    
    if (game.user.isGM) {
      let sourceActor = game.actors.get(data.actorId);
      let targetActor = this.token ? canvas.tokens.get(this.token.id).actor : this.actor;
      LootSheetActions.dropOrSellItem(game.user, targetActor, sourceActor, data.data._id)
    } 
    // users don't have the rights for the transaction => ask GM to do it
    else {
      let targetGm = null;
      game.users.forEach((u) => {
        if (u.isGM && u.active && u.viewedScene === game.user.viewedScene) {
          targetGm = u;
        }
      });
      
      if(targetGm && data.actorId && data.data && data.data._id) {
        const packet = {
          type: "drop",
          userId: game.user._id,
          actorId: data.actorId,
          itemId: data.data._id,
          tokenId: this.token ? this.token.id : undefined,
          targetActorId: this.token ? undefined : this.actor.id,
          processorId: targetGm.id
        };
        game.socket.emit(LootSheetPf1NPC.SOCKET, packet);
      }
    }
  }

}


/**
 * Register a hook 
 */
Hooks.on('preCreateOwnedItem', (actor, item, data) => {

  //console.log("Loot Sheet | actor", actor);
  //console.log("Loot Sheet | item", item);
  //console.log("Loot Sheet | data", data);

  if (!actor) throw new Error(`Parent Actor ${actor._id} not found`);

  // Check if Actor is an NPC
  if (actor.data.type === "character") return;

  // If the actor is using the LootSheetPf1NPC then check in the item
  if ((actor.data.flags.core || {}).sheetClass === "PF1.LootSheetPf1NPC") {

    // retrieve source
    let source = null;
    game.actors.forEach( function(a) {
      const entity = a.getEmbeddedEntity("OwnedItem", item._id);
      if (entity) {
        //console.log(`Entity ${item._id} found in actor ${a.name}`)
        source = a
      }
    });
    
    // user may not fill loot with items that are not attached to his actor
    if(!game.user.isGM && (!source || source._id != game.user.actorId) ) {
      ui.notifications.error(game.i18n.localize("ERROR.lsNotAutorizedToAdd"));
      return false;
    }
    
    // validate the type of item to be "moved" or "added"
    if(!["weapon","equipment","consumable","loot"].includes(item.type)) {
      ui.notifications.error(game.i18n.localize("ERROR.lsInvalidType"));
      return false;
    }
    
  } else return;

});

/**
 * Register drop action on actor
 */
Hooks.on('renderActorDirectory', (app, html, data) => {
  
  function giveItemTo(actorDestId, event) {
    event.preventDefault();
    
    // try to extract the data
    let data;
    let extraData = {};
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
      if (data.type !== "Item") return;
    } catch (err) {
      return false;
    }
    
    const giver = game.actors.get(data.actorId)
    const receiver = game.actors.get(actorDestId)
    const item = giver.getEmbeddedEntity("OwnedItem", data.data._id);
    
    // validate the type of item to be "moved" or "added"
    if(!["weapon","equipment","consumable","loot"].includes(item.type)) {
      ui.notifications.error(game.i18n.localize("ERROR.lsGiveInvalidType"));
      return false;
    }
    
    let targetGm = null;
    game.users.forEach((u) => {
      if (u.isGM && u.active && u.viewedScene === game.user.viewedScene) {
        targetGm = u;
      }
    });
    
    //if (data.actorId === actorDestId) {
    //  ui.notifications.error(game.i18n.localize("ERROR.lsWhyGivingToYourself"));
    //  console.log("Loot Sheet | Ignoring giving something to same person")
    //  return false;
    //}
    
    let options = {}
    if (data.actorId === actorDestId) {
      if(item.data.quantity == 1) {
        ui.notifications.error(game.i18n.localize("ERROR.lsWhyGivingToYourself"));
        console.log("Loot Sheet | Ignoring giving something to same person")
        return false;
      }
      options['title'] = game.i18n.localize("ls.giveTitleSplit");
      options['acceptLabel'] = game.i18n.localize("ls.split");
    } else if(item.data.quantity == 1) {
      options['title'] = game.i18n.localize("ls.give");
      options['label'] = game.i18n.format("ls.giveContentSingle", {item: item.name, actor: receiver.name });
      options['quantity'] = 1
      options['acceptLabel'] = game.i18n.localize("ls.give");
    } else {
      options['title'] = game.i18n.format("ls.giveTitle", {item: item.name, actor: receiver.name });
      options['label'] = game.i18n.localize("ls.giveContent");
      options['acceptLabel'] = game.i18n.localize("ls.give");
    }
    
    let d = new QuantityDialog((quantity) => {
    
      if( game.user.isGM ) {
        LootSheetActions.giveItem(game.user, data.actorId, actorDestId, data.data._id, quantity)
      } else {
        const packet = {
          type: "give",
          userId: game.user._id,
          actorId: data.actorId,
          itemId: data.data._id,
          targetActorId: actorDestId,
          processorId: targetGm.id,
          quantity: quantity
        };
        console.log(`Loot Sheet | Sending packet to ${actorDestId}`)
        game.socket.emit(LootSheetPf1NPC.SOCKET, packet);
      }
    }, options);
    d.render(true);

  }
  
  html.find('li.actor').each((i, li) => {
    li.addEventListener("drop", giveItemTo.bind(this, li.getAttribute("data-entity-id")));
  });
});


Hooks.once("init", () => {

  loadTemplates([
    "modules/lootsheetnpcpf1/template/npc-sheet-gmpart.html", 
    "modules/lootsheetnpcpf1/template/dialog-price-modifier.html"]);
  
  Handlebars.registerHelper('ifeq', function(a, b, options) {
    if (a == b) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  game.settings.register("lootsheetnpcpf1", "changeScrollIcon", {
    name: game.i18n.localize("SETTINGS.lsChangeIconForSpellScrollsTitle"), 
    hint: game.i18n.localize("SETTINGS.lsChangeIconForSpellScrollsHint"), 
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register("lootsheetnpcpf1", "buyChat", {
    name: game.i18n.localize("SETTINGS.lsPurchaseChatMessageTitle"),
    hint: game.i18n.localize("SETTINGS.lsPurchaseChatMessageHint"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register("lootsheetnpcpf1", "clearInventory", {
    name: game.i18n.localize("SETTINGS.lsClearInventoryTitle"),
    hint: game.i18n.localize("SETTINGS.lsClearInventoryHint"),
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  /*******************************************
   *          SOCKET HANDLING!
   *******************************************/
  game.socket.on(LootSheetPf1NPC.SOCKET, data => {
    console.log("Loot Sheet | Socket Message: ", data);
    if (game.user.isGM && data.processorId === game.user.id) {
      let user = game.users.get(data.userId);
      console.log(user);
      let sourceActor = game.actors.get(data.actorId);
      let targetActor = data.tokenId ? canvas.tokens.get(data.tokenId).actor : game.actors.get(data.targetActorId);
        
      if (data.type === "buy") {
        if (sourceActor && targetActor) {
          LootSheetActions.transaction(user, targetActor, sourceActor, data.itemId, data.quantity);
        } else if (!targetActor) {
          LootSheetActions.errorMessageToActor(sourceActor, game.i18n.localize("ERROR.lsNoActiveGM"))
          ui.notifications.error(game.i18n.localize("ERROR.lsPurchaseAttempt"));
        }
      }

      else if (data.type === "loot") {
        if (sourceActor && targetActor) {
          LootSheetActions.lootItem(user, targetActor, sourceActor, data.itemId, data.quantity);
        } else if (!targetActor) {
          LootSheetActions.errorMessageToActor(sourceActor, game.i18n.localize("ERROR.lsNoActiveGM"))
          ui.notifications.error(game.i18n.localize("ERROR.lsLootAttempt"));
        }
      }
      
      else if (data.type === "drop") {
        if(sourceActor && targetActor) {
          LootSheetActions.dropOrSellItem(user, targetActor, sourceActor, data.itemId)
        }
      }
      
      else if (data.type === "give") {
        LootSheetActions.giveItem(user, data.actorId, data.targetActorId, data.itemId, data.quantity);
      }
    }
    if (data.type === "error" && data.targetId === game.user.actorId) {
      console.log("Loot Sheet | Transaction Error: ", data.message);
      return ui.notifications.error(data.message);
    }
  });

  //Register the loot sheet
  Actors.registerSheet("PF1", LootSheetPf1NPC, {
    types: ["npc"],
    makeDefault: false
  });

});


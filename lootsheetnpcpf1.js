/**
 * Adapted for PF1 system from original module: https://github.com/jopeek/fvtt-loot-sheet-npc-5e
 */ 

import {
  ActorSheetPFNPC
} from "../../systems/pf1/module/actor/sheets/npc.js";


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
    return item.data.unidentified.price && item.data.unidentified.price > 0 ? item.data.unidentified.price : item.data.price;
  }
  
  /**
   * Returns the loot name that the player knows
   */
  getLootName(item) {
    if(game.user.isGM || item.data.identified) {
      return item.name;
    }
    return item.data.unidentified.name && item.data.unidentified.name.length > 0 ? item.data.unidentified.name : item.name;
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

    sheetData.lootsheettype = lootsheettype;
    sheetData.rolltable = rolltable;
    sheetData.priceModifier = priceModifier;
    sheetData.rolltables = game.tables.entities;
    sheetData.canAct = game.user.playerId in sheetData.actor.permission && sheetData.actor.permission[game.user.playerId] == 2;

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
  activateListeners(html) {
    //console.log("Loot Sheet | activateListeners")
    super.activateListeners(html);
    
    // Remove dragging capability
    let handler = ev => this._onDragItemStart(ev);
    html.find('li.item').each((i, li) => {
      if ( li.classList.contains("inventory-header") ) return;
      li.setAttribute("draggable", false);
      li.removeEventListener("dragstart", handler);
    });
    
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
          buyerId: game.user.actorId,
          tokenId: this.token.id,
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

    if (this.token === null) {
      return ui.notifications.error(game.i18n.localize("ERROR.lsLootFromToken"));
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
          looterId: game.user.actorId,
          tokenId: this.token.id,
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
            const itemCost = item.data.data.identified || !item.data.data.unidentified.price || item.data.data.unidentified.price == 0 ? item.data.data.price : item.data.data.unidentified.price
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
    let currencyRemains = duplicate(actorData.data.currency);
    //console.log("Loot Sheet | Currency data", currencySplit);
    for (let c in currencySplit) {
      if (owners.length)
        currencySplit[c] = Math.floor(currencySplit[c] / owners.length);
      else
        currencySplit[c] = 0
        
      currencyRemains[c] -= currencySplit[c] * owners.length
    }
          
    let msg = [];
    for (let u of owners) {
      //console.log("Loot Sheet | u of owners", u);
      if (u === null) continue;

      msg = [];
      let currency = u.data.data.currency;
      let newCurrency = duplicate(u.data.data.currency);

      //console.log("Loot Sheet | Current Currency", currency);
      for (let c in currency) {
        // add msg for chat description
        if (currencySplit[c]) {
          //console.log("Loot Sheet | New currency for " + c, currencySplit[c]);
          msg.push(game.i18n.format("ls.splitcoins", {quantity: currencySplit[c], currency: game.i18n.localize("ls." + c)}));
        }

        // Add currency to permitted actor
        newCurrency[c] = currency[c] + currencySplit[c];

        //console.log("Loot Sheet | New Currency", newCurrency);
        u.update({
          'data.currency': newCurrency
        });
      }

      // Remove currency from loot actor.
      this.actor.update({ "data.currency": currencyRemains });
      
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

    let updateData = { permission: {} }
    updateData.permission[playerId] = newLevel;
    this.actor.update( updateData );
    console.log(this.actor)
    this._onSubmit(event);
  }


  /* -------------------------------------------- */

  /**
   * Organize and classify Items for Loot NPC sheets
   * @private
   */
  _prepareItems(actorData) {
    //console.log("Loot Sheet | _prepareItems")
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
    for (let c in currencySplit) {
      if (owners.length)
        currencySplit[c] = Math.floor(currencySplit[c] / owners.length);
      else
        currencySplit[c] = 0
    }
    
    let loot = {}
    loot.warning = actorData.permission.default != 0
    loot.players = players;
    loot.ownerCount = owners.length;
    loot.currency = currencySplit;
    actorData.flags.loot = loot;
  }

  async _onDrop(event) {
    event.preventDefault();
    
    if (game.user.isGM) {
      super._onDrop(event)
    } 
    // users don't have the rights for the transaction => ask GM to do it
    else {
      console.log(this)
      // Try to extract the data
      let data;
      let extraData = {};
      try {
        data = JSON.parse(event.dataTransfer.getData('text/plain'));
        if (data.type !== "Item") return;
      } catch (err) {
        return false;
      }
      
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
          tokenId: this.token.id,
          processorId: targetGm.id
        };
        game.socket.emit(LootSheetPf1NPC.SOCKET, packet);
      }
    }
  }

}


/**
 * Register a hook to convert any spell created on an actor with the LootSheetPf1NPC sheet to a consumable scroll.
 */
Hooks.on('preCreateOwnedItem', (actor, item, data) => {

  //console.log("Loot Sheet | actor", actor);
  //console.log("Loot Sheet | item", item);
  //console.log("Loot Sheet | data", data);

  if (!actor) throw new Error(`Parent Actor ${actor._id} not found`);

  // Check if Actor is an NPC
  if (actor.data.type === "character") return;

  // If the actor is using the LootSheetPf1NPC then check in the item is a spell and if so update the name.
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
    
    // items must be owned
    if(!game.user.isGM && (data.actorId != game.user.data.character) ) {
      ui.notifications.error(game.i18n.localize("ERROR.lsNotAutorizedToGive"));
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
        lsGiveItem(data.actorId, actorDestId, data.data._id, quantity)
      } else {
        const packet = {
          type: "give",
          giverId: data.actorId,
          giverItemId: data.data._id,
          receiverId: actorDestId,
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


  function chatMessage(speaker, owner, message, item) {
    if (game.settings.get("lootsheetnpcpf1", "buyChat")) {
      if (item) {
        message = `<div class="pf1 chat-card item-card" data-actor-id="${owner._id}" data-item-id="${item._id}">
                    <header class="card-header flexrow">
                        <img src="${item.img}" title="${item.showName}" width="36" height="36">
                        <h3 class="item-name">${item.showName}</h3>
                    </header>
                    <div class="card-content"><p>${message}</p></div></div>`;
      } else {
        message = `<div class="pf1 chat-card item-card" data-actor-id="${owner._id}">
                    <div class="card-content"><p>${message}</p></div></div>`;
      }
      ChatMessage.create({
        user: game.user._id,
        speaker: {
          actor: speaker,
          alias: speaker.name
        },
        content: message
      });
    }
  }


  function errorMessageToActor(target, message) {
    game.socket.emit(LootSheetPf1NPC.SOCKET, {
      type: "error",
      targetId: target.id,
      message: message
    });
  }

  function moveItem(source, destination, itemId, quantity) {
    //console.log("Loot Sheet | moveItem")
    let item = source.getEmbeddedEntity("OwnedItem", itemId);

    if(!quantity) {
      quantity = item.data.quantity
    }
    
    // Move all items if we select more than the quantity.
    if (item.data.quantity < quantity) {
      quantity = item.data.quantity;
    }

    let newItem = duplicate(item);
    const update = {
      _id: itemId,
      "data.quantity": item.data.quantity - quantity
    };

    if (update["data.quantity"] === 0) {
      source.deleteEmbeddedEntity("OwnedItem", itemId);
    } else {
      source.updateEmbeddedEntity("OwnedItem", update);
    }

    newItem.data.quantity = quantity;
    destination.createEmbeddedEntity("OwnedItem", newItem);

    const itemName = newItem.data.identified || !newItem.data.unidentified.name || newItem.data.unidentified.name.length == 0 ? newItem.name : newItem.data.unidentified.name
    const itemCost = newItem.data.identified || !newItem.data.unidentified.price || newItem.data.unidentified.price == 0 ? newItem.data.price : newItem.data.unidentified.price
    newItem.showName = itemName
    newItem.showCost = itemCost
    
    return {
      item: newItem,
      quantity: quantity
    };

  }
  
  function moveCoins(source, destination, itemId, quantity) {
    console.log("Loot Sheet | moveCoins")
    
    // Move all items if we select more than the quantity.
    let coins = source.data.data.currency[itemId]
    if (coins < quantity) {
      quantity = coins;
    }
    
    if (quantity == 0) return null;

    const srcUpdate = { data: { currency: { } } };
    srcUpdate.data.currency[itemId] = source.data.data.currency[itemId] - quantity;
    source.update(srcUpdate)
    
    const dstUpdate = { data: { currency: { } } };
    dstUpdate.data.currency[itemId] = destination.data.data.currency[itemId] + quantity;
    destination.update(dstUpdate)
    
    return {
      quantity: quantity
    };

  }

  async function lootItem(container, looter, itemId, quantity) {
    console.log("Loot Sheet | lootItem")
    
    if (itemId.length == 2) {
      let moved = moveCoins(container, looter, itemId, quantity);

      if (moved) {
        chatMessage(
          container, looter,
          game.i18n.format("ls.chatLootCoins", { buyer: looter.name, quantity: moved.quantity, currency: game.i18n.localize("ls." + itemId) }));
      }
    }
    else {
      let moved = moveItem(container, looter, itemId, quantity);

      chatMessage(
        container, looter,
        game.i18n.format("ls.chatLoot", { buyer: looter.name, quantity: moved.quantity, name: moved.item.showName }),
        moved.item);
    }
  }
  
  async function dropOrSellItem(container, giver, itemId) {
    //console.log("Loot Sheet | Drop or sell item")
    let moved = moveItem(giver, container, itemId);
    let messageKey = ""
    let cost = Math.floor(moved.item.showCost)
    
    if(container.getFlag("lootsheetnpcpf1", "lootsheettype") === "Merchant") {
      messageKey = "ls.chatSell"
      let sellerFunds = duplicate(giver.data.data.currency)
      if(sellerFunds && moved.item.showCost > 0) {
        if( moved.item.data.subType !== "tradeGoods" ) {
          cost = Math.round(cost / 2)
        }
        sellerFunds["gp"] += cost * moved.quantity
        giver.update({ "data.currency": sellerFunds });
        giver.update({ "data.currency": sellerFunds }); // 2x required or it will not be stored? WHY???
      }
    } else {
      messageKey = "ls.chatDrop"
    }
  
    chatMessage(
      container, giver,
      game.i18n.format(messageKey, { seller: giver.name, quantity: moved.quantity, price: cost * moved.quantity, item: moved.item.showName, container: container.name }), 
      moved.item);
  }
  
  
  function transaction(seller, buyer, itemId, quantity) {
    console.log("Loot Sheet | Transaction")

    let sellItem = seller.getEmbeddedEntity("OwnedItem", itemId);


    // If the buyer attempts to buy more then what's in stock, buy all the stock.
    if (sellItem.data.quantity < quantity) {
      quantity = sellItem.data.quantity;
    }

    let sellerModifier = seller.getFlag("lootsheetnpcpf1", "priceModifier");
    if (!sellerModifier) sellerModifier = 1.0;

    let itemCost = sellItem.data.identified || !sellItem.data.unidentified.price || sellItem.data.unidentified.price == 0 ? sellItem.data.price : sellItem.data.unidentified.price
    itemCost = Math.round(itemCost * sellerModifier * 100) / 100;
    itemCost *= quantity;
    let buyerFunds = duplicate(buyer.data.data.currency);
    const conversionRate = {
      "pp": 10,
      "gp": 1,
      "sp": 0.1,
      "cp": 0.01
    };
    let buyerFundsAsGold = 0;

    for (let currency in buyerFunds) {
      buyerFundsAsGold += buyerFunds[currency] * conversionRate[currency];
    }

    if (itemCost > buyerFundsAsGold) {
      errorMessageToActor(buyer, game.i18n.localize("ERROR.lsNotEnougFunds"));
      return;
    }
    const originalCost = itemCost;
    
    // Update buyer's gold
    
    // make sure that coins is a number (not a float)
    while(!Number.isInteger(itemCost)) {
      itemCost *= 10;
      for (const key in conversionRate) {
        conversionRate[key] *= 10
      }
    }
    
    const DEBUG = false;
    if (DEBUG) console.log("Loot Sheet | Conversion rates: ");
    if (DEBUG) console.log(conversionRate);
    
    // remove funds from lowest currency to highest
    let remainingFond = 0
    for (const currency of Object.keys(conversionRate).reverse()) {
      //console.log("Rate: " + conversionRate[currency])
      if(conversionRate[currency] < 1) {
        const ratio = 1/conversionRate[currency]
        const value = Math.min(itemCost, Math.floor(buyerFunds[currency] / ratio))
        if (DEBUG) console.log("Loot Sheet | BuyerFunds " + currency + ": " + buyerFunds[currency])
        if (DEBUG) console.log("Loot Sheet | Ratio: " + ratio)
        if (DEBUG) console.log("Loot Sheet | Value: " + value)
        itemCost -= value
        buyerFunds[currency] -= value * ratio
      } else {
        const value = Math.min(itemCost, Math.floor(buyerFunds[currency] * conversionRate[currency]))
        itemCost -= value
        const lost = Math.ceil( value / conversionRate[currency] )
        buyerFunds[currency] -= lost
        remainingFond += lost * conversionRate[currency] - value
        if (DEBUG) console.log("Loot Sheet | Value+: " + value)
        if (DEBUG) console.log("Loot Sheet | Lost+: " + lost)
        if (DEBUG) console.log("Loot Sheet | RemainingFond+: " + remainingFond)
      }
    }
    
    if(itemCost > 0) {
      errorMessageToActor(buyer, game.i18n.localize("ERROR.lsCurrencyConversionFailed"));
      return ui.notifications.error(game.i18n.localize("ERROR.lsCurrencyConversionFailed"));
    }
    
    //console.log("RemainingFond: " + remainingFond)
    
    if(remainingFond > 0) {
      for (const currency of Object.keys(conversionRate)) {
        if (conversionRate[currency] <= remainingFond) {
          buyerFunds[currency] += Math.floor(remainingFond / conversionRate[currency]);
          remainingFond = remainingFond % conversionRate[currency];
          if (DEBUG) console.log("Loot Sheet | buyerFunds " + currency + ": " + buyerFunds[currency]);
          if (DEBUG) console.log("Loot Sheet | remainingFond: " + remainingFond);
        }
      }
    }
    
    if(remainingFond > 0) {
      errorMessageToActor(buyer, game.i18n.localize("ERROR.lsCurrencyConversionFailed"));
      return ui.notifications.error(game.i18n.localize("ERROR.lsCurrencyConversionFailed"));
    }
    
    if (DEBUG) console.log(buyerFunds)

    // Update buyer's gold from the buyer.
    buyer.update({
      "data.currency": buyerFunds
    });
    let moved = moveItem(seller, buyer, itemId, quantity);

    chatMessage(
      seller, buyer,
      game.i18n.format("ls.chatPurchase", { buyer: buyer.name, quantity: quantity, name: moved.item.showName, cost: originalCost }),
      moved.item);
  }

  game.socket.on(LootSheetPf1NPC.SOCKET, data => {
    console.log("Loot Sheet | Socket Message: ", data);
    if (game.user.isGM && data.processorId === game.user.id) {
      if (data.type === "buy") {
        let buyer = game.actors.get(data.buyerId);
        let seller = canvas.tokens.get(data.tokenId);

        if (buyer && seller && seller.actor) {
          transaction(seller.actor, buyer, data.itemId, data.quantity);
        } else if (!seller) {
          errorMessageToActor(buyer, game.i18n.localize("ERROR.lsNoActiveGM"))
          ui.notifications.error(game.i18n.localize("ERROR.lsPurchaseAttempt"));
        }
      }

      else if (data.type === "loot") {
        let looter = game.actors.get(data.looterId);
        let container = canvas.tokens.get(data.tokenId);

        if (looter && container && container.actor) {
          lootItem(container.actor, looter, data.itemId, data.quantity);
        } else if (!container) {
          errorMessageToActor(looter, game.i18n.localize("ERROR.lsNoActiveGM"))
          ui.notifications.error(game.i18n.localize("ERROR.lsLootAttempt"));
        }
      }
      
      else if (data.type === "drop") {
        let giver = game.actors.get(data.actorId);
        let container = canvas.tokens.get(data.tokenId);
        if(giver && container) {
          dropOrSellItem(container.actor, giver, data.itemId)
        }
      }
      
      else if (data.type === "give") {
        lsGiveItem(data.giverId, data.receiverId, data.giverItemId, data.quantity);
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


/**
 * Global function to give something to somebody else
 */
function lsGiveItem(giverId, receiverId, itemId, quantity) {
  quantity = Number(quantity)  // convert to number (just in case)
  
  let giver = game.actors.get(giverId);
  let receiver = game.actors.get(receiverId);
 
  let giverUser = null;
    game.users.forEach((u) => {
    if (u.character && u.character._id === giverId) {
      giverUser = u;
    }
  });
    
  if(quantity <= 0) {
    return;
  }
  
  if (giver && receiver) {
    const item = giver.getEmbeddedEntity("OwnedItem", itemId);
    item.data.quantity = Number(item.data.quantity)  // convert to number (just in case)

    if (item) {
      if(quantity > item.data.quantity) {
        quantity = item.data.quantity
      }
      if(item.data.quantity == quantity) {
        giver.deleteEmbeddedEntity("OwnedItem", item._id);
        receiver.createEmbeddedEntity("OwnedItem", item);
      } else {
        let remainingQuantity = item.data.quantity - quantity
        item.data.quantity = quantity
        receiver.createEmbeddedEntity("OwnedItem", item);
        giver.updateEmbeddedEntity("OwnedItem", { _id: item._id, data: { quantity: remainingQuantity }});
      }
      console.log(`Loot Sheet | ${giver.name} gave ${item.name} to ${receiver.name}`)
      
      if(giverId != receiverId) {
        let message = game.i18n.format("ls.chatGive", {giver: giver.data.name, receiver: receiver.data.name, quantity: quantity, item: item.name});
        ChatMessage.create({
          user: giverUser ? giverUser._id : game.user._id,
          content: message
        });
      }
    } else {
      console.log("Loot Sheet | Give operation failed because item (giver) couldn't be found!");
    }
  } else {
    console.log("Loot Sheet | Give operation failed because actors (giver or receiver) couldn't be found!");
  }
}

/*************************
 * Global static actions 
 *************************
*/
export class LootSheetActions {

  /**
   * Displays a message into the chat log
   */
  static chatMessage(speaker, owner, message, item) {
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

  /**
   * Sends a error message to the target user
   */
  static errorMessageToActor(target, message) {
    game.socket.emit("module.lootsheetnpcpf1", {
      type: "error",
      targetId: target.id,
      message: message
    });
  }

  /**
   * Moves an item from a source actor to a destination actor
   */
  static moveItem(source, destination, itemId, quantity) {
    //console.log("Loot Sheet | moveItem")
    let item = source.getEmbeddedEntity("OwnedItem", itemId);
    
    if(!item) {
      ui.notifications.warn(game.i18n.format("ERROR.lsInvalidMove", { actor: source.name }));
      console.log(source, destination, itemId)
      return null;
    }
    
    if(!quantity) {
      quantity = item.data.quantity
    }
    
    // Move all items if we select more than the quantity.
    if (item.data.quantity < quantity) {
      quantity = item.data.quantity;
    }

    let newItem = duplicate(item);
    
    // remove unecessary flags
    if(newItem.flags.lootsheetnpcpf1) {
      delete(newItem.flags.lootsheetnpcpf1)
    }

    // decrease the quantity (unless infinite)
    if(!item.flags.lootsheetnpcpf1 || !item.flags.lootsheetnpcpf1.infinite) {
      const update = {
        _id: itemId,
        "data.quantity": item.data.quantity - quantity
      };

      let removeEmptyStacks = game.settings.get("lootsheetnpcpf1", "removeEmptyStacks");
      if (update["data.quantity"] === 0 && removeEmptyStacks) {
        source.deleteEmbeddedEntity("OwnedItem", itemId);
      } else {
        source.updateEmbeddedEntity("OwnedItem", update);
      }
    }

    newItem.data.quantity = quantity;
    destination.createEmbeddedEntity("OwnedItem", newItem);
    newItem.showName = LootSheetActions.getItemName(newItem)
    newItem.showCost = LootSheetActions.getItemCost(newItem)
    
    return {
      item: newItem,
      quantity: quantity
    };

  }

  static spreadFunds(totalGP, funds) {
    const gpBare = Math.floor(totalGP),
      spLeftOver = (totalGP - gpBare) * 100,
      spBare = Math.floor(spLeftOver),
      cpLeftOver = (spLeftOver - spBare) * 100,
      cpBare = Math.floor(cpLeftOver);
    funds.gp += gpBare;
    funds.sp += spBare;
    funds.cp += cpBare;
    return funds;
  }

  /**
   * Moves coins from a source actor to a destination actor
   */
  static moveCoins(source, destination, itemId, quantity) {
    //console.log("Loot Sheet | moveCoins")
    
    if(itemId.startsWith("wl_")) {
      itemId = itemId.substring(3)
      
      // Move all items if we select more than the quantity.
      let coins = source.data.data.altCurrency[itemId]
      if (coins < quantity) {
        quantity = coins;
      }
      
      if (quantity == 0) return null;

      const srcUpdate = { data: { altCurrency: { } } };
      srcUpdate.data.altCurrency[itemId] = source.data.data.altCurrency[itemId] - quantity;
      source.update(srcUpdate)
      
      const dstUpdate = { data: { altCurrency: { } } };
      dstUpdate.data.altCurrency[itemId] = destination.data.data.altCurrency[itemId] + quantity;
      destination.update(dstUpdate)
    }
    else {
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
    }
    
    return {
      quantity: quantity
    };

  }

  /**
   * A looter (target actor) takes an item from a container (source actor)
   */
  static lootItem(speaker, container, looter, itemId, quantity) {
    console.log("Loot Sheet | LootSheetActions.lootItem")
    
    if (itemId.length == 2 || itemId.startsWith("wl_")) {
      let moved = LootSheetActions.moveCoins(container, looter, itemId, quantity);

      if (moved) {
        LootSheetActions.chatMessage(
          speaker, looter,
          game.i18n.format("ls.chatLootCoins", { buyer: looter.name, quantity: moved.quantity, currency: game.i18n.localize("ls." + itemId) }));
      }
    }
    else {
      let moved = LootSheetActions.moveItem(container, looter, itemId, quantity);
      if(!moved) return;

      LootSheetActions.chatMessage(
        speaker, looter,
        game.i18n.format("ls.chatLoot", { buyer: looter.name, quantity: moved.quantity, name: moved.item.showName }),
        moved.item);
    }
  }
  
  /**
   * A giver (source actor) drops or sells a item to a container (target actor)
   */
  static async dropOrSellItem(speaker, container, giver, itemId) {
    //console.log("Loot Sheet | Drop or sell item")
    let moved = LootSheetActions.moveItem(giver, container, itemId);
    if(!moved) return;
    let messageKey = ""
    let cost = moved.item.showCost;

    if(container.getFlag("lootsheetnpcpf1", "lootsheettype") === "Merchant") {
      messageKey = "ls.chatSell"
      let sellerFunds = duplicate(giver.data.data.currency)
      if(sellerFunds && moved.item.showCost > 0) {
        if( moved.item.data.subType !== "tradeGoods" )
          cost = cost / 2;

        const totalGP = cost * moved.quantity;
        sellerFunds = LootSheetActions.spreadFunds(totalGP, sellerFunds);
        await giver.update({ "data.currency": sellerFunds });
      }
    } else {
      messageKey = "ls.chatDrop"
    }
  
    LootSheetActions.chatMessage(
      speaker, giver,
      game.i18n.format(messageKey, { seller: giver.name, quantity: moved.quantity, price: cost * moved.quantity, item: moved.item.showName, container: container.name }), 
      moved.item);
  }
  
  /**
   * Quick function to do a trasaction between a seller (source) and a buyer (target)
   */
  static async transaction(speaker, seller, buyer, itemId, quantity) {
    console.log("Loot Sheet | Transaction")

    let sellItem = seller.getEmbeddedEntity("OwnedItem", itemId);


    // If the buyer attempts to buy more then what's in stock, buy all the stock.
    if (sellItem.data.quantity < quantity) {
      quantity = sellItem.data.quantity;
    }

    let sellerModifier = seller.getFlag("lootsheetnpcpf1", "priceModifier");
    if (!sellerModifier) sellerModifier = 1.0;

    let itemCost = LootSheetActions.getItemCost(sellItem)
    itemCost = itemCost * sellerModifier;
    itemCost *= quantity;
    let buyerFunds = duplicate(buyer.data.data.currency);
    let buyerFundsAlt = duplicate(buyer.data.data.altCurrency);
    const conversionRate = {
      "pp": 100,
      "gp": 1,
      "sp": 0.01,
      "cp": 0.0001
    };
    let buyerFundsAsGold = 0;
    let buyerFundsAsGoldAlt = 0;

    for (let currency in buyerFunds) {
      buyerFundsAsGold += Math.floor(buyerFunds[currency] * conversionRate[currency]);
    }
    for (let currency in buyerFundsAlt) {
      buyerFundsAsGoldAlt += Math.floor(buyerFundsAlt[currency] * conversionRate[currency]);
    }

    if (itemCost > buyerFundsAsGold + buyerFundsAsGoldAlt) {
      LootSheetActions.errorMessageToActor(buyer, game.i18n.localize("ERROR.lsNotEnougFunds"));
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
    
    // cost can be paid with funds
    if (itemCost <= buyerFundsAsGold) {
      buyerFunds = LootSheetActions.removeCostFromFunds(buyer, itemCost, buyerFunds, conversionRate);
      await buyer.update({ "data.currency": buyerFunds });
    }
    // cost must also be paid with weightless funds
    else {
      buyerFunds = LootSheetActions.removeCostFromFunds(buyer, buyerFundsAsGold, buyerFunds, conversionRate);
      buyerFundsAlt = LootSheetActions.removeCostFromFunds(buyer, itemCost - buyerFundsAsGold, buyerFundsAlt, conversionRate);
      await buyer.update({ "data.currency": buyerFunds, "data.altCurrency": buyerFundsAlt });
    }
    

    let moved = LootSheetActions.moveItem(seller, buyer, itemId, quantity);

    if(moved) {
      LootSheetActions.chatMessage(
        speaker, buyer,
        game.i18n.format("ls.chatPurchase", { buyer: buyer.name, quantity: quantity, name: moved.item.showName, cost: originalCost }),
        moved.item);
    }
  }
  
  /**
   * Remove cost from actor's funds using provided conversionRate
   */
  static removeCostFromFunds(buyer, cost, funds, conversionRate, DEBUG = false) {
    if (DEBUG) console.log("Loot Sheet | Conversion rates: ");
    if (DEBUG) console.log(conversionRate);
    
    // remove funds from lowest currency to highest
    let remainingFond = 0
    for (const currency of Object.keys(conversionRate).reverse()) {
      //console.log("Rate: " + conversionRate[currency])
      if(conversionRate[currency] < 1) {
        const ratio = 1/conversionRate[currency]
        const value = Math.min(cost, Math.floor(funds[currency] / ratio))
        if (DEBUG) console.log("Loot Sheet | BuyerFunds " + currency + ": " + funds[currency])
        if (DEBUG) console.log("Loot Sheet | Ratio: " + ratio)
        if (DEBUG) console.log("Loot Sheet | Value: " + value)
        cost -= value
        funds[currency] -= value * ratio
      } else {
        const value = Math.min(cost, Math.floor(funds[currency] * conversionRate[currency]))
        cost -= value
        const lost = Math.ceil( value / conversionRate[currency] )
        funds[currency] -= lost
        remainingFond += lost * conversionRate[currency] - value
        if (DEBUG) console.log("Loot Sheet | Value+: " + value)
        if (DEBUG) console.log("Loot Sheet | Lost+: " + lost)
        if (DEBUG) console.log("Loot Sheet | RemainingFond+: " + remainingFond)
      }
    }
    
    if(cost > 0) {
      LootSheetActions.errorMessageToActor(buyer, game.i18n.localize("ERROR.lsCurrencyConversionFailed"));
      ui.notifications.error(game.i18n.localize("ERROR.lsCurrencyConversionFailed"));
      throw "Couldn't remove from funds"
    }
    
    //console.log("RemainingFond: " + remainingFond)
    
    if(remainingFond > 0) {
      for (const currency of Object.keys(conversionRate)) {
        if (conversionRate[currency] <= remainingFond) {
          funds[currency] += Math.floor(remainingFond / conversionRate[currency]);
          remainingFond = remainingFond % conversionRate[currency];
          if (DEBUG) console.log("Loot Sheet | funds " + currency + ": " + funds[currency]);
          if (DEBUG) console.log("Loot Sheet | remainingFond: " + remainingFond);
        }
      }
    }
    
    if(remainingFond > 0) {
      LootSheetActions.errorMessageToActor(buyer, game.i18n.localize("ERROR.lsCurrencyConversionFailed"));
      return ui.notifications.error(game.i18n.localize("ERROR.lsCurrencyConversionFailed"));
      throw "Couldn't remove from funds"
    }
    
    if (DEBUG) console.log(funds)
    return funds;
  }
  
  /**
   * Actor gives something to another actor
   */
  static giveItem(speaker, giverId, receiverId, itemId, quantity) {
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
      let moved = LootSheetActions.moveItem(giver, receiver, itemId, quantity);
      if(moved) {
        LootSheetActions.chatMessage(
          speaker, receiver,
          game.i18n.format("ls.chatGive", {giver: giver.data.name, receiver: receiver.data.name, quantity: quantity, item: moved.item.showName}),
          moved.item);
      }
    } else {
      console.log("Loot Sheet | Give operation failed because actors (giver or receiver) couldn't be found!");
    }
  }


  /**
   * Returns the unidentified name (if unidentified and specified) or the name
   */
  static getItemName(item) {
    if(!item) return ""
    else return item.data.identified || !item.data.unidentified || !item.data.unidentified.name || item.data.unidentified.name.length == 0 ? item.name : item.data.unidentified.name
  }

  /**
   * Returns the unidentified cost (if unidentified and specified) or the cost
   */
  static getItemCost(item) {
    if(!item) return 0
    else return Number(item.data.identified || item.data.unidentified == null ? item.data.price : item.data.unidentified.price)
  }
  
  /**
   * Returns the sale value of an item
   */
  static getItemSaleValue(item) {
    if(item.type == "container") {
      let total = 0;
      item.items.forEach(i => total += LootSheetActions.getItemSaleValue(i))
      return total;
    } else if (["weapon", "equipment", "consumable", "tool", "loot"].indexOf(item.type) >= 0) {
      let itemCost = LootSheetActions.getItemCost(item.data)
      if( item.data.data.subType !== "tradeGoods" )
        itemCost = itemCost / 2;
      return itemCost * item.data.data.quantity
    }
    return 0;
  }

}

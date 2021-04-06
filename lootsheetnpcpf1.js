/**
 * Adapted for PF1 system from original module: https://github.com/jopeek/fvtt-loot-sheet-npc-5e
 */ 

import { LootSheetActions } from "./modules/actions.js";
import { LootSheetConstants } from "./modules/constants.js";
import { QuantityDialog } from "./modules/quantity-dialog.js";

// Module's entry point
Hooks.on("ready", async () => {
  LootSheetConstants.LootSheetPf1NPC = (await import("./modules/lootsheet-npc.js")).LootSheetPf1NPC;
  
  //Register the loot sheet
  Actors.registerSheet("PF1", LootSheetConstants.LootSheetPf1NPC, {
    types: ["npc"],
    makeDefault: false
  });
});


/**
 * Register a hook 
 */
Hooks.on('preCreateOwnedItem', (actor, item, data) => {

  if (!actor) throw new Error(`Parent Actor ${actor._id} not found`);
  
  // If the target actor is using the LootSheetPf1NPC then check in the item
  if (actor.sheet instanceof LootSheetConstants.LootSheetPf1NPC) {
    // validate the type of item to be "moved" or "added"
    if(!["weapon","equipment","consumable","loot","container"].includes(item.type)) {
      ui.notifications.error(game.i18n.localize("ERROR.lsInvalidType"));
      return false;
    }
  }

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
        game.socket.emit(LootSheetConstants.SOCKET, packet);
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

  game.settings.register(LootSheetConstants.MODULENAME, "changeScrollIcon", {
    name: game.i18n.localize("SETTINGS.lsChangeIconForSpellScrollsTitle"), 
    hint: game.i18n.localize("SETTINGS.lsChangeIconForSpellScrollsHint"), 
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register(LootSheetConstants.MODULENAME, "buyChat", {
    name: game.i18n.localize("SETTINGS.lsPurchaseChatMessageTitle"),
    hint: game.i18n.localize("SETTINGS.lsPurchaseChatMessageHint"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register(LootSheetConstants.MODULENAME, "clearInventory", {
    name: game.i18n.localize("SETTINGS.lsClearInventoryTitle"),
    hint: game.i18n.localize("SETTINGS.lsClearInventoryHint"),
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  game.settings.register(LootSheetConstants.MODULENAME, "removeEmptyStacks", {
    name: game.i18n.localize("SETTINGS.lsRemoveEmptyStackTitle"),
    hint: game.i18n.localize("SETTINGS.lsRemoveEmptyStackHint"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  /*******************************************
   *          SOCKET HANDLING!
   *******************************************/
  game.socket.on(LootSheetConstants.SOCKET, data => {
    console.log("Loot Sheet | Socket Message: ", data);
    if (game.user.isGM && data.processorId === game.user.id) {
      let user = game.users.get(data.userId);
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

});


Hooks.on("getActorDirectoryEntryContext", (html, options) => {
  options.push({
    name: game.i18n.localize("ls.convertToLoot"),
    icon: '<i class="fas fa-skull-crossbones"></i>',
    callback: async function(li) {
      const actor = game.actors.get(li.data("entityId"))
      if(actor) { 
        await actor.setFlag("core", "sheetClass", "PF1.LootSheetPf1NPC");
        let permissions = duplicate(actor.data.permission)
        game.users.forEach((u) => {
          if (!u.isGM) { permissions[u.id] = 2 }
        });
        await actor.update( { permission: permissions }, {diff: false});
      }
    },
    condition: li => {
      const actor = game.actors.get(li.data("entityId"))
      return game.user.isGM && actor && actor.data.type === "npc" && !(actor.sheet instanceof LootSheetConstants.LootSheetPf1NPC) && actor.data.token.actorLink;
    },
  });
  // Special case: actor is not linked => convert all defeated tokens!
  options.push({
    name: game.i18n.localize("ls.convertToLootUnlinked"),
    icon: '<i class="fas fa-skull-crossbones"></i>',
    callback: async function(li) {
      const actor = game.actors.get(li.data("entityId"))
      if(actor) { 
        let tokens = game.scenes.active.data.tokens.filter(o => o.actorId == actor.id)
        tokens.forEach( async function(t) {
          const effects = getProperty( t.actorData, "effects" )
          // to be considered dead, a token must have the "dead" overlay effect (either from combat tracker or directly)
          if( effects && effects.filter( e => [CONFIG.Combat.defeatedStatusId, "combat-utility-belt.dead"].indexOf(getProperty(e, "flags.core.statusId")) >= 0 ).length > 0) {
            let actor = canvas.tokens.get(t._id).actor
            if( !(actor.sheet instanceof LootSheetConstants.LootSheetPf1NPC) ) {
              await actor.setFlag("core", "sheetClass", "PF1.LootSheetPf1NPC");
              let permissions = duplicate(actor.data.permission)
              game.users.forEach((u) => {
                if (!u.isGM) { permissions[u.id] = 2 }
              });
              await actor.update( { permission: permissions }, {diff: false});
            }
          }
        });
      }
    },
    condition: li => {
      const actor = game.actors.get(li.data("entityId"))
      return game.user.isGM && actor && actor.data.type === "npc" && !(actor.sheet instanceof LootSheetConstants.LootSheetPf1NPC) && !actor.data.token.actorLink;
    },
  });
});



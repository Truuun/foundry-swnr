import { SWNRBaseItem } from "./base-item";
import { getDefaultImage } from "./utils";
import { ValidatedDialog } from "./ValidatedDialog";

export class BaseActorSheet<T extends ActorSheet.Data> extends ActorSheet<
  ActorSheet.Options,
  T
> {
  popUpDialog?: Dialog;

  activateListeners(html: JQuery): void {
    super.activateListeners(html);
    html.find(".item-edit").on("click", this._onItemEdit.bind(this));
    html.find(".item-delete").on("click", this._onItemDelete.bind(this));
    html.find(".item-reload").on("click", this._onItemReload.bind(this));
    html.find(".item-show").on("click", this._onItemShow.bind(this));
    html
      .find(".item-toggle-broken")
      .on("click", this._onItemBreakToggle.bind(this));
    html
      .find(".item-toggle-destroy")
      .on("click", this._onItemDestroyToggle.bind(this));
    html
      .find(".item-toggle-jury")
      .on("click", this._onItemJuryToggle.bind(this));
    html.find(".item-click").on("click", this._onItemClick.bind(this));
    html.find(".item-create").on("click", this._onItemCreate.bind(this));
    html.find(".item-search").on("click", this._onItemSearch.bind(this));
  }

  // Clickable title/name or icon. Invoke Item.roll()
  _onItemClick(event: JQuery.ClickEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.currentTarget.parentElement.dataset.itemId;
    const item = <SWNRBaseItem>this.actor.getEmbeddedDocument("Item", itemId);
    //const wrapper = $(event.currentTarget).parents(".item");
    //const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    if (!item) return;
    item.roll(event.shiftKey);
  }

  async populateItemList(
    itemType: string,
    candiateItems: { [name: string]: Item },
    displayNames: { [name: string]: string },
    itemSubType?: string,
    prefix = false
  ): Promise<void> {
    const gameGen = game?.release?.generation;
    for (const e of game.packs) {
      if (
        (gameGen >= 10 && e.metadata.type === "Item") ||
        (gameGen < 10 && e.metadata.entity === "Item")
      ) {
        //console.log("Checking pack ", e.metadata, " ", e.name);
        if (gameGen <= 10 && e.metadata.private == true) {
          console.log("Skipping due to private pack ", e.metadata.label);
          continue;
        } else if (gameGen > 10 && e.metadata.ownership.PLAYER == "NONE") {
          console.log("Skipping due to private pack ", e.metadata.label);
          continue;
        }
        const items = itemSubType ? (await e.getDocuments()).filter(
              (i) =>
                (<SWNRBaseItem>i).type == itemType &&
                (<SWNRBaseItem>i).data.data["type"] == itemSubType
            )
          : (await e.getDocuments()).filter(
              (i) => (<SWNRBaseItem>i).type == itemType
            );
        // console.log(`Pack ${e.metadata.label.startsWith("CWN")}-${e.metadata.label} Found items ${items.length} - ${items}`);
        if (items.length) {
          for (const ci of items.map((item) => item.toObject())) {
            const name = ci.name;
            if (prefix && e.metadata.label.startsWith("CWN")) {
              displayNames[name] = `${name} (CWN)`;
            }
            candiateItems[name] = ci;
          }
        }
      }
    }
  }

  async _onItemSearch(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const searchType = game.settings.get("swnr", "search");

    const swnMappings: { [name: string]: Array<string> } = {
      armor: ["armor"],
      item: ["all-items"],
      cyberware: ["cyberware"],
      focus: ["foci"],
      weapon: ["heavy", "melee", "ranged"],
      power: [
        "psi-metapsionics",
        "psi-precognition",
        "psi-telekinesis",
        "psi-telepathy",
        "psi-teleportation",
        "psi-biopsionics",
      ],
      edge: [],
    };
    const cwnMappings: { [name: string]: Array<string> } = {
      armor: ["cwnarmor"],
      cyberware: ["cwncyberware"],
      focus: ["cwnfoci"],
      item: ["cwnitems"],
      edge: ["cwnedge"],
      weapon: ["cwnweapon"],
      power: [],
    };

    const candiateItems: { [name: string]: Item } = {};
    const itemType = $(event.currentTarget).data("itemType");
    const displayNames: { [name: string]: string } = {};
    const givenName = $(event.currentTarget).data("itemName");
    const itemSubType = $(event.currentTarget).data("itemSubtype");
    let selectedMapping = swnMappings;
    if (searchType == "cwnOnly") {
      selectedMapping = cwnMappings;
    } else if (searchType == "swnCWN" && itemType in cwnMappings) {
      // both, merge the mappings
      selectedMapping = swnMappings;
      if (itemType in selectedMapping) {
        for (const val of cwnMappings[itemType]) {
          selectedMapping[itemType].push(val);
          //Not ideal to get the pack again, but it's the easiest way to get
          //the items right now
          const itemPack = game.packs.get(`swnr.${val}`);
          if (itemPack == null || itemPack == undefined) {
            continue;
          }
          const convert = await itemPack.getDocuments();
          for (const item of convert.map((i) => i.toObject())) {
            displayNames[item.name] = `${item.name} (CWN)`;
          }
        }
      } else {
        selectedMapping[itemType] = cwnMappings[itemType];
      }
    }
    if (searchType == "search" || selectedMapping[itemType] == undefined) {
      await this.populateItemList(
        itemType,
        candiateItems,
        displayNames,
        itemSubType,
        true
      );
    } else {
      if (selectedMapping[itemType]) {
        for (const itemPackName of selectedMapping[itemType]) {
          const itemPack = game.packs.get(`swnr.${itemPackName}`);
          if (itemPack == null || itemPack == undefined) {
            continue;
          }
          const convert = await itemPack.getDocuments();
          for (const item of convert.map((i) => i.toObject())) {
            candiateItems[item.name] = item;
          }
        }
      }
    }

    if (Object.keys(candiateItems).length) {
      let itemOptions = "";
      const keys = Object.keys(candiateItems);
      const sortedNames = keys.sort();
      for (const label of sortedNames) {
        const cand = candiateItems[label];
        if (displayNames[label]) {
          itemOptions += `<option value='${label}'>${displayNames[label]}</option>`;
        } else {
          itemOptions += `<option value='${label}'>${cand.name}</option>`;
        }
      }
      const dialogTemplate = `
      <div class="flex flex-col -m-2 p-2 pb-4 space-y-2">
        <h1> Select ${givenName} to Add </h1>
        <div class="flex flexrow">
          <select id="itemList"
          class="px-1.5 border border-gray-800 bg-gray-400 bg-opacity-75 placeholder-blue-800 placeholder-opacity-75 rounded-md">
          ${itemOptions}
          </select>
        </div>
      </div>
      `;
      const popUpDialog = new ValidatedDialog(
        {
          title: `Add ${givenName}`,
          content: dialogTemplate,
          buttons: {
            addSkills: {
              label: `Add ${givenName}`,
              callback: async (html: JQuery<HTMLElement>) => {
                const itemNameToAdd = (<HTMLSelectElement>(
                  html.find("#itemList")[0])).value;
                const toAdd = await candiateItems[itemNameToAdd];
                await this.actor.createEmbeddedDocuments("Item", [toAdd], {});
              },
            },
            close: {
              label: "Close",
            },
          },
          default: "addSkills",
        },
        {
          failCallback: () => {
            return;
          },
          classes: ["swnr"],
        }
      );
      const s = popUpDialog.render(true);
      if (s instanceof Promise) await s;
    } else {
      // Get the union of keys
      const keysUnion = [
        ...new Set([...Object.keys(swnMappings), ...Object.keys(cwnMappings)]),
      ];

      // Create a string with keys separated by commas
      const resultString = keysUnion.join(",");
      ui.notifications?.info(
        "Could not find any items in the compendium. " +
          `Searching if not defined in list ${resultString}. Check system settings for CWN/SWN search settings.`
      );
    }
  }

  _onItemCreate(event: JQuery.ClickEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const itemType = $(event.currentTarget).data("itemType");
    const givenName = $(event.currentTarget).data("itemName");
    let itemName = givenName ? `New ${givenName}` : "New Item";
    const imgPath = getDefaultImage(itemType);
    const itemObj = {
      name: itemName,
      type: itemType,
      img: imgPath,
    };
    const itemSubType = $(event.currentTarget).data("itemSubtype");
    if (itemSubType) {
      itemName = `New ${itemSubType}`;
      itemObj["name"] = itemName;
      itemObj["data"] = {
        type: itemSubType,
      };
    }
    if (itemType) {
      this.actor.createEmbeddedDocuments("Item", [itemObj], {});
    }
  }

  async _onItemReload(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", li.data("itemId"));
    if (!item) return;
    const ammo_max = item.data.data.ammo?.max;
    if (ammo_max != null) {
      if (item.data.data.ammo.value < ammo_max) {
        await item.update({ "data.ammo.value": ammo_max });
        const content = `<p> Reloaded ${item.name} </p>`;
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: content,
        });
      } else {
        ui.notifications?.info("Trying to reload a full item");
      }
    } else {
      console.log("Unable to find ammo in item ", item.data.data);
    }
  }

  async _onItemBreakToggle(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    const new_break_status = !item?.data.data.broken;
    if (item instanceof Item)
      await item?.update({
        "data.broken": new_break_status,
        "data.destroyed": false,
        "data.juryRigged": false,
      });
  }

  async _onItemDestroyToggle(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    const new_destroy_status = !item?.data.data.destroyed;
    if (item instanceof Item)
      await item?.update({
        "data.destroyed": new_destroy_status,
        "data.broken": false,
        "data.juryRigged": false,
      });
  }

  async _onItemJuryToggle(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    const new_jury_status = !item?.data.data.juryRigged;
    if (item instanceof Item)
      await item?.update({
        "data.destroyed": false,
        "data.broken": false,
        "data.juryRigged": new_jury_status,
      });
  }

  _onItemEdit(event: JQuery.ClickEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    if (item instanceof Item) item.sheet?.render(true);
  }

  // Clickable title/name or icon. Invoke Item.roll()
  _onItemShow(event: JQuery.ClickEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const itemId = wrapper.data("itemId");
    const item = <SWNRBaseItem>this.actor.getEmbeddedDocument("Item", itemId);
    if (!item) return;
    if (item instanceof Item) item.showDesc();
  }

  async _onItemDelete(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", li.data("itemId"));
    if (!item) return;
    if (event.shiftKey == false) {
      const performDelete: boolean = await new Promise((resolve) => {
        Dialog.confirm({
          title: game.i18n.format("swnr.deleteTitle", { name: item.name }),
          yes: () => resolve(true),
          no: () => resolve(false),
          content: game.i18n.format("swnr.deleteContent", {
            name: item.name,
            actor: this.actor.name,
          }),
        });
      });
      if (!performDelete) return;
    }
    li.slideUp(200, () => {
      requestAnimationFrame(() => {
        this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      });
    });
  }

  async _resetSoak(): Promise<void> {
    if (game.settings.get("swnr", "useCWNArmor")) {
      if (this.actor.type == "npc") {
        const maxSoak = this.actor.data.data.baseSoakTotal.max;
        await this.actor.update({
          "data.baseSoakTotal.value": maxSoak,
        });
      }

      const armorWithSoak = <SWNRBaseItem<"armor">[]>(
        this.actor.items.filter(
          (i) =>
            i.data.type === "armor" &&
            i.data.data.use &&
            i.data.data.location === "readied" &&
            i.data.data.soak.value < i.data.data.soak.max
        )
      );
      for (const armor of armorWithSoak) {
        const soak = armor.data.data.soak.max;
        await armor.update({
          "data.soak.value": soak,
        });
      }
    }
  }
}

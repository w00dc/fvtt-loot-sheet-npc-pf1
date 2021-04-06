# Usecases

## As Gamemaster

| #   |  | Action | Source | Target | Message | Notes |
| :-  | --| :- | :- | :- | :--: | :- |
| 1.1 | :heavy_check_mark: | Drag & Drop | Compendium | Loot sheet   | - | |
| 1.2 | :heavy_check_mark: | Drag & Drop | Loot sheet | Actor | - | :warning: item is duplicated   |
| 1.3 | :heavy_check_mark: | Drag & Drop | Loot sheet | Actor (sidebar)  | give | |
| 2.1 | :x: | Loot | Loot sheet | Actor | - | Only player |
| 3.1 | :x: | Buy | Loot sheet | Actor  | - | Only player |
| 4.1 | :x: | Sell | Actor | Loot sheet | - | Only player |

## As Player

| #   |  | Action | Source | Target | Message | Notes |
| :-  | --| :- | :- | :- | :--: | :- |
| 1.1 | :x: | Drag & Drop | Compendium | Loot sheet (token)   | - | Only GM |
| 1.2 | :heavy_check_mark: | Drag & Drop | Loot sheet | Actor | - | :warning: item is duplicated   |
| 1.3 | :heavy_check_mark: | Drag & Drop | Loot sheet | Actor (sidebar)  | give | |



#### Variations

* **token**: sheet was opened from a token on the scene and token is not linked to an actor
* **actor**: sheet was opened from a token on the scene but token is linked to an actor
* **sidebar**: sheet was opened from the sidebar tabs (actors)
* **sidebar drop**: drop on an actor that is visible in the sidebar tabs (actors)

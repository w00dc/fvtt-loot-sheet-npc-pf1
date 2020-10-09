# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.1] - 2020-10-09
### Fixed
- Fix for PF1 system 0.7.4+

## [1.6.0] - 2020-08-01
### Added
- Batch update permissions for all players
- Toggle item visibility in loot
- Convert to loot (unlinked actors)
### Fixed
- Some options and money not visible right after switching to loot sheet 

## [1.5.0] - 2020-08-01
### Added
- Convert to loot (context menu)

## [1.4.0] - 2020-07-31
### Added
- Actions can be executed from sheets opened from sidebars
- Icons in messages for all actions
### Fixed
- Quantity wrongly set as "string" (merchant)

## [1.3.0] - 2020-07-25
### Added
- GM Option to toggle dragging from loot
- GM Option for max load and max capacity
- Weightless currency
### Fixed
- Layout (alternate color)

## [1.2.7] - 2020-07-20
### Changed
- Update compatibility to core version

## [1.2.6] - 2020-07-20
### Fixed
- Strange behaviour when token is linked with actor
### Changed
- Support for both linked and unlinked modes

## [1.2.5] - 2020-06-18
### Fixed
- Invalid module.json

## [1.2.4] - 2020-06-18
### Fixed
- Item price revealed if unidentified and unidentified value = 0

## [1.2.3] - 2020-06-14
### Fixed
- Loot sheet won't open if there are "attacks" or non-items attached

## [1.2.2] - 2020-06-14
### Fixed
- Trade goods were converted to coins for 50% of their value (rather than 100%)

## [1.2.1] - 2020-06-14
### Fixed
- Compatibilité with 0.6.2


## [1.2.0] - 2020-06-13
### Added
- GM can convert the loot (all items) into coins
- Players can split items

### Changed
- Players can specify the quantity of items to give (rather than all)

### Fixed
- A lot of bugs related to permissions

## [1.1.0] - 2020-05-31
### Added
- Players can give items to other players


## [1.0.0] - 2020-05-30
### Added
- First official and stable release
### Changed
- When character buys something, he gets coins back (improved implementation)
- Improved fr translations

## [0.4.2] - 2020-05-29
### Fixed
- Behaviour for unidentified items


## [0.4.1] - 2020-05-29
### Fixed
- Roll tables (merchant) not working


## [0.4.0] - 2020-05-28

### Added
- Loot coins

### Changed
- Hide attacks and buffs

### Fixed
- Currency stored in wrong fields
- Player can import item rather than buy/loot it


## [0.3.0] - 2020-05-25
### Added
- Localization (en/fr)

### Fixed
- Fix scrollbar display
- Fix missing translations


## [0.2.0] - 2020-05-25
### Fixed
- Improve layout for player without access to sheet
- Keep coins that have not been split

## [0.1.0] - 2020-05-24
### Added
- Initial module migrated from DnD 5 module (works but still has a lot of bugs)

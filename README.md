# HLTB for Steam

A [Millennium](https://steambrew.app/) plugin that displays [How Long To Beat](https://howlongtobeat.com/) completion times on game pages in the Steam library.

![Desktop Mode](example_desktop.png)

![Big Picture Mode](example_bigPictureMode.png)

## Features

- Shows HLTB completion times directly on game pages:
  - Main Story
  - Main + Extras
  - Completionist
- Works in both Desktop and Big Picture modes
- Caches results locally, optionally clear via the settings page
- Click "View Details" to open the full HLTB page

## Requirements

- [Millennium](https://steambrew.app/) installed on Steam
- Windows or Linux

## Installation

1. Ensure you have Millennium installed on your Steam client
2. Navigate to HLTB from the [plugins page](https://steambrew.app/plugins)
3. Click the "Copy Plugin ID" button
4. Back in Steam, go to Steam menu > Millenium > Plugins > Install a plugin and paste the code
5. Follow the remaining instructions to install and enable the plugin

## Usage

Once installed, HLTB data automatically appears on game pages in your Steam library. Simply click on any game to see its completion times displayed on the header image.

## How It Works

1. When you view a game page, the plugin detects the Steam App ID
2. The Lua backend queries the Steam API to get the game name
3. It searches How Long To Beat for matching games
4. Results are cached locally and displayed on the game header

## Settings

Access settings via Steam menu > Millennium Library Manger > HLTB for Steam.

- Align to Right (default = true): Position the box on the right side of the header. Disable for left side.
- Horizontal Offset (default = 0): Distance offset from the aligned edge.
- Show View Details Link (default = true): Toggle the link to the HLTB game page on or off.
- Cache Statistics / Clear Cache: View or clear locally cached HLTB data.

The position alignment and offset features are intended to avoid covering Steam UI elements like the custom game logo position "done" button.

## Known Limitations

HLTB uses name based search, and often times the name in HLTB does not match Steam. Most of the time it just works. Occasionally it does not, and so there is a [name fixes](./backend/name_fixes.lua) file. Some internal name simplification is done to handle frequent issues, but there are still some edge cases. Feel free to submit a PR for any additional name fixes.

Also note that DLC and non-game content will not have HLTB data.

## How to submit a name correction pull request (PR)

We'll use Final Fantasy Tactics for this example.

1. Navigate to the Steam page and not the AppID: https://store.steampowered.com/app/1004640/FINAL_FANTASY_TACTICS__The_Ivalice_Chronicles/
2. Get the Steam API response for this game: https://store.steampowered.com/api/appdetails?appids=1004640
3. Note the Steam name for the game: FINAL FANTASY TACTICS - The Ivalice Chronicles
4. Find the game in HLTB: https://howlongtobeat.com/game/169173
5. Note the HLTB name for the game: Final Fantasy Tactics: The Ivalice Chronicles

So our mapping is: "FINAL FANTASY TACTICS - The Ivalice Chronicles" -> "Final Fantasy Tactics: The Ivalice Chronicles"

How to submit a PR

1. Fork this repo
2. Make the modification to `backend/name_fixes.lua` in your local copy
3. Commit and push
4. At the Github page for your repo, click the link towards the top about submitting a pull request
5. Send it to me and I will integrate it
6. The patch will make it into the next release of the HLTB plugin

More instructions [here](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).

## Development

Pull requests are welcome and appreciated! See the [development docs](./docs/README.md).

For name corrections please submit a pull request, direct submissions are not accepted. Automated tests will run and check for common problems.

Before submitting a name correction fix, please edit your local plugin file and test it locally by editing: `Steam/plugins/hltb-for-millennium/backend/name_fixes.lua`. This is also the fastest way to implement a name correction - the full release process for this repository and the Millennium plugin database can take 1-2 weeks or more.

## Credits

- [HLTB for Deck](https://github.com/morwy/hltb-for-deck/) for inspiration
- [How Long To Beat](https://howlongtobeat.com/) for the game completion data
- [Millennium](https://steambrew.app/) for the plugin framework
- [HowLongToBeat-PythonAPI](https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI) for HLTB API reference implementation

## Disclaimer

This plugin is not affiliated with, endorsed by, or connected to How Long To Beat or HowLongToBeat.com. All game data is sourced from their public website.

## License

MIT

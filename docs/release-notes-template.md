# Release notes template

Every release build (`./build.sh` or `make release`) writes this template below the line into `dist/release-notes-<version>.md`, with the words in double braces filled in (`{{version}}`, `{{built_at}}` and the others). Fill in the notes in angle brackets, remove any section that has nothing to say (but keep "What you must do" and "Going back", even when the answer is "Nothing" or "Yes, freely"), and give the file to the owner with the release files. It is written for the owner: plain words, what changed for them, what they must do. A later build of the same version writes the file again and keeps the earlier one as `release-notes-<version>.md.bak`. Copied in spirit from xWriter's `docs/release-notes-template.md`.

---

# xDesign {{version}}

**Built:** {{built_at}}
**Files:** {{files}} (the single file installs and updates by itself, the `-linux-` file on a Linux server and the `-windows-` `.exe` on a Windows server; its `.tar.gz` or `.zip` holds the same file alone; the `xdesign-desktop-` files are the desktop app: the `.exe` for Windows runs without installing and the `-setup.exe` installs it, the `.AppImage` for Linux, the `.zip` for macOS holds `xDesign.app`), `SHA256SUMS`{{signature_file}}
**Updates from:** version {{min_upgrade_from}} and newer. <From an older version, update to {{min_upgrade_from}} first. Remove this note when it is 0.0.0.>

## In short

<Two or three sentences: what this release is about.>

## What changed

- **New:** <what the owner and the members can do now that they could not before, one line each, with where to find it.>
- **Changed:** <what works differently now.>
- **Fixed:** <problems that are gone, described as the owner saw them.>
- **Known issues:** <what still does not work or works oddly, and what to do about it. "None known." if so.>

## What you must do

<Everything the owner has to do, in order. If nothing: "Nothing: update as usual.">

- **Before updating:** <for example "nothing", or "download the latest backup">
- **After updating:** <for example "nothing">

## How to update

On your computer, in the folder with the files (the single file of the server's CPU or its `.tar.gz`, either one):

```
scp xdesign-{{version}}-linux-amd64 SHA256SUMS root@SERVER_IP:/root/
```

On the server:

```
sudo xdesign update --dry-run /root/xdesign-{{version}}-linux-amd64
sudo xdesign update /root/xdesign-{{version}}-linux-amd64
```

On a Windows server, copy `xdesign-{{version}}-windows-amd64.exe` (or its `.zip`) and `SHA256SUMS` to the server, open a terminal as Administrator in that folder and run: <Remove this part when the release has no Windows server.>

```
xdesign update --dry-run .\xdesign-{{version}}-windows-amd64.exe
xdesign update .\xdesign-{{version}}-windows-amd64.exe
```

Or on the website: **Maintenance > Update**, drop the file (on Windows the `.exe` or its `.zip`, and `SHA256SUMS`{{signature_file}}), "Upload and check", then "Install and restart". xDesign backs up first and goes back by itself if the new version does not start. <For an arm64 server, the arm64 file or its tar.gz (zip on Windows).>

The desktop app: close xDesign and use the new file in place of the old one (`xdesign-desktop-{{version}}-windows-amd64.exe` on Windows, `xdesign-desktop-{{version}}-linux-amd64.AppImage` on Linux, `xDesign.app` from `xdesign-desktop-{{version}}-macos-amd64.zip` on macOS; arm64 for an arm64 computer). Installed with the setup file, run the new `xdesign-desktop-{{version}}-windows-amd64-setup.exe`: it updates xDesign in place. The designs stay in the data folder and the new version updates them at its first start. The files are not signed by Microsoft or Apple: the first time, Windows asks to confirm ("More info" > "Run anyway"); on macOS right-click `xDesign.app` > Open, or "Open Anyway" in Privacy & Security, and on newer Macs it may need `xattr -dr com.apple.quarantine xDesign.app`; on Linux make the `.AppImage` executable. <Remove this part when the release has no desktop app.>

## Going back

<One of these two:>

- `sudo xdesign rollback` (on Windows `xdesign rollback` in a terminal opened as Administrator, or "Roll back to <previous version>" in **Maintenance > Update**) returns to <previous version> without losing data.
- This release changes the database in a way <previous version> cannot read (its schema floor is {{schema_floor}}). Going back needs the backup the update took: `sudo xdesign rollback --restore-db` (on Windows without `sudo`, as Administrator, or "Also restore the data from before the update"), and everything changed after the update is lost.

The desktop app: once this version has opened the designs, an older version does not open them ("These designs were saved by xDesign {{version}}. Use that version or a newer one."). <Remove this note when the release has no desktop app.>

## For the developer

<Technical details for later sessions; the owner can skip this part.>

| Item | Value |
|---|---|
| Version and commit | {{version}}, `{{commit}}` |
| Built | {{built_at}}, {{go_version}} |
| Node.js | {{node_version}} |
| Payload SHA-256 | {{payload_sha256}} |
| Oldest version to update from | {{min_upgrade_from}} (`MIN_UPGRADE_FROM` in `tools/release/compat.env`) |
| Schema floor | {{schema_floor}} (`SCHEMA_FLOOR` in `tools/release/compat.env`) |
| Signature | {{signature}} |
| Tasks and decisions | <task IDs and decision log entries> |

`SHA256SUMS`:

```
{{sha256sums}}
```

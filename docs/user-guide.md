# xDesign user guide

This guide is for the owner of an xDesign site and for the people the owner adds. You do not
need to write code. Everything is done with clicks and typing.

---

## 1. What xDesign is

xDesign is a private website where you and the people you add design Telegram bots. You draw
what the bot says, what its buttons look like and what happens when a user presses a button or
answers a question. You never write code. When the design is ready, you export it. A developer (or
Claude) builds the real bot from the export.

xDesign never talks to Telegram and never runs a bot. It is a design tool.

You work on a map of boxes with arrows. Next to the map is a phone that looks like the Telegram
app. You click a box and edit its message right on the phone. Several people can work on the same
design at the same time, like in a shared document.

xDesign also comes as an app for one computer, with no server and no sign-in. Section 13
describes it.

### The words xDesign uses

| Word | What it means |
|---|---|
| Design | One bot: its steps, texts, buttons, languages and setup. |
| Map | The canvas with all the steps as boxes and arrows. |
| Step | One box on the map. It is a message, a question, an invoice, an action, or a logic box. |
| Message step | Something the bot sends: text, a photo, a file, a poll, a quiz, a dice and so on, with its buttons. |
| Invoice | A step that asks the user to pay, with Telegram Stars or a card. |
| Action | A step that does something in the chat: a reaction, a pin, a gift, a refund and so on. |
| Start point | Where a conversation starts or something happens: /start, a start link, a command, a text from the bottom keyboard, "anything else the user sends", a payment, a user who blocks the bot, a broadcast and more. |
| Button | A button under a message (inline) or in the keyboard at the bottom of the chat. It can have a look: Default, Blue, Green or Red. |
| Part | A row of buttons or a piece of text that you build once and use in many steps. |
| Variable | A value the bot remembers, for example the user's answer to a question. In texts it shows as a chip like `{name}`. |
| Test switch | A yes or no (or a choice) that you flip while trying the bot, for example "User is admin". An "If" step reads it. |
| Check | A warning or an error about a Telegram limit or a broken flow. |
| Try it | A way to click through the bot like a real user, inside xDesign. |
| Export | A zip file with the exact design, for the developer. |
| Comment | A note on a step, a button, a text or a spot of the map, for the people you work with. |
| Version | A saved copy of the design at one moment. You can look at it, compare it with now and go back to it. |
| Template | A design you can start a new design from. |
| View-only link | A link that lets anyone, without an account, look at the design and try it. |
| Claude link | A link that lets a developer or Claude read the design. |

---

## 2. Install on your server

You install xDesign once, on a Linux or Windows server that you control. The steps below are for
Linux; Windows has its own section, "Install on Windows", at the end of this chapter.

To use xDesign on your own computer instead, without a server, see section 13, "The desktop app".

### What you need

- A server running Ubuntu 24.04 or 26.04, Debian 12 or 13, or Fedora 43 or newer. It must be a
  64-bit Intel or AMD computer (amd64) or an ARM computer (arm64), with systemd.
- At least 1 GB of free disk space.
- A domain name (for example `design.example.com`) whose DNS record points at the server. You can
  install without a domain and use the server's IP address, but then the browser warns you about
  the certificate (see "No domain" below).
- A user on the server that can run `sudo`.
- The xDesign file for your server's CPU. It is one file, named like `xdesign-1.0.0-linux-amd64`
  (or `linux-arm64`). Next to it there is a `SHA256SUMS` file that lets you check the download.

### Step by step

1. Copy the xDesign file to the server. For example, from your own computer:

       scp xdesign-1.0.0-linux-amd64 SHA256SUMS you@your-server:~

2. Sign in to the server (for example with `ssh`), and go to the folder where you copied it.
3. Check that the file is whole:

       sha256sum --check --ignore-missing SHA256SUMS

   It must say `OK` for your file.
4. Make the file runnable:

       chmod +x xdesign-1.0.0-linux-amd64

5. Run the installer:

       sudo ./xdesign-1.0.0-linux-amd64 --install

   You can add `--dry-run` first. It shows every command and changes nothing.

The installer prints lines that start with `::`. It first prints ":: Checking this server..." and
shows what it found: the system, and whether another program uses port 80. If your system is not
supported, it stops and says so in plain words.

### The questions, in order

The installer asks only what it needs. Press Enter to take the answer in square brackets.

1. "Do you have an xDesign backup to restore? [y/N]". Answer `n` for a new site. Answer `y` if you
   are moving xDesign to a new server: it then asks for the path of the backup file, and later
   skips the owner questions, because the backup already holds the owner.
2. "Domain for xDesign (for example design.example.com), or leave empty to use this server's IP
   address:". Type your domain. The installer checks that the domain points at this server and
   warns you if it does not (DNS can take a while to spread; you can go on).
3. "Site port [34567]:". The installer proposes a random free port from 20000 to 60999. Press Enter
   to keep it, or type another free port. Port 443 works too when no other program uses it; the
   address then has no port.
4. "Web base path [/k3v9x2m1q8wz7r4t/]:". The installer proposes a random path. The site answers
   only under it, so nobody finds the sign-in page just by trying the port. Press Enter to keep
   it, or type your own: it starts and ends with `/` and has 1 to 3 parts of 4 to 64 letters,
   digits, `-` or `_`. A path of `/` works too, but then anyone who finds the port finds the
   sign-in page, and the installer warns you.
5. "HTTPS certificate". It is asked only when the site has a domain name. Choose how the site
   gets the certificate that makes the browser show the lock:

       HTTPS certificate:
         1) Let's Encrypt over port 80 (free, trusted by browsers)
         2) Let's Encrypt through Cloudflare DNS (free, trusted, needs a Cloudflare API token)
         3) The built-in certificate (browsers show a warning)
       Choose [1]:

   Press Enter to take 1 when port 80 is free; the answer proposed is 2 when another program uses
   port 80. Answer 1 or 2 or 3. Any other answer says "please answer 1, 2 or 3".

   - **1, Let's Encrypt over port 80.** The domain must point at this server and port 80 must be
     free. If another program uses port 80, the installer refuses 1 and says "Another program
     (nginx) uses port 80, so Let's Encrypt cannot check this server over it. Choose 2 or 3."
   - **2, Let's Encrypt through Cloudflare DNS.** It needs no open port 80. The installer then asks
     for the "Cloudflare API token:". Above the question it explains what the token is: a token with
     Zone Read and DNS Edit for the domain's zone, made in Cloudflare under My Profile > API Tokens.
     What you type is not shown on the screen. An empty answer asks again, and a token that does not
     look right is refused with the reason ("that is not a Cloudflare API token: it has at most 200
     printable characters and no spaces; copy it again from Cloudflare (My Profile > API Tokens)").
   - **3, the built-in certificate.** It works anywhere, but browsers warn once. You can choose
     another certificate later in Settings > HTTPS.

   With an IP address, or a domain name that Let's Encrypt does not take, there is no question: the
   installer says "Let's Encrypt needs a domain name; xDesign uses its built-in certificate."
6. The firewall. For each port the site needs, it asks "Open port 34567 in the firewall? [Y/n]"
   (and the same for port 80 when it is free, so that Let's Encrypt over port 80 can work now or
   later). It uses `ufw` on Ubuntu and Debian when `ufw` is active, and `firewalld` on Fedora. If
   your hosting company has its own firewall in its web panel, open the same ports there yourself.
7. "Owner username [owner]:" and "Owner name:". This is you, the site owner. Press Enter to take
   the username `owner`, or type your own: 3 to 32 letters a to z, digits, dots, underscores or
   hyphens, starting with a letter or a digit. If it is not allowed, the installer says why, for
   example "A username has 3 to 32 characters." or "Use letters a to z, digits, dots, underscores and
   hyphens, starting with a letter or a digit.", and asks again.
8. A short summary with the address and the certificate, then "Proceed with installation? [Y/n]".
   The line "HTTPS:" says what you chose: "Let's Encrypt over port 80 for design.example.com",
   "Let's Encrypt through Cloudflare DNS for design.example.com" or "the built-in certificate".

If you install again over a site that is already here, the installer keeps its port and path and
does not ask for them, and it keeps its HTTPS settings too ("the HTTPS settings are kept"). A
site restored from a backup keeps the port and path of the server it is restored on. To move the site to another port or path later, use
`sudo xdesign admin set-port` or `sudo xdesign admin set-path` (see section 11), or the "Site
address" card in Settings (see section 9).

### Installing without questions

For a script, add `--yes`: the installer then asks nothing and takes your flags and its own
defaults. The flags you will use most:

| Flag | What it sets |
|---|---|
| `--domain NAME` | The site's domain, for example `design.example.com`. Without it the site uses the server's IP address. |
| `--port N` | The port, instead of a random free one. |
| `--base-path PATH` | The web base path. |
| `--owner-username NAME` and `--owner-name NAME` | The site owner. The username is `owner` when you leave the flag out. On a site without an owner, `--yes` needs `--owner-name`. |
| `--https letsencrypt`, `--https cloudflare` or `--https builtin` | The certificate of a site with a domain name: Let's Encrypt over port 80, Let's Encrypt through Cloudflare DNS, or the built-in one. |
| `--cloudflare-token TOKEN` | The Cloudflare API token that `--https cloudflare` needs. |
| `--dry-run` | Shows the plan and every command, and changes nothing. |

Without `--https`, `--yes` takes Let's Encrypt over port 80 when the site has a domain name and
port 80 is free. If another program uses port 80, it keeps the built-in certificate and says so
("Another program (nginx) uses port 80, so Let's Encrypt cannot check this server over it: xDesign
uses its built-in certificate (--https cloudflare gets one through Cloudflare DNS)."). The
installer refuses before it changes anything when `--https` is not one of the three words, when
`--https cloudflare` has no `--cloudflare-token`, when `--cloudflare-token` comes without `--https
cloudflare`, when the token does not look right, when Let's Encrypt is asked for an IP address, and
when `--https letsencrypt` is asked while another program uses port 80. A site that keeps its HTTPS
settings ignores `--https` and says so.

### How HTTPS works

xDesign always does HTTPS itself, on its own port. It leaves ports 443 and 80 to the other
programs on the server, so nginx, Caddy, Apache or another web panel keep working as before.

- The installer always starts the site with a certificate xDesign made itself. Then, when you chose
  Let's Encrypt at the "HTTPS certificate" question, it asks the running site to get the real one
  before it finishes, and tells you how that went (see "The end of the install").
- With "Let's Encrypt over port 80", xDesign uses port 80 only while Let's Encrypt checks the
  server. With "Let's Encrypt through Cloudflare DNS" it does not need port 80 at all.
- If another program uses port 80, the installer proposes the Cloudflare choice, or the built-in
  certificate. You can change the choice later in Settings > HTTPS (see section 9).
- The certificate renews by itself. "Renew now" in Settings > HTTPS renews it at once (see section
  9).

On Fedora, with SELinux on, the installer asks one extra question so that xDesign may use its port.
Answer Y.

**No domain.** If you leave the domain empty, the site opens at the server's IP address with a
certificate that xDesign made itself, and the installer does not ask the certificate question. Your
browser warns once. Accept it to go on. You can add a domain later in Settings (see section 9).

### The end of the install

The installer shows each step with a progress bar. Near the end, under ":: Finishing...", comes the
step "HTTPS certificate" when you chose Let's Encrypt. It shows each new line of what the
certificate manager is doing, which can be long and technical, and waits up to 5 minutes. It ends
in one of three ways:

- "Certificate issued by Let's Encrypt, valid until <date>." The browser will show the lock.
- A failure in plain words, for example that the domain does not point at this server yet or that
  the Cloudflare token was refused. The installation still finishes: the site works with the
  built-in certificate, and your choice stays in Settings > HTTPS with its problem. Fix what the
  message says, then open Settings > HTTPS and click "Try now".
- "Let's Encrypt is still working; see Settings > HTTPS." The certificate is not ready yet. Look at
  Settings > HTTPS in a few minutes.

If the site cannot be asked for the certificate at all, the installer warns that xDesign uses its
built-in certificate for now and tells you to choose Let's Encrypt in Settings > HTTPS. Press
Ctrl+C while it waits and the installation stops, but the site goes on asking.

When it is done, it prints a block like this:

    :: xDesign 1.0.0 is running.
       Open:     https://design.example.com:34567/k3v9x2m1q8wz7r4t/
       HTTPS:    a certificate from Let's Encrypt, valid until 4 Jan 2027
       Username: owner
       Password: (32 letters and digits)   (shown only now; change it under Account)
       Keep this address: the site answers only there. sudo xdesign status shows it again.
       Service:  systemctl status xdesign     Logs: journalctl -u xdesign -f

The "HTTPS" line tells you how the certificate went. It can also say "the built-in certificate while
Let's Encrypt works (Settings > HTTPS shows how it goes)", "the built-in certificate: Let's Encrypt
did not issue one (Settings > HTTPS says why and has Try now)", "the built-in certificate (Settings
> HTTPS chooses another)" or "the built-in certificate (browsers show a warning)".

Copy the password now. It is shown only this once. If you lose it, run
`sudo xdesign admin reset-password owner` on the server to make a new one.

Keep the whole address too, with its port and its path. The site answers only there: any other
address of the server shows an empty page. If you lose it, run `sudo xdesign status` on the server.
If your hosting company has a firewall in its web panel, allow the site's port there, or the site
seems down.

### Signing in the first time

1. Open the address from the "Open" line in your browser.
2. Type the username and the password from the installer and click "Sign in".
3. Click your avatar at the top right, then "Account". Under "Change password" type the password
   from the installer as the current one, and choose a new password of your own.

Running the installer again is safe. If the same version is already installed, it says so and asks
"Proceed with repair? [Y/n]". It repairs what is missing and keeps your password and your data.

The installer writes its log to `/var/log/xdesign-install.log`. The password is hidden in the log.

### Install on Windows

xDesign installs on a Windows server too, with the same site, the same questions and the same
sign-in. The steps above are for Linux; this section tells what is different, and points back to
them for what is the same.

**What you need.**

- Windows Server 2019, 2022 or 2025, Windows 10 (version 1809 or later) or Windows 11. It must be
  64-bit: an Intel or AMD computer (amd64) or an ARM computer (arm64). Older Windows is refused,
  and the installer says which systems it takes.
- At least 1 GB of free disk space on the drive of `C:`.
- A domain name, as for Linux (see "What you need").
- An account that is an Administrator.
- The xDesign file for the computer's CPU: `xdesign-1.0.0-windows-amd64.exe` (or
  `windows-arm64`). There is also `xdesign-1.0.0-windows-amd64.zip`, which holds that one file
  alone (see "Building the file" below). The `SHA256SUMS` file lets you check the download.

**Step by step.**

1. Copy the file (and `SHA256SUMS`) to the server, for example through Remote Desktop or a shared
   folder.
2. Check that the file is whole. Open PowerShell in the folder that holds it and run:

       (Get-FileHash .\xdesign-1.0.0-windows-amd64.exe -Algorithm SHA256).Hash

   Compare the result with the line for your file in `SHA256SUMS` (the case of the letters does
   not matter). If you have the `.zip`, check the `.zip` the same way, then unzip it.
3. Open a terminal as Administrator: click Start, type `PowerShell`, right-click "Windows
   PowerShell" and choose "Run as administrator". Go to the folder with the file and run the
   installer:

       .\xdesign-1.0.0-windows-amd64.exe --install

   You can add `--dry-run` first. It shows every command and changes nothing.

You can also double-click the file. Windows asks "Do you want to allow this app to make changes to
your device?"; answer Yes and the installer opens in a new window. When it ends, the window says
"Press Enter to close this window." so you can read it. If you answer No, it says "Run this in a
terminal opened as Administrator." In a terminal that is not opened as Administrator, the installer
stops with that same sentence before it changes anything.

The installer prints the same lines that start with `::` and asks the same questions, in the same
order as the Linux installer ("The questions, in order"), with the same flags for a script
(`--yes`, `--domain`, `--port`, `--base-path`, `--owner-username`, `--owner-name`, `--https`,
`--cloudflare-token`, `--dry-run`), except that there is no `--undo-selinux`. The installer's
colors are on, and what you type for a Cloudflare token is not shown. The differences:

- **The check.** ":: Checking this server..." shows the Windows version with its build, for example
  "Windows Server 2022 Datacenter (build 20348), amd64", and who uses port 80. It also checks the
  clock and warns if it is not in sync (run `net start w32time`, then `w32tm /resync`).
- **IIS on port 80.** When port 80 is in use by IIS or another program of that kind, the check
  says "(IIS or another HTTP.sys program) in use". Then "Let's Encrypt over port 80" is refused
  and the installer proposes the Cloudflare choice or the built-in certificate, as for nginx on
  Linux (see "How HTTPS works"). Stopping IIS's site on port 80 frees the port.
- **The firewall question.** When Windows Defender Firewall is on, the installer asks "Open port
  34567 in Windows Firewall? [Y/n]" for the site's port (and port 80 when it is free, for Let's
  Encrypt). Answer Y: it makes a rule named "xDesign (TCP 34567)". If your hosting company has its
  own firewall in its web panel, open the same ports there yourself. There is no SELinux
  question.
- **Where things are.** The program is in `C:\Program Files\xDesign`, and `xdesign` works in any
  terminal you open after the install (the installer adds the folder to the system PATH). The
  data is in `C:\ProgramData\xDesign`: `config.toml`, the database and the media in `data`, the
  backups in `backups` (the daily one, at 03:30 server time, and the ones before an update or a
  restore, as on Linux), the logs in `logs`. Only Administrators and the system can open that
  folder, besides xDesign's own service. The installer's log is
  `C:\ProgramData\xDesign\logs\install.log`.
- **The service.** xDesign runs as the Windows service `xdesign` ("xDesign"), which starts with
  Windows and starts again by itself if it stops. A second service, `xdesign-maintenance`, does
  the updates and restores; it runs only while it works and is normally "Stopped".

The end of the install is the block of section 2's "The end of the install", with the Windows
words for the last line:

       Service:  Get-Service xdesign     Logs: xdesign logs -f
       Keep this address: the site answers only there. xdesign status shows it again.

**Installed apps.** The installer lists xDesign in Windows' list of installed apps: open Start,
Settings, Apps, "Installed apps" and find "xDesign", with its version. Click its menu and
"Uninstall". Windows asks "Do you want to allow this app to make changes to your device?"; answer
Yes and a window opens with the uninstall's questions (section 11) and ends with "Press Enter to
close this window." If you answer No, it says "Run this in a terminal opened as Administrator."
and waits for Enter. After an update or going back, the list shows the new version. The uninstall
removes the entry. You can also uninstall from the website ("Uninstall xDesign" in section 10).

If you lose the password, run `xdesign admin reset-password owner` in a terminal opened as
Administrator. Running the installer again is safe, as on Linux ("Proceed with repair? [Y/n]").
If a step fails, run the installer again: it goes on where it stopped. If the site does not start,
the installer shows the last lines of the service's log and names `xdesign logs --lines 50`.

HTTPS, the owner, the sign-in, the website and its Settings and Maintenance are the same as on
Linux. A backup made on Linux restores on Windows, and the other way round: the designs, the
media and the certificates come back, and the server keeps its own settings.

### Building the file

The files of a release are built by `./build.sh`, on the computer where you build releases. After the version, it asks what to build:

```
:: What to build:
   1) Server   2) Desktop app   3) Both
   Choose [1]:
:: Server for:
   1) Linux   2) Windows   3) Both
   Choose [1]:
:: CPUs:
   1) amd64   2) arm64   3) both
   Choose [3]:
```

"Server for" is asked only when a server is built; with the desktop app it also asks "Desktop app
for" and, for Windows, "Windows desktop file" (section 13). Enter at every question builds the
Linux server for both CPUs. A wrong answer says "warning: the choice is 1, 2 or 3, not: 7" and asks
again.

To skip the questions: `./build.sh --version 1.0.0 --servers linux,windows --arches amd64,arm64`.
`--servers` takes `linux`, `windows` or both, and `--desktops` takes `windows`, `linux`, `macos` or
`none`; `--windows-desktop` takes `portable`, `installer` or `both` (the Windows desktop app as the
portable file, as a setup file or as both; `portable` when not given, and `make release` takes
`WINDOWS_DESKTOP=both`). Naming one of `--servers` and `--desktops` leaves the other at its default
(the Linux server, no desktop app), and naming both as `none` stops with "nothing to build". `make release VERSION=1.0.0
SERVERS=linux,windows` does the same. The Windows server needs `zip` and `unzip` on the build
computer; `./build.sh` checks for them before it builds. The files are made in `dist/`:

| What | Files |
|---|---|
| Linux server | `xdesign-<version>-linux-<cpu>` and its `.tar.gz` |
| Windows server | `xdesign-<version>-windows-<cpu>.exe` and its `.zip` (the `.exe` alone) |

`<cpu>` is `amd64` or `arm64`. All of them are in `SHA256SUMS` and in the release notes.

---

## 3. Accounts and people

xDesign is private. There is no public sign-up. The site owner adds each person, and everyone
signs in with a username and a password.

### Signing in and out

- Open the site's address. Type your username and password, then click "Sign in".
- If you type a wrong username or password, you see "Username or password is wrong."
- After five wrong tries you see "Too many tries. Wait 15 minutes or ask the site owner to set a new
  password."
- If you turned on two-factor sign-in (see "Your account" below), a right password brings you to
  "Enter your code" and "Two-factor authentication is on for your account." Open your authenticator
  app and type the 6-digit code it shows for xDesign. It is sent by itself when you type the sixth
  digit. A wrong code says "Wrong code. 4 attempts left." (the number goes down). After the fifth
  wrong code you see "Wrong code, and no attempts are left. Enter your password again." and start
  over with the password. The step lasts 5 minutes; after that you see "The sign-in step expired.
  Enter your password again." Wrong passwords and wrong codes count together: after too many, you
  see "Too many failed attempts. Wait and try again."
- No phone at hand? Click "Use a recovery code" and type one of the recovery codes you saved when
  you turned two-factor sign-in on (they look like `XXXX-XXXX-XXXX-XXXX`). Each code works once.
  After it you see how many are left ("9 recovery codes left."), and at 3 or fewer a warning tells
  you to create new ones on your Account page. "Use a code from the app" goes back.
- If your session ended while you were working, the site takes you to the sign-in page with "Sign
  in to continue." and brings you back to the page after you sign in.
- To sign out, click your avatar, then "Sign out".

### Your account

Click your avatar, then "Account".

- **Name.** Change it and click "Save". You see "Name saved."
- **Username.** It is shown here. Only the site owner changes usernames: a member asks the site
  owner ("Only the site owner changes usernames."). If you are the site owner, change it and click
  "Save". You see "Username saved." A username already in use shows "Someone on this site already
  uses this username." under the field.
- **Color.** Pick a color. Other people see it as the color of your cursor and your name tag when
  you work in the same design.
- **Change password.** Type your "Current password" and a "New password" (at least 10 characters),
  then click "Change password". Very common passwords are refused with "This password is too
  common. Choose another one." Changing the password signs you out on your other devices.
- **Two-factor authentication.** A code from an authenticator app on your phone, asked at every
  sign-in after the password. It says "On" or "Off". It is your own choice: nobody is made to turn
  it on. See "Two-factor sign-in" below.
- **Sessions.** Every device where you are signed in is listed with when it was last used. Click
  "Sign out" beside one to end it. Click "Sign out everywhere else" to end all but this one. A
  session lasts 30 days from its last use.
- **Claude.** "Claude can do everything you can do in xDesign, as you. Actions that cannot be undone
  ask you first." Here you make API keys for Claude Code and connect the Claude app. The steps are
  in "Connecting Claude to your designs" in section 8.

**Light and dark.** The sun and moon button in the top bar, left of the comments' bell, switches
the whole site between Light and Dark. It shows a sun while the site is dark ("Switch to light
mode") and a moon while it is light ("Switch to dark mode"). Until you press it, the site follows
your computer's Light or Dark. After that it remembers your choice for you, on every device you sign
in on. The sign-in page uses the last choice your browser kept. The phone in the editor and Try it
keep their own Light and Dark (see "The top bar" in section 5), and a printed page keeps its paper
colors.

### Two-factor sign-in

With two-factor sign-in, a stolen password alone does not open your account. You need a free
authenticator app on your phone, for example Google Authenticator, Microsoft Authenticator, 2FAS
or Aegis.

**Turning it on.**

1. On the Account page, under "Two-factor authentication", you see "Two-factor authentication is
   off", "Turning it on signs out your other sessions." and "Without it, the password alone opens
   xDesign." Click "Turn on".
2. "Confirm it's you": type your password and click "Continue".
3. "Scan the QR code". In your authenticator app add an account and scan the code. If you cannot
   scan it, click "Copy key" and type the key (shown in groups of 4) into the app instead. The
   account is called "xDesign (<your site's domain>):<your username>". "Finish within" a countdown
   tells you how long the setup stays open (15 minutes). Click "Next".
4. "Enter the code from the app": type the 6-digit code the app now shows for xDesign and click
   "Turn on". A code that does not match says "The code does not match. Enter the code the
   authenticator app shows now for xDesign." If the setup ran out, you see "There is no unfinished
   two-factor setup, or it expired. Start the setup again."
5. "Save your recovery codes". Ten codes show once, and only now: "If you lose your phone, each code
   signs you in once instead of a code from the app." Click "Copy codes" or "Download" (a file named
   `xdesign-recovery-codes.txt`) and keep them somewhere safe, other than the phone. Tick "I saved
   these codes" and click "Done".
6. You see "Two-factor authentication is on. Other sessions were signed out." The card says "On" and
   "10 recovery codes left."

**Signing in** is described under "Signing in and out" above.

**"Confirm it's you".** Some actions ask you to prove it is you: changing the HTTPS settings,
downloading or restoring a backup, installing an update and so on. With two-factor sign-in on, the
dialog asks "Current password" and then "6-digit code", or "Recovery code" after "Use a recovery
code". A code works once, so a failed try clears the field. A wrong one says "Wrong code. Check the
code in your authenticator app and try again." Turning two-factor sign-in on closes the confirmation
you had open, so the next such action asks again.

**New recovery codes.** The card shows "N recovery codes left." (and at 3 or fewer: "Create new ones
so you do not get locked out."). Click "New recovery codes", confirm with your password and a code
or a recovery code, and click "Create codes". The old codes stop working at once.

**Turning it off.** The card says "Turn off two-factor authentication" and "The password alone
then opens xDesign. Your other sessions are signed out." Click "Turn off", confirm with your
password and a code or a recovery code, and click "Turn off" again. You see "Two-factor
authentication is off. Other sessions were signed out."

If you turn it on or off, your other sessions are signed out. A new password set by the site owner does not turn
two-factor sign-in off. If you lose your phone and your recovery codes, ask the site owner (see
"Managing members" below). The site owner, if it is them, runs `sudo xdesign admin reset-2fa
<username>` on the server (see section 11).

### Adding someone (site owner)

Only the site owner adds people. There are no invite links: you make the account yourself and give
the person their username and password.

1. Click "Members" in the top bar.
2. Click "Add member".
3. Type a "Username" (3 to 32 letters a to z, digits, dots, underscores or hyphens, starting with a
   letter or a digit), a "Name" and a "Password" (at least 10 characters). Click "Generate" inside
   the password field to make one (20 letters and digits, shown at once), click the eye to show or
   hide it, and click "Copy" to copy it so you can send it to the person.
4. Click "Add member". "Confirm it's you" asks for your password (and your code if you have
   two-factor sign-in on). You see "Added <name>."

The account works at once and never expires. The person signs in with the username and the
password you chose, then can change the password on their Account page. A username already in use
shows "Someone on this site already uses this username." under the field, and a very common
password "This password is too common. Choose another one."

Old invite and password reset links no longer work. An invite link says "Invite links no longer
work. Ask the site owner for an account." and a reset link says "Password reset links no longer
work. Ask the site owner to set a new password.", each with "Go to sign in".

### Managing members (site owner)

On the "Members" page every person is listed with their name, their username ("@<username>") and
their role on the site: you are the "Site owner" and everyone else is a member. Click "Add member"
to make an account (see "Adding someone" above). The search box "Name or username" narrows the list
by a name or a username (an "@" before it is fine); if nobody matches you see "No member matches."
Click the menu on a person's row for these actions.

When the site was updated to usernames, every account got one made from its name (lower case, with
dots between the words, the oldest account first, so the site owner gets the plain one; a second
"sara" becomes "sara2", and a name with no letters a to z gives "user", "user2" and so on). Each one
shows in Settings > Activity as "Gave <name> the username <username>". Read them on this page and
tell each person theirs; change one with "Change username".

- **Set password.** Use this when someone forgot their password. Type a "New password" (or click
  "Generate"), click "Set password" and confirm with "Confirm it's you". The person is signed out
  everywhere and signs in with the new password from then on. If they had used up their tries at
  sign-in, they can sign in with it at once. Tell them the password yourself; they can change it on
  their Account page. On your own row the item says "Change your password on the Account page" and
  opens that page.
- **Change username.** Type the new username and click "Change". Nobody is signed out and the
  password stays. It works on your own row too.
- **Disable.** Their sessions and live connections end at once. Their designs stay and keep their
  sharing. A disabled person sees "This account is disabled. Ask the owner to enable it." when
  they try to sign in.
- **Enable.** Gives access back.
- **Turn off two-factor authentication.** Shown only while the person has it on. Use it when
  someone lost their phone and their recovery codes. After "Confirm it's you" (your password, and
  your code if you have two-factor sign-in on), it says "<name> loses their authenticator app and
  recovery codes and is signed out everywhere. They can turn it on again on their Account page."
  Click "Turn it off". You see "Two-factor authentication is off for <name>. They were signed out
  everywhere." They then sign in with the password alone. You cannot do this for yourself here: turn
  your own off on your Account page, or on the server with `sudo xdesign admin reset-2fa <username>`.
- **Remove.** Removes the person for good. If they own designs, you must pick someone under "Move
  their designs to" first. You cannot disable or remove the site owner.

### Roles on a design

The site owner can open and manage every design on the site. Every member can create designs.
On each design a person has one role:

| Role | What the person can do |
|---|---|
| Owner (the design's owner) | Everything an Editor can do, plus share the design, make view-only links and Claude links, save it as a template, and delete it. This is the member who made it. |
| Editor | Edit everything, upload files, export, print, use Try it, write comments, name versions and go back to an earlier version. |
| Commenter | See everything, use Try it, export and print, and write comments. Cannot change anything else. |
| Viewer | See everything, read comments and versions, use Try it, export and print. Cannot write comments and cannot change anything. |

Duplicating a design is allowed for every role. The copy belongs to the person who duplicated it,
and nobody else has access to the copy.

---

## 4. Designs

Click "Designs" in the top bar. This is the page with all the designs you can open.

### Making a new design

1. Click "New design".
2. Type a "Name".
3. Pick the "Default language". English is chosen at first. Type in the field to search.
4. Optional: under "More languages", add the other languages the bot will speak. You can add or
   remove languages later in the editor.
5. Click "Create".

The editor opens with a start point "/start" and one empty message called "Main menu".

You can also start from a template instead of an empty design: click "Start from a template" in
this dialog, or click "New from template" on the Designs page. See "Templates" below.

If you already have an export, click "Import" instead (see section 8).

### Finding designs

- Type in "Search designs" to find a design by part of its name.
- Click a filter: "All", "Mine", "Shared with me" or "Trash". The site owner sees every design on
  the server under "All".
- Each card shows the name, the owner, your role, when it was last edited and by whom, and the
  number of steps and the languages, for example "2 steps" and the language names.
- When a design has comments you have not read, a number shows on the card's picture. It has an
  "@" when some of them mention you. See "Comments" in section 5.

### The card's menu

Click the menu on a card.

- **Open.** Opens the editor.
- **Rename.** Type a new name. (Only the design's owner and the site owner.)
- **Duplicate.** Makes a copy called "<name> (copy)" that belongs to you.
- **Share.** Opens the Share dialog. (Only the design's owner and the site owner.)
- **Export.** Opens the export dialog (see section 8).
- **Refresh pictures for Claude.** Makes new pictures of the design for Claude (see section 8).
- **Save as template.** Makes a template from the design (see "Templates" below). (Only the
  design's owner and the site owner.)
- **Delete.** Asks first: "Delete "<name>"?" and "It moves to Trash for 30 days. The people it is
  shared with lose it until it is restored." Click "Delete" to go on, or "Cancel" to keep the
  design. Then it moves to Trash and you see "Moved <name> to Trash." with an "Undo" button. (Only
  the design's owner and the site owner.)

### Trash

Click the "Trash" filter. A deleted design stays here for 30 days and then it is removed for good,
with the files that only it used. Only the design's owner and the site owner see it in Trash.

- "Restore" puts the design back.
- "Delete forever" asks "Delete <name> forever?" and says "This cannot be undone." Confirm to
  remove it at once.

People who had the design open when it was deleted are taken out of the editor.

### Sharing a design

Click "Share" in the card's menu, or the "Share" button in the editor. (The button shows for the
design's owner and the site owner.)

- **People with access.** Everyone who has access is listed. The design's owner is shown as "Owner".
  Change another person's role in the drop-down (Editor, Commenter or Viewer), or click "Remove".
- **Add people.** Type a name or username in "Name or username", pick the member (each one shows
  "@<username>"), pick a role, then click "Add". You can only add people who already have an
  account on the site. For someone new, the site owner must add them first: "Not on the site yet?
  Ask the site owner to add them."

Changes take effect at once. Someone you remove sees "You no longer have access to this design."
and their editor closes. Someone you change to Viewer becomes read-only within a second.

### Handing a design to someone else (site owner)

In the Share dialog, the site owner's role drop-down also has "Owner". Pick it for a person and
confirm "Make <name> the design owner?" with "Make owner". The new owner owns the design. The old
owner becomes an Editor.

### View-only links

A view-only link lets a person look at your design and try the bot without an account. Use it for
a client or a friend who should see the bot but not change it. Only the design's owner and the
site owner can make one.

**Making a link**

1. Click "Share" (on the card's menu or in the editor).
2. Find "View-only link". Choose when it ends in "Expires": "1 day", "7 days", "30 days" or
   "Never expires". The last one is chosen at first.
3. Click "Create link".
4. The link is shown once, with "The link is shown only now." Click "Copy" and send it.

Below, every link that still works is listed. Each shows "Made <time ago>", "Valid until <date>"
or "Never expires", and "Last used <time ago>" or "Not used yet". You can make several links, for
example one for each person, and revoke them one by one.

**Stopping a link.** Click "Revoke" beside it. It stops working at once, and a page that was open
shows "This link no longer works. Ask the person who sent it for a new one." An expired link
stops the same way. A link also stops while the design is in Trash, and works again when you
restore the design.

**What the visitor sees.** The editor in a read-only form, on the map only: the map, the phone, the
design's name and its owner's name, "Read only", the language and look switches, "Try it" and
"Export". It follows your changes as you make them. There are no comments, no history, no Share, no
palette and no tabs. The visitor does not see who else is in the design, and nobody sees the
visitor.

The "Export" of a view-only page works as an export, but has no "Version" and no "Include open
comments".

### Templates

A template is a whole design you can start a new design from. Click "Designs" in the top bar,
then "New from template". The page "Templates" has two groups.

- **Starter templates.** They come with xDesign, in English and Persian: "Shop with Stars" (a
  shop with two products, paid in Stars), "Support desk" (questions, office hours and tickets),
  "Quiz" (three quiz questions and a score) and "Sign-up form" (questions for a name, an email, an
  age and a phone number). Each card shows the name, a short description, the number of steps and
  the languages.
- **This site's templates.** The templates that people on your site saved. Each card says "Saved
  by <name>" and when. When there are none, you see "No templates of this site yet."

**Using one.** Click "Use this template" on a card. A new design opens. It is yours, it is not
shared, and you can change everything in it.

**Saving your own.** Open the card's menu on the Designs page (or the "..." menu in the editor) and
click "Save as template". Only the design's owner and the site owner see it. A dialog asks for a
"Name" (the design's name at first) and a "Description" (for example "What the template is for").
Click "Save as template". A copy of the design as it is now goes to "This site's templates", where
every member can use it. Your own design does not change.

**Removing one.** Open the menu on a template of this site and click "Remove". Only the person who
saved it and the site owner can. xDesign asks "Remove the template <name>?" and tells you that the
designs made from it stay. Starter templates cannot be removed.

---

## 5. The editor

Open a design from the Designs page. The editor fills the window.

### The top bar

From left to right:

- **Designs** (with an arrow). Goes back to the Designs page.
- **The design's name.** Click it to rename the design. You can also rename it from the card.
- **The tabs.** "Map" (the map and the phone), "Bot setup" and "Texts".
- **People.** The avatars of the other people who have the design open. Hover to see who it is
  and which step they are editing. Click one to jump to it.
- **The save state.** It says "Saved" or "Saving..." while you work. Other states are in section 12.
- **The language.** Shows the code of the language you see, for example "EN". Click it to switch
  the language for the phone and the map, or to open "Languages...".
- **The phone's look.** The look of the Telegram app: Web A, Web K, Desktop, Android or iOS, and
  Light or Dark. It starts at Android and Light. xDesign remembers your choice in your browser.
  The look changes only how the phone is drawn. It does not change the design. The editor itself
  follows the site's Light or Dark (the sun and moon button in the top bar of the other pages, see
  section 3); the phone's Light or Dark is its own and does not change the site.
- **Checks.** A count of errors and warnings. Click it to open the list (section 6).
- **Try it.** Click through the bot (section 7).
- **Comment.** Turns comment mode on and off (the C key does the same). For Editors and
  Commenters. See "Comments" below.
- **The bell.** The number of comments you have not read, in all your designs. See "Comments"
  below.
- **Share.** For the design's owner and the site owner.
- **Export.** Makes the zip for the developer (section 8).
- **The "..." menu.** "Duplicate design", "Save as template" (the design's owner), "Print",
  "Refresh pictures for Claude", "Comments", "History", "Name this version" (Editors) and
  "Keyboard shortcuts".

Your changes are saved by themselves as you type. There is no Save button.

Undo and redo only touch your own changes, not other people's.

### The palette (left)

The palette lists what you can add. Click an item to add it in the middle of the map, or drag it
onto the map. The new step is selected and its editor opens.

- **Add.** "Message", "Question", "If", "Remember", "Wait", "Developer step", "Go to", "End",
  "Note", "Section", "Invoice" and "Action".
- **Start points.** "+ Command", "+ Start link", "+ Anything else (fallback)", "+ Payment done",
  "+ Refund", "+ Subscription changed", "+ User blocks the bot", "+ User restarts the bot" and
  "+ Broadcast".
- **Parts.** Your reusable parts, and "+ Part".
- At the bottom: "Variables" and "Test switches".

Editors see the palette. Commenters and Viewers do not.

### The map

Every step is a box. A message shows the first line of its text, and its buttons as small pills in
their looks. A logic box shows its outcomes as small labeled dots, for example "Yes" and
"Otherwise". Arrows show where a button or an outcome leads.

**Adding and connecting**

- To add a step, click it in the palette or drag it onto the map.
- To connect, drag from a button's dot (or from an outcome's dot) to another box. An arrow
  appears.
- If you drop the arrow on empty space, a menu "New step here" opens. Pick the kind of step. It is
  made right there and connected.
- To remove an arrow, click it and press Delete.

**Following the lines**

- Select a step (a click, Shift and a click, or a frame around several) and every line out of it
  and into it turns bold in the brand color, with its name at its middle: the button's text, or
  the name of the outcome or case ("Then", "Valid answer", "Wrong 3 times", "Cancel",
  "Otherwise"), cut after 24 characters with "...", and "No text" for a button without text. The
  name can end with the click mode ("Edit", "New", "Replace") and the bell. Every other box and
  line fades, except the boxes at the other ends of the bold lines, so you can read where each
  line goes, and the sections. Click the empty map and everything comes back. Selecting only notes
  or sections fades nothing.
- Point at a button or at an outcome's dot and its one line turns bold with its name, and the box
  it goes to gets an outline. Point at any line to read its name.
- In a big design a line that goes far is not drawn across the map. It is a short tag at the right
  of its box, at the height of its button: a pill with an arrow and the title of the step it goes
  to (20 characters, then "..."). A line becomes a tag when it goes into a step inside a section
  from outside that section, into a step that 5 or more lines come to (a main menu), or when it
  is longer than about 1,600 map pixels. Point at a tag to read "Goes to <title>" (and the section,
  when it is another one). Click a tag and the map moves to that step and selects it, with its
  lines drawn in full. A tag fades with the rest when a step is selected.
- "Back", first in the map's tools at the bottom right, returns to where you were before a jump,
  one place at a time (up to 10 places). It goes away when you move the map yourself: drag it,
  scroll it, use the minimap or the zoom buttons, or click "Fit".
- A box that lines come to as tags shows "<N> come here" in its header, for example "29 come
  here". Click it to see "Comes here from": each step with its line's name. Click one to jump
  there.
- The switch "Lines: Short tags | All lines", last in the map's tools, chooses how far lines
  show. "All lines" draws every line across the map, as before. Your choice is yours alone and is
  kept on your account. It works on a screen without editing too (a Viewer, a Commenter, a view-only
  link, which starts with "Short tags").

A big design opens fast now: the map shows within a few seconds and can be moved and zoomed at
once. A box redraws only when it changes, and its "..." menu and the dots' list of issues are made
the first time you use them, so the very first hover over a dot can need one more move of the
pointer.

**Moving and selecting**

- Drag a box to move it. Click a box to select it. Hold Shift and click, or Shift and drag a
  frame, to select several.
- The arrow keys move the selected boxes a little. With Shift they move further.

**The box menu**

Every box has a "..." menu with "Edit", "Duplicate", "Copy", "Make a part from its buttons"
(on messages and questions), "Add a note", "Comment" (for people who can edit) and "Delete". "Delete" tells you which arrows into the
box it will clear. "Add a note" writes a note for the developer. It is shown with the step in the
export. The "/start" box cannot be duplicated or deleted.

**Sections**

A "Section" is a colored frame with a title. Steps you drag into it belong to it. Drag a section
by its title bar and its steps move with it. Resize it by a corner. Sections keep a big map
tidy.

**Auto-arrange, fit and search**

- At the bottom right of the map are "Back" (see "Following the lines" above), a minimap, zoom
  buttons, "Fit", "Auto-arrange" and the switch "Lines: Short tags | All lines".
- "Fit" shows the whole map. The F key does the same.
- "Auto-arrange" lines the boxes up from left to right and keeps sections together. It is one
  step in the undo list, so Ctrl+Z puts everything back.
- Press Ctrl+F, or click the search tool, to search. Type a word. It finds steps, buttons and
  texts in every language. Press Enter to jump to the next match.

**Copy and paste**

Select boxes and press Ctrl+C. Move the pointer to an empty place and press Ctrl+V. The copies
appear under the pointer with their buttons, texts and the arrows between them. This also works
between two designs. Ctrl+D makes a copy right beside the selected boxes.

**Keys**

Choose "Keyboard shortcuts" in the "..." menu to see them all. The main ones:

| Keys | What they do |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z or Ctrl+Y | Redo |
| Ctrl+C and Ctrl+V | Copy and paste steps, also into another design |
| Ctrl+D | Duplicate the selected steps |
| Delete | Delete the selected steps or arrows |
| Ctrl+F | Search steps, buttons and texts |
| F | Fit the map in view |
| Esc | Close a popover or the search, or leave Try it |
| Ctrl+Enter | Try it from the selected step |
| Arrow keys | Nudge the selected boxes (with Shift, further) |

On a Mac, use Cmd instead of Ctrl.

**Dots on a box**

A red dot on a box means an error. An amber dot means a warning. Hover over it to read why.

### The phone (right)

Select a step and the phone shows it exactly as the Telegram app shows it. For a message or a
question, you edit right on the phone. For a logic step, the right side shows a form instead.

Under the phone there are "Options" and "Telegram details". "Telegram details" is only for the
curious: it lists the Telegram method and fields the step becomes. You do not need it.

### Message steps

**The kind.** Above the phone, the "Kind" drop-down says what the bot sends: Text, Photo, Live
photo, Video, GIF, Audio, Voice, Round video, File, Sticker, Album, Location, Venue, Contact,
Poll, Quiz, Dice, Paid media or Rich message. (A question's prompt offers the first ones only,
because a question waits for a typed or shared answer.) When you change the kind, the text stays as the caption if the new kind has one. If the new kind
cannot have text, xDesign asks "The text will be removed. Change anyway?" and Ctrl+Z brings the
text back.

**Media.** Click the media area on the phone. You can:

- "Upload a file": drop it or choose it. xDesign checks the type and the size. If the file is too
  big or not allowed, you see why.
- "Use a placeholder": describe the file in words, for example "photo of the product". It shows
  as a grey box with your words. Use this while you do not have the real file.
- "Use a file already in this design": pick a file you uploaded before.

For an album, click the album, add items with "+", drag the thumbnails into another order, and
mark an item "Hide under a spoiler". An album needs at least 2 items. For a location, type the
latitude and longitude, or use "Paste a map link" with a link from Google Maps, Apple Maps or
OpenStreetMap and xDesign takes the coordinates. A venue adds a name and an address. A contact
adds a first name, a last name and a phone number.

**Options.** Under the phone, "Options" has:

- "Silent (no sound)".
- "Protect (no forwarding or saving)".
- "Link preview" for text messages: "Automatic", "Off" or "Use this link", then "Small" or "Large"
  and "Show above the text".
- "Caption above the media" and "Hide under a spoiler" for photos, videos and GIFs.
- "Message effect": one of Telegram's effects, or "None".
- "Before sending": "Show" a chat action (for example typing) for some seconds, and "Wait" some
  seconds. Each takes 1 to 60 seconds.
- "Write it out like a draft": for text and rich messages. See "Writing a message out like a
  draft" below.
- "Then": go on to another step without the user pressing anything. For a poll or a quiz, "Then"
  runs once the user has voted.

### Polls, quizzes, dice and paid media

Choose the kind in the "Kind" drop-down of a message step.

**Poll and quiz.** The bot sends a question with options, and the user votes. A quiz has right
answers; a poll does not.

1. Choose "Poll" or "Quiz". The bubble shows the question, "Anonymous Poll" (or "Anonymous Quiz")
   and two empty options. If the message already had a text, it becomes the question.
2. Click the question in the bubble and write it. A question has no formatting toolbar, because
   Telegram keeps only custom emoji in it. The counter ends with "/ 300".
3. Click each option in the bubble and write it, in the language you see. A language without its
   own option text shows the default language's text, greyed.
4. Under the phone, open the section "Poll" (or "Quiz"). Under "Options" the options are listed in
   order. Use the arrows to move one up or down, and remove one. Click "Add an option" for more.
   There can be 1 to 12 options.
5. In a quiz, tick "Right" on each right option. Its mark turns green with a check.
6. Choose the settings:
   - "Anonymous voting": on at first. The bot does not learn who voted.
   - "Multiple answers": the user can pick more than one option.
   - "Users can change their vote".
   - "Shuffle the options".
   - "Users can add options" (a poll only).
   - "Hide the results until the poll closes".
   - "Close after (seconds)". Leave it empty and the poll stays open.
   - In a quiz, "Explanation": click "Add an explanation" and write the text in the small bubble.
     The user sees it after answering. "Remove the explanation" takes it away.
7. Optional: choose "Save the vote as" to keep the vote in a variable (see below).

You can switch between a poll and a quiz. The options and the settings stay.

**Save the vote as.** Pick "None", a variable, or "+ New variable". A poll saves the text of the
option the user chose, in the default language (several options are joined with ", "). A quiz saves
yes when the answer is right and no when it is wrong. An "If" step can read the variable. A vote
can be saved only when "Anonymous voting" is off. If it is on, the checks show an error: an anonymous poll "does not tell the bot who voted", so
turn off anonymous voting or stop saving the vote.

**Dice.** Choose "Dice", then pick the "Emoji" (dice, dart, basketball, football, bowling or slot
machine). The phone shows the emoji big, without a bubble. "Save the roll as" keeps the number the
user rolled in a variable. Telegram throws the dice, not the bot, so you cannot choose the number.

**Paid media.** Photos and videos the user must pay Stars to see.

1. Choose "Paid media".
2. Click the media on the phone to add 1 to 10 photos or videos, as in an album.
3. Type the "Price in Stars" (1 to 25000).
4. Optional: click "Add a caption", and turn on "Caption above the media".

The phone shows the pictures blurred under the button "Unlock for" and the price. In Try it a press
on the button opens a payment card (see section 7).

### Rich messages

A rich message is one message built from blocks: headings, paragraphs, lists, tables and more, as
in an article.

1. Choose "Rich message". The text you had becomes the first paragraph.
2. Under the phone, in "Rich message", the blocks are listed in order ("1. Heading"). Use the
   arrows to move a block, or remove it. At least one block stays.
3. Click "Add a block" and choose: "Paragraph", "Heading", "List", "Table", "Details", "Quote",
   "Code block", "Media", "Buttons", "Divider" or "Footer".
4. Write each text in its bubble. The toolbar works as in a normal text.

What each block has:

- **Heading.** A "Size" from 1 to 6 ("1 is the largest.").
- **List.** Its items ("Add an item", and remove) and "Numbered".
- **Table.** The cells in a grid. "Add a row", "Add a column", "Remove the last row" and "Remove the
  last column". "First row is a header" and "Borders".
- **Details.** A "Title" that is always shown ("Always shown; a tap opens the text under it.") and
  a text that opens when the user taps it. "Shown open" opens it from the start.
- **Quote.** The text, and "Expandable".
- **Media.** "Upload a file", "Use a placeholder" or "Use a file already in this design", as for
  other media, and "Hide under a spoiler". A rich message takes photos, videos, GIFs, audio, voice
  messages and files.
- **Buttons.** A row of inline buttons inside the message. Its first button opens with its
  settings, as for any inline button. Use "+" to add more, up to 8 in a row. Deleting the last
  button removes the row. The buttons show on the map as pills with their arrows.

"Right to left" at the end of the section turns the whole message right to left.

### Writing a message out like a draft

Telegram can show a message as if the bot is writing it, letter by letter, before it arrives
whole. It works for text and rich messages.

1. Select the message, and open "Options" under the phone.
2. Turn on "Write it out like a draft".
3. Optional: turn on "Let the user stop it". The user gets a stop button while it is written.
4. If you did, you can turn on "Keep what was written", so that the half-written text stays in the
   chat when the user stops it. Then pick a step in "If the user stops it" ("Go on to another step
   when the user stops it."). The message's box on the map gets the dot "If the user stops it".

Turning off the draft, or changing to a kind that cannot be a draft, clears these settings.

In Try it the message appears over a moment, a text letter by letter and a rich message block by
block, and then whole. With a stop button, a card "Stop" shows over the chat. Pressing it leaves
what was written (with "Keep what was written") or removes it, and goes to "If the user stops it".
"Skip waits" shows the message at once.

### Texts and formatting

Click the text in the bubble and type. Select some words and a small toolbar appears. It has
Bold, Italic, Underline, Strikethrough, Spoiler, Code, Link, Quote, Expandable quote (inside a
quote), Code block, Date and time, "{ } Insert", Custom emoji and Part.

- "{ } Insert" puts a variable into the text as a chip like `{first_name}`. It lists the
  built-in values, the answers the bot saved, the values it remembers, and "+ New variable".
- "Custom emoji" asks for the custom emoji's ID and a normal emoji to show in its place.
- "Part" puts in a text part (see "Parts" below).
- A counter under the phone shows how many characters you used and the limit, for example
  "812 / 4096". It is red when you go over. A caption has a smaller limit.
- Right-to-left languages such as Persian show correctly. Each paragraph follows its own
  direction, as in Telegram.
- You can paste text with Telegram's HTML tags. xDesign turns them into formatting.

If a language has no text yet, the bubble shows the default text greyed with "Not translated:
click to write the" followed by the language's name and "text". Click and type.

### Buttons and keyboards

Under a message bubble you see "+ Inline buttons" and "+ Bottom keyboard". A message has one of
the two, as in Telegram.

**Inline buttons** sit under the message. Click "+ Inline buttons" and a button appears with its
settings open next to it.

- A "+" at the end of a row adds a button to the row. "+ row" adds a new row.
- Drag buttons to reorder them, inside a row or between rows.
- "Text": what is written on the button. It has a field for every language.
- "Look": "Default", "Blue", "Green" or "Red".
- "Icon": "None" or "Custom emoji".
- "When pressed" says what the button does:
  - "Go to a step": pick the step in "Goes to", or click "Draw on the map" and click a box. You
    can also pick "Back" or "Stay here".
  - "Open a link": type the address.
  - "Copy text": the text the user copies.
  - "Log in on a website".
  - "Pay": only on an invoice's buttons (see "Invoices and payments" below).
- For "Go to a step" there are more choices:
  - "Show it by": "Editing this message", "Sending a new message", or "Deleting this one and
    sending a new one".
  - "Popup": "None", "Small toast" or "Alert window", with the popup's text. A toast is the
    small message that shows briefly. An alert is a window the user must close.
  - "Also remember": save a value when the button is pressed.
- "Delete button" removes it. When you delete the last button, the keyboard goes away.

You can also click a button's pill on the map to open the same settings on the phone.

**The bottom keyboard** replaces the keyboard of the phone. Click "+ Bottom keyboard". Its buttons
have the same "Text", "Look" and "Icon". Under "When pressed" they can:

- "Sends its text": the button sends its own text as the user's message.
- "Share phone number" and "Share location".
- "Pick users", "Pick a group or channel" and "Create a poll".

Many of these can "Save it as" a variable. Choose a variable, or "+ New variable".

Click "More" for the keyboard's options: "Hide after one press", "Always shown", "Fit to buttons"
and "Hint in the input field". Without buttons, "More" offers "Remove the bottom keyboard" and
"Force a reply".

### Questions

A question asks the user for something and waits for the answer. Its prompt is a message you edit
on the phone. Under the phone, the form has:

- "Title": the box's name.
- "Expects": the kind of answer: text, number, email, phone number, location, photo, video, file,
  voice, audio or anything.
- Checks for that kind, for example "At least" and "At most" characters for text, "Between" two
  numbers, "Whole number", "Max file size" and "File types".
- "Save the answer as": a variable that holds the answer.
- "Wrong answer": the message the bot sends, "Try at most" some times, and "Then go to" a step.
- "Cancel word": a word (for each language, with commas between several) that lets the user
  cancel, and where that goes.

The question's box on the map has dots: "Valid answer", "Wrong 3 times" (the number follows your
setting) and "Cancel".

### Logic steps

Logic steps have no message. They decide what happens next. Each starts with a "Title".

- **If.** It has cases. Each case has a "Case name" and one or more conditions written as
  sentences, for example "saved answer age is at least 18". Choose "all of these" or "any of
  these". Click "+ Case" to add a case and "+ Condition" to add a condition. "Otherwise" says
  where to go when no case holds. A condition can test a saved answer or other variable, a test
  switch (such as User is admin, is yes), the user's language, whether the user is a member of a
  channel, whether the user "has paid" an invoice, or whether the user "is subscribed to" an invoice
  that has a subscription. Pick "+ Switch" to make a new test switch on the spot. A saved vote or
  roll is a saved answer, so an If can read it too.
- **Remember.** It saves values. Each line is one action: "Set" a variable to a value, "Add" a
  number to a variable, "Subtract" one, "Clear" a variable, or "Append" to one. A value can be a number, yes or no,
  a text, or `{name}` for another variable.
- **Wait.** "Wait" a number of seconds, minutes, hours or days. Then choose what happens if the
  user does something before the time is up: "Stop waiting" or "Still go on". With "Stop waiting"
  you can make a reminder: see "Reminders" below.
- **Developer step.** A job only the developer can do, for example looking up an order. Write
  "What the developer does". List the variables it uses under "Uses" and gives back under "Gives
  back". "Outcomes" are the named ways it can end, each with "Goes to". At least one is needed.
  "Done" is the first.
- **Go to.** Jumps to another step.
- **End.** The conversation ends here. The user's next message goes to "Anything else".
- **Note.** A note on the map with a color. It is for people, not for the bot.
- **Section.** A frame with a title and a color.

### Start points

A start point says how a conversation begins. Add them from the palette. Each shows its own form.

- **/start.** Every new design has it. Every chat starts here.
- **Command.** Click "+ Command" and type the command, for example `help`. It is made lower case.
  Only lower case letters, digits and an underscore are allowed. Turn on "Show in the commands
  menu" and write the "Menu text" for each language.
- **Start link.** A link such as `t.me/yourbot?start=promo`. Type the "Link text after ?start=".
  Choose "Exactly" or "Starts with". With "Starts with" you can use "Save the rest as" a
  variable. The full link is shown with a "Copy" button. It uses the bot's username from Bot
  setup. Until you set it, it shows `yourbot`.
- **Anything else (fallback).** Catches what nothing else catches. Choose "Text only", "Media
  only" or "Anything".
- **Payment done.** Starts when a payment arrives that no invoice's "Paid" arrow takes. Pick one
  invoice, or "Any invoice" in "Invoice". For example, a subscription paid again, or the first
  payment of an invoice that has no "Paid" arrow.
- **Refund.** Starts when a payment is refunded. Pick the invoice in "Invoice", or "Any invoice".
- **Subscription changed.** Starts when a Stars subscription changes. In "Invoice" pick "Any
  invoice" or an invoice that has a subscription. In "Change" pick "Any change", "Canceled",
  "Turned back on" or "Could not be paid".
- **User blocks the bot.** Starts when the user blocks the bot. The bot cannot send anything to
  that user after it, so use this start point for your own bookkeeping, for example with a
  "Remember" step or a "Developer step". The checks show an error if a message, a question, an
  invoice or a chat action can be reached from it.
- **User restarts the bot.** Starts when a user who blocked the bot unblocks it and starts it
  again. Use it to welcome the user back.
- **Broadcast.** The bot writes first to many users, for example "Service news". "Who gets it" is
  "Everyone" or "Some users" with conditions, as in an If. Only users who started the bot and did
  not block it get it. In "When" write in words when it goes out, for example "Every Monday at
  9:00". xDesign does not send anything. The developer schedules it from your words.

The payment, refund and subscription start points, "User blocks the bot", "User restarts the bot"
and "Broadcast" do not need a message from the user. In Try it they are in "Start from" and in
"Events" (section 7).

### Invoices and payments

An invoice step asks the user to pay. xDesign does not take any money. It only designs the steps.
The developer builds the real payment from the export.

**Making an invoice**

1. Click "Invoice" in the palette. The new box shows "No title yet" and "⭐️1", a "Pay" button and
   the dot "Paid".
2. On the phone you see the invoice as the user sees it: the title in bold, the description, the
   photo with the price over it, then the buttons. Type the title and the description under the
   phone, in "Invoice" ("Invoice title" and "Description" in the language shown). Under "Photo" you
   can add a picture, or "Remove" it.
3. In "Price", choose how the user pays:
   - "Telegram Stars". For digital goods and services. An invoice in Stars has one price line.
   - "Card". Type the "Currency code", for example USD. Add price lines with "+ Price line". Each
     has a label and an amount. A negative amount is a discount. The total is shown.
4. Optional: turn on "Subscription (every 30 days)". It works in Stars only. Telegram takes
   subscriptions only through an invoice link, so the bot sends a message with the link in a URL
   button in place of the pay button. Switching to a card turns the subscription off.
5. Optional: for goods you ship, open "Physical goods" and turn on "Physical goods, or a service
   outside the app stores". Then you can turn on "Ask for the name", "Ask for the phone number",
   "Ask for the email" and "Ask for the shipping address". "Flexible shipping (the price depends
   on the address)" shows a list of shipping options: click "+ Shipping option" and give each a
   title and a price.
6. Optional: in "Pre-checkout check", turn on "Check before Telegram takes the money". Write "What
   the developer checks" (for example "That the beans are in stock"). The check has two outcomes:
   OK (the payment goes through, then "Paid") and Refuse (nothing is paid, and the user sees the
   "Refuse message").
7. In "Paid", pick "Goes to": where the user goes once the payment went through. "Payload" is what
   the bot gets back with the payment. Leave it empty to use the step's ID name. "Silent (no
   sound)" and "Protect (no forwarding or saving)" work as for a message.

The checks tell you when something does not fit Telegram, for example digital goods paid by card.

**The pay button.** An invoice needs Telegram's pay button. The first button must be a "Pay"
button, and there can be only one. When the invoice has no buttons, the phone shows Telegram's
own button ("Pay ⭐️50" or "Pay 4.50 USD"). Click "+ Inline buttons" to add your own buttons. The
keyboard then starts with a pay button called "Pay", and you can add other buttons after it. In a
button's "When pressed", "Pay" is offered on an invoice only. An invoice has inline buttons only,
no bottom keyboard.

**After the payment**

- The "Paid" arrow takes the user to the next step. Use it for the thanks message or the download.
- A "Payment done" start point takes the payments the "Paid" arrow does not.
- An "If" step can ask whether the user "has paid" an invoice (and did not get a refund), or "is
  subscribed to" one. Use it for "My purchases" or to open a part of the bot only for paying users.
- An "Action" step with "Refund a payment" gives the user's Stars back (see "Actions" below), and
  the "Refund" start point starts when it happens. Refunds work for payments in Stars only.

### Actions

An action step does something in the chat, then goes on. Click "Action" in the palette. The form
has a "Title", "Does", the fields of what it does, and "Then". In "Does" choose:

- **"Set a reaction".** The bot reacts to a message with an emoji. Pick the "Emoji" from Telegram's
  list. In "On" pick "The user's last message", or a message, question or invoice step (the
  message it sent the user last). "Big animation" asks for the large version.
- **"Pin a message".** In "Message" pick the step whose message gets pinned. The phone shows a
  bar "Pinned Message" under the top bar. In a private chat Telegram sends no notice about a pin.
- **"Unpin a message".** In "Message" pick a step, or "The newest pinned message".
- **"Delete a message".** In "Message" pick a step. Telegram lets a bot delete a message only up to
  48 hours after it was sent.
- **"Send a gift".** The gift card shows in the form as the chat shows it: write its text right
  there (the counter reads "0 / 128"). Describe the gift in "Which gift" in words: the developer
  picks it from Telegram's gifts, and it is paid from the bot's Stars. "Also pay for the upgrade"
  adds the upgrade.
- **"Show a chat action".** In "Show" pick for example typing. The phone's top bar shows "typing..."
  for 5 seconds or until the next message.
- **"Refund a payment".** Pick the invoice. "Gives back the user's Stars payment of this invoice."

When you change what an action does, the message you chose stays between a reaction, a pin, an
unpin and a delete. The box on the map says what the action does, for example "Pin New roast" or
"Send a gift: A teddy bear". It is muted while the message, gift or invoice is not chosen yet.

### Reminders

A reminder is a "Wait" that stops only when something is true. Use it for "remind the user in one
hour, unless they paid".

1. Add a "Wait" and set the time.
2. Under "If the user does something before the time is up", choose "Stop waiting".
3. Turn on "Only once these hold". Add the conditions as in an "If": "all of these" or "any of
   these", "+ Condition". They read "Stops waiting once" and then the condition, for example
   that the user has paid Hazel beans.
4. In "Then" pick where the user goes when the wait is over.

Without "Only once these hold", "Anything the user does stops the wait." With "Still go on" the
conditions are cleared. The box on the map says "Stops once" and the conditions. A wait longer than
an hour gets a warning in the checks, because the bot must keep it somewhere.

### Bot setup

Click the "Bot setup" tab. This holds the bot's own details. They follow the language you
chose in the top bar.

- "Bot username": optional, used for start links in the documents.
- "Name", "About" (the short description) and "Description" (shown in an empty chat). Each has a
  counter with Telegram's limit.
- "Profile photo": click it, then "Add a photo" and choose a JPEG or an MP4. Click "Remove" to
  take it away.
- "Commands menu": the command start points, in order. Drag one by its handle to reorder. Each
  has a menu text per language and "Show in menu".
- "Menu button": "Commands list" or "Telegram default".

On the right, the preview shows "Empty chat" (what the user sees before they start the bot) and
"Commands menu" (how Telegram shows your commands). Switch between them, or click a field and the
preview follows.

### Languages and the Texts tab

**Languages.** Every language shows its country flag before its name: in the language lists, the
top bar, the Texts tab, Try it, Checks, Export and the design cards. A language that belongs to no
one country, such as Esperanto or Latin, shows a small globe. Click the language in the top bar,
then "Languages...". The dialog lists the design's languages. You can:

- Click "Add a language" and search for one. Right-to-left languages are marked.
- Make a language the "Default". The default is where the texts are written first.
- "Remove" a language. xDesign asks "Remove Persian?" (with the language's name) and warns "Its
  texts in this design are deleted." Ctrl+Z brings it back.

**The Texts tab.** Click "Texts". It is a table of every text in the design. The rows are grouped
by step. The columns are the languages. Click a cell and type. For a message, click the cell and
a small editor opens in a bubble with the toolbar. Click "Done" when you finish. Every text of
every step is here, including button texts, popup texts and the Bot setup texts.

- A counter shows how many texts are missing per language, for example "fa: 1 missing".
- "Only missing" shows just the cells that still need a text.
- "Copy the default language into empty cells" fills the empty cells with the default text, as a
  quick start. They are in italics until you change their words, and they still count as missing.
- "Show more" shows more rows when the table is long.
- Click a text to go to its step on the Map tab.

### Variables and test switches

Click "Variables" in the palette to open the panel. It has two tabs.

- **Variables.** They are listed in groups: "Built-ins" (read-only, for example the user's first
  name and username), "Saved answers", "Remembered values" and "Developer outputs". Each has an
  "ID name" (the name the developer sees), a "Label", a "Type" and a "Test value". "Set in" and
  "Used in" list the steps where it is saved and read. Click a step to jump to it. "+ Variable"
  offers "Remembered value" or "Developer output". Deleting a variable that a step uses asks
  first.
- **Test switches.** Click "Test switches" in the palette. A test switch has a "Label", a "Type"
  ("Yes or no" or "A choice") and a "Test value". "How the developer knows it" is a note for the
  developer, for example where the list of admins is kept. Click "+ Switch" to add one.

### Parts

A part is something you build once and use in many places. Edit it once and every place changes.

- Click "+ Part" under "Parts" in the palette. Choose "Inline buttons", "Bottom keyboard", "Text",
  or "From the selected box's buttons".
- Or, in a box's menu, click "Make a part from its buttons". The box's buttons move into a new part,
  and the box now uses it.
- A sheet opens on the right: "Name", the small phone with the part, and "Uses" (where it is
  used; click a use to jump to it).
- To use a button part, drag it from the palette onto a message's buttons, or under a message with
  no buttons. A text part is dragged into a text, or added with "Part" in the text toolbar.
- A used part shows in a dashed outline with its name. Its menu on the phone has "Edit the part"
  and "Detach". "Detach" gives that step its own copy.
- "Delete part" asks "Delete <name>?" and tells you that each use gets its own copy. The uses
  keep their buttons or text.

### Working together

- You see other people's avatars in the top bar. On the map you see their pointer with their name
  in their color. A box another person has selected has a frame in their color with their name.
  In a text you see their text cursor with their name.
- Changes appear for everyone at once. If two people change different things, both stay. If two
  people type in the same text, both texts are kept, letter by letter. If two people move the same
  box, the last move wins.
- Undo only undoes your own changes.
- Offline: the browser keeps the design on your computer. The top bar says "Offline, your changes
  are kept on this computer". When the connection is back, your changes are sent and merged. More
  in section 12.
- Commenters and Viewers see the same editor, but nothing can be changed. The top bar says "Read
  only". A Commenter can still write comments.
- On a screen narrower than 900 pixels the editor shows the map or the phone with a switch at the
  bottom, "Map" and "Phone", and the note "Editing works on a computer screen". You can look and
  use Try it, but not edit.

### Comments

Comments are notes you leave on the design for the people you work with. A comment sits on a step,
on a button, on a text or on a spot of the map. Editors and Commenters can write them. Viewers can
read them.

**Writing a comment**

1. Click "Comment" in the top bar, or press C. You are in comment mode. The phone turns read-only
   while it is on.
2. Click what you want to talk about:
   - a box on the map, for a comment on the step;
   - a button's pill on the map, or a button on the phone, for a comment on that button;
   - the bubble on the phone, for a comment on the step's text in the language shown;
   - an empty spot of the map, for a comment on that spot.
3. The Comments panel opens on the right with a box to write in. It says where the comment is.
   Type your note. Type "@" and pick a person to mention them. Use the arrow keys and Enter, or
   click. Esc closes the list.
4. Click "Comment" (or press Ctrl+Enter). Click "Cancel" to drop it.
5. Click "Comment" again or press C or Esc to leave comment mode.

The box menu also has "Comment".

**Pins.** Every open comment shows a numbered dot, a pin: on the left edge of the box, on the
phone (at the bubble's top right corner or on the button), and on the map at the spot. The oldest
open comment is 1. Click a pin to open its thread.

**The Comments panel.** Open it with a click on a pin, or from the "..." menu, "Comments". Its
tabs are "Open" and "Resolved". Each thread shows its pin number, its place, and the comments with
the author, the time and "(edited)" when changed. A mention shows as "@name". For each thread:

- "Reply" adds a comment to the thread.
- "Resolve" closes the thread. The pin goes and the thread moves to "Resolved", where it says
  "Resolved by" and the name. "Reopen" brings it back.
- The menu of a comment has "Edit" (only its author) and "Delete" (its author, the design's owner
  and the site owner). Deleting the first comment asks "Delete this thread?" and tells you that its
  replies are deleted too. Deleting a reply asks "Delete this comment?".
- Click the place to jump to the step or the button on the map.

When a step or a button was deleted, the thread stays and says "On a deleted step:" with its title
(or "on a deleted button:" with its label). A thread on the map says "On the map".

**The bell.** The bell in the top bar shows how many comments you have not read, in every design
you can open. The number is red with an "@" when some of them mention you. Click it to see the
latest in "Unread comments", each with who wrote it, in which design, and "Mentions you". Click one
to open that design with the panel on the thread. xDesign sends no emails, so look at the bell.
The bell checks every minute, and at once for the design you have open.

Opening the Comments panel marks that design's comments as read. Just opening the editor does not.
On the Designs page, a card shows how many comments are unread in it.

**Comments in the export.** The export dialog has "Include open comments", on at first.
`design.md` then lists each open thread under its step as "Open questions", so the developer sees
what is still undecided. Threads on a deleted step, a start point, a note, a section or the map
are listed at the end. `spec.json` has no comments. A view-only page has no comments at all.

### History

xDesign keeps earlier versions of every design, so you can look at an old state, compare it with
now, and go back to it.

**Where versions come from**

- **Automatic versions.** One is made about every 10 minutes while people edit, and one when the
  last editor leaves the design. Old automatic versions are thinned: after a day only one per hour
  is kept, after a week one per day, and after 90 days they are removed.
- **Named versions.** You make one yourself, for example when you send the design to the developer.
  These are never removed by themselves. See below.
- **"Before restore" and "Restored".** Made when someone goes back to a version (see below).

**Looking at a version**

1. Click the "..." menu, then "History". The panel lists the versions, newest first. A named
   version's name is in bold. The others say "Automatic", "Before restore" or "Restored" (with the
   name when the restored version had one). Under each you see who made it and how long ago.
   Hover to see the date and time. With no versions, the panel says "No versions yet".
   When Claude made a version, the row says who and how, for example "Sara via Claude Code key
   "Laptop"" or "Sara via Claude (connected app)" (see section 8).
2. Click a version. After "Opening..." the map, the phone, the "Texts" and "Bot setup" tabs and
   Try it show that version. Nothing can be changed. A banner says "You are looking at <name or
   time>."
3. The banner has three buttons: "Restore this version" (Editors), "Compare with now" and "Back to
   now".

**Comparing with now.** Click "Compare with now". The list shows the version on the left and now
on the right. It has three groups with counts: "Added", "Removed" and "Changed" steps, in the order
of the map. A changed step shows every text that differs, the old words beside the new words, with
the language when the design has several. "Other changes" marks a step whose settings, arrows,
files or button targets changed. Moving or resizing a box is not a change. At the end, "Also
changed" names Bot setup, Languages, Variables, Test switches or Parts when they differ. When
nothing differs, you see "No changes".

**Naming a version.** Click the "..." menu, then "Name this version" (Editors). Type a "Name" (for
example "Sent to developer"), and click "Save". You see "Named this version" followed by the name.
The name must be different from the other named versions. Everyone can see the name in History.
A named version's menu has "Rename" (Editors) and "Delete" (only the design's owner). Delete asks
first and tells you that the design does not change.

**Going back to a version**

1. Open the version in History.
2. Click "Restore this version". xDesign asks "Restore this version?" and tells you that the design
   goes back for everyone and that now is kept as "Before restore", so you can go back to it.
3. Click "Restore".

The design is back as it was. Everyone who has it open sees "This design was restored to an earlier
version." Their undo lists start again. The design keeps its current name. Nothing is lost: "Before
restore" holds what you had, and "Restored" holds the result.

**Exporting a version.** A version's own menu in History has "Export". The export dialog also has a
"Version" choice: "Now", or any version by its name or its date and time. A named version is
exported with its name in `spec.json` and in `design.md`. If you choose "Now" and also type a name
in "Name this version" in the dialog, xDesign makes a named version of the design as it is, when
you click "Export", and exports that.

---

## 6. Checks

Telegram has limits, and a design can have loose ends. xDesign checks your design all the time and
tells you. Click "Checks" in the top bar to open the list. The number on the button is the count
of errors and warnings.

The list has three groups, each shown only when it has lines:

- **Errors.** Telegram cannot do this. Fix these. The developer cannot build them.
- **Warnings.** Probably a mistake or a missing piece, for example a message with no text, or a
  text that is not translated yet.
- **Good to know.** Things you may want to look at but that are fine to leave.

Each line shows the step, the button, the language and what is wrong. Click a line. The list
closes, the map shows the step, and the phone shows it selected. If the line is about a button,
the button is outlined. If the line is about the bot's name or description, "Bot setup" opens.

**Ignore here.** On a warning or a "Good to know" line, click "Ignore here" if you have decided it
is fine. The line moves to "Ignored" and no longer counts. Click "Stop ignoring" to bring it back.
Errors cannot be ignored. The export lists ignored checks as ignored.

If the design has two or more languages, a filter lets you show "All languages" or one language.
When nothing is wrong the list says "No problems found".

The red and amber dots on the map's boxes show the same errors and warnings.

---

## 7. Try it

Try it lets you click through the bot like a real user, without Telegram. It uses the phone in the
look you chose. Everyone who can open the design can use it, including Viewers.

### Starting

1. Click "Try it" in the top bar. The phone turns into the bot's chat. The button now says "Stop
   trying". You can also select a step and press Ctrl+Enter to start from that step.
2. The chat is empty. Click the Start button, or click "Start from" and pick where to begin:
   "/start", a command, a start link, or "A message the bot does not expect". The design's payment
   start points are in this list too.

While you open a version from History (section 5), Try it runs that version.

While you try, the palette is dimmed and the map stays as it is. It shows the path you took: the
steps you went through get a ring and the arrows you took are drawn thicker.

### The test user

Beside the phone (or in a sheet that opens with "Test user" on a small screen) is the "Test user"
panel. You play the user.

- "Language" is the language of the user. Pick one of the design's languages.
- Each test switch is listed. Flip it, or pick a choice, to decide what an "If" step does.
- "First name" and "Username" are the user's built-in values.
- "Dice value" is there when the design has a dice. Type the number the dice should show. Leave it
  on "Random" and every try rolls a new number.
- "Variables" lists every variable with the value it has in this try.
- "Reset" puts the test user back to how it was.

A switch and the language apply from the next step. If an "If" step cannot be decided, the chat
shows a card asking "Which way?" with one button for each case.

### Clicking and typing

- Press the inline buttons under the messages. The message edits, or a new one comes, as you
  designed. A toast shows for a moment. An alert shows a window with "OK".
- When the bot shows a bottom keyboard, press its buttons. Buttons that share a phone number or a
  location offer a test number or a test location.
- Press an option of a poll to vote. With "Multiple answers", pick the options and then press
  "Vote". Then each option shows its share (100% for your vote, 0% for the others) and a bar.
  In a quiz the right options turn green and a wrong one you chose turns red with a cross. A wrong
  answer shows the explanation as a toast. Try it has one user, so the results show only your
  vote. A vote saved with "Save the vote as" shows in the "Variables" list and in the grey line
  under the phone.
- Paid media is blurred. Press its price button ("Unlock for" and the price). A card opens with
  "Pay (test)" and "Cancel". "Pay (test)" shows the pictures clear. "Cancel" closes the card.
- A dice rolls when it is shown, and the grey line says what it rolled.
- Type in the input field and press Enter to answer a question. The checks you set and the wrong
  answer message work too.
- Click the clip to send a test file: "Send a test photo", "Send a test video", "Send a test
  file", "Send a test voice message" or "Send a test audio file".
- Click the menu button to open the commands menu. A command sends "/command".
- A message with a delay waits its seconds and shows its chat action first. Turn on "Skip waits"
  to skip all waits. A Wait step shows a card "Waiting 2 hours" (with your time) and "Skip the
  wait".
- A Developer step shows a card "The developer does:" with your description and asks "What
  happened?" with its outcomes. Pick one.
- An invoice shows as the user sees it. Press its pay button to open the payment sheet over the
  chat, drawn in the look you chose. It shows "Checkout" ("Confirm Your Purchase" for Stars), the
  photo, the title and the description, the price lines, "Total" (with "every 30 days" for a
  subscription) and what the sheet asks for. With flexible shipping, choose a "Shipping Method".
  Press "Pay (test)" to pay, or "Cancel". If the invoice has a pre-checkout check, a card first
  asks "The developer checks:" and "What happened?" with "OK" and "Refuse". "Refuse" shows your
  refusal message as an alert and nothing is paid. "OK" pays: the path goes on through "Paid", or
  through a "Payment done" start point when there is no "Paid" arrow. A test user starts with
  nothing paid, so "has paid" is no until you pay.
- A message written out like a draft appears over a moment. With a stop button, a "Stop" card shows
  over the chat. "Skip waits" shows it at once.
- A rich message is one message. The buttons inside it work as the buttons of a keyboard.
- "Events" (next to "Start from") fires what the user or the time does while the chat runs. It lists
  "User blocks the bot" (the chat then shows a Restart button where the input field was, and
  nothing more reaches the user; pressing Restart is "User restarts the bot"), "User restarts the
  bot" and "Time passes" (a wait or a delay goes by). Below them are the design's broadcasts and
  subscription changes, by their titles. Each runs on the chat as it is. A broadcast skips a test
  user its audience does not take. "Step back" undoes each of them.
- An action shows its effect: a reaction under the message, a pinned bar under the top bar, a
  gift card in the middle of the chat ("Gift from" and the bot's name, the text and "View"), or a
  message that is gone. A chat action shows in the top bar for a few seconds. A refund marks the
  payment as refunded.
- A reminder comes back after a test action. It stops by itself when its conditions hold, and the
  grey line says so. "Skip the wait" stops it the same way when they hold.
- Under the phone, a small grey line says what the last action did.

### Going back and restarting

- "Step back" undoes your last action.
- "Restart" empties the chat and lets you pick where to start again.
- "Stop trying" or the Esc key leaves Try it. The test user is kept for the next try.

---

## 8. Export, print, import and the Claude link

### Export

1. Click "Export" in the editor's top bar, or "Export" in a design's menu on the Designs page.
2. Choose the "Version". It is "Now" at first. You can choose an earlier version from History
   instead. If you are an Editor and keep "Now", you can type a name under "Name this version"
   ("Optional: makes a named version of the design as it is now."). The version is made when you
   click "Export". (A view-only page has no "Version".)
3. Choose "Languages". All are chosen at first. The default language is always included.
4. Choose "Pictures":
   - "One picture per step and language" (the default).
   - "Default language only".
   - "No pictures". This is the fastest.
5. For pictures, choose the "Phone look" (Web A, Web K, Desktop, Android or iOS) and "Light" or
   "Dark". They start with the look you are using now.
6. Turn "Include open comments" on or off. It is on at first.
7. Click "Export". xDesign shows its progress ("Fetching media files", then "Making pictures 12
   of 40", then "Making the zip"). Click "Cancel" to stop.

A file is downloaded. Its name is the design's name, the date and `.xdesign.zip`, for example
`coffee_shop_bot-2026-11-23.xdesign.zip`.

### What is in the zip

| File | What it is | Who it is for |
|---|---|---|
| `spec.json` | The exact design: every step, button, text, variable and setting. This is the source of truth. | The developer, or a tool. |
| `design.md` | The design as a readable document: a map, each step with its texts and buttons, the variables, the parts, the media, the checks, the open comments as "Open questions", and a glossary. | Everyone. Open it in any Markdown viewer. |
| `HOW-TO-READ.md` | A guide that explains how to read `spec.json` and how each part becomes a Telegram Bot API call. | The developer. |
| `bot-spec.schema.json` | The format of `spec.json`, for tools that check it. | The developer, or a tool. |
| `media/` | The files you uploaded. | The developer. |
| `pictures/` | A picture of every message as it looks in the phone you chose, one per language. | Everyone. |

Give the whole zip to the person who builds the bot. They need `spec.json` most. When you export
a named version, its name is written in `spec.json` and in the summary of `design.md`.

### Print

1. Click the "..." menu in the editor, then "Print".
2. A page opens with the whole design as a document, with pictures and a drawn map. The pictures
   are made while you wait.
3. Click an entry in the summary to jump to it.
4. Click "Print or save as PDF" to open your browser's print dialog. Each section starts on a new
   page.

### Import

Import makes a new design from an export. It never changes an existing design.

1. On the Designs page, click "Import".
2. Drop an `.xdesign.zip` or a `spec.json` in the box, or click "Choose a file".
3. xDesign reads the file and shows what it found, for example "Import Hazel Coffee: 34 steps, 2
   languages, 12 media files".
4. Click "Import as a new design". You become its owner and the new design opens.

A `spec.json` alone has no media files, so its pictures and files come in as placeholders. If the
file cannot be imported, you see "This file cannot be imported:" and the reasons.

### The Claude link

A Claude link lets a developer, or Claude, read your design without an account and without a zip.
It gives three files that always show the design as it is now:

- `spec.json`, the exact design.
- `design.md`, the readable document, with its open questions.
- `HOW-TO-READ.md`, the guide for reading `spec.json`.

**Making a link.** Only the design's owner and the site owner can.

1. Click "Share" in the editor.
2. Find "Claude link". It says that anyone with this link can read this design, and shows what to
   tell Claude: "Build the bot described at" and the link.
3. Click "Create link". The three addresses show once, each with "Copy", and "The link is shown only
   now."
4. Copy the address of `spec.json` and give it to Claude, or give all three to the developer.

Add `?version=` and a version's name to an address to read that named version, or `?languages=en,fa`
to read only some languages. (The default language is always kept.) Below, the links that work are
listed with "Made <time ago> by <name>" and "Last used <time ago>" or "Not used yet". Click
"Revoke" to stop one at once. After that its addresses say "This link was revoked or does not
exist." Anyone who has the link can read the design, so revoke a link you no longer need. A design
can have several links.

The link never changes the design. Changes you made in the last few seconds may take a moment to
show.

**Pictures for Claude.** Claude can also look at the pictures of your steps, if xDesign has them.
They are made by your browser, not by the server. xDesign keeps the pictures of the default
language from your last export, or from "Refresh pictures for Claude".

- When you "Export" the design as it is now with pictures, the pictures are sent in the background
  after the zip downloads. If that fails you see "The pictures for Claude were not uploaded." with
  the reason. An export of a version, an export with "No pictures" and an export on a view-only
  page send nothing.
- To refresh them alone, without a zip, click "Refresh pictures for Claude" in the editor's "..."
  menu, or in a design's menu on the Designs page. A message counts "Making pictures 12 of 40" and
  then "Uploading the pictures for Claude". Click "Cancel" to stop. It ends with "Refreshed the
  pictures of <name> for Claude." Everyone with access to the design can do this. It uses the
  phone look you chose in the editor.

Until pictures are made, `design.md` says "Pictures: export from xDesign to get them". If the
design changed since the pictures were made, it says so.

### Connecting Claude to your designs

Claude can work in xDesign as you. It does everything you can do, with your role, and nothing
more: a Viewer's Claude only reads, an Editor's Claude edits the designs shared with them, and the
site owner's Claude can do everything. There are two ways to connect it: an API key for Claude Code
(or another program that speaks MCP), and the Claude app or claude.ai.

**What Claude can do**

- Read your designs: list them, read a design as `spec.json` or `design.md`, read one step with the
  steps before and after it, read the checks and the open comments, look at a step's picture, and
  read the guide `HOW-TO-READ.md`.
- Do what you do in the panel: make, rename, duplicate, share and delete designs, write comments,
  name versions and go back to one, make view-only links and Claude links, use templates, import and
  export, and, for the site owner, the members, the settings, HTTPS, the domain and the site
  address, backups and updates.
- Edit a design. Claude makes the same changes you make in the editor: steps, texts and their
  translations, buttons and keyboards, parts, variables and test switches, languages, the bot's
  settings and the map. If you have the design open, you see the change appear at once, as when
  another person edits. Nobody can take it back with Ctrl+Z (each person undoes only their own
  changes); go back to an earlier version in History instead. If something goes wrong, ask Claude
  to put it right, or restore the version before.
- Use Try it: Claude runs the design as a test user from /start, presses buttons, sends texts and
  reads what the bot answers.
- Put pictures and files into a design (as long as they fit the site's upload limit) and import a
  design from a `spec.json`.

Claude cannot do the things that are about you yourself: sign in and out, your password, your
sessions, "Confirm it's you" and two-factor sign-in. It cannot make API keys or connect apps for
itself. It cannot download a backup or upload an update from your computer.

**Ask first.** Some actions cannot be undone. Claude asks you before it does these: "Delete
forever", removing a person from the site, deleting a backup, a version, a template or a comment,
revoking a view-only link or a Claude link, adding a person to the site, setting a person's
password, handing a design to another owner, restoring
a backup, installing an update or going back, and changing HTTPS, the domain or the site address.
Everything else (edits, moving a design to Trash, sharing, comments) runs at once.

- You see the question in the chat, in words like "Delete a design forever, "Coffee test"?", with
  Yes and No. It waits 10 minutes. After No, or after no answer, nothing is done.
- Some apps cannot show such a question. Then Claude shows it to you itself, with a ticket, and asks
  you to say Yes in the chat. After your Yes it runs the same call again with the ticket. A ticket
  works once, within 10 minutes, for that exact call only.
- Each key and each connected app has an "Ask first" switch, on at first. Only the site owner can
  turn it off, for anyone's key or app (on the Account page, or in Settings > Claude connections).
  When it is off, these actions run at once, and Claude says "Ran without asking: Ask first is off
  for this key." For everybody else the switch is greyed and says "Only the site owner can turn
  this off."
- Claude may make 120 calls a minute for each key or app. Past that you see "Too many calls. Wait a
  minute."

**Claude Code, with an API key**

1. Click your avatar, then "Account". The card "Claude" says "Claude can do everything you can do
   in xDesign, as you. Actions that cannot be undone ask you first." Below it is "API keys".
2. Type a "Name" for the key, for example "Claude Code on my laptop". Click "Create key".
3. The key is shown once, with "Copy" and "The key is shown only now." Copy it.
4. Under "In Claude Code run:" you see a command:
   `claude mcp add --transport http xdesign <site address>/mcp --header "Authorization: Bearer <key>"`
   where `<site address>` is your site's address with its port and path (without the last `/`) and
   `<key>` is the key you just made. Click "Copy" and run it in a terminal on your computer.
5. Start Claude Code. In it, type `/mcp`: xdesign is connected.
6. Ask Claude, for example, "List my xDesign designs", "Read the design Coffee shop and tell me
   what its first step shows", or "In Coffee shop add a message step Welcome after /start with the
   text Hello and the buttons Shop and Help."

For another program, add the server `<site address>/mcp` (Streamable HTTP) with the header
`Authorization: Bearer <key>`. The keys that work are listed with "Made <time ago>" and "Last used
<time ago>" or "Not used yet", each with its "Ask first" switch. Click "Revoke" to stop one:
Claude's next call fails.

**The Claude app and claude.ai**

This needs no key. The Claude app and claude.ai reach your site from the internet, so the site
needs its port open and a certificate that browsers trust. With the built-in certificate, the
Account page warns "The Claude app needs a certificate browsers trust: choose Let's Encrypt in
Settings > HTTPS." Choose Let's Encrypt first (see section 9).

1. On the Account page, under "Claude", find "Add xDesign to the Claude app". It shows an address
   that ends in `/mcp`. Click "Copy". It says "In the Claude app or claude.ai, add a custom
   connector with this address, then allow it on the page xDesign opens."
2. In the Claude app or on claude.ai, open the settings for connectors and add a custom connector
   with that address.
3. xDesign opens its page "Allow Claude to use xDesign as <your name>?" If your browser is not
   signed in, it asks you to sign in first, with your password and your code if you have two-factor
   sign-in on. The page says "It can do everything you can do in xDesign. Actions that cannot be
   undone ask you first." and shows where the app is from and where its answer goes. A warning
   shows when the answer goes to your own computer ("localhost"): allow it only if you started this
   on this computer. Allow it only if you are connecting this app yourself right now.
4. Click "Allow" (or "Deny"). The page says "Allowed" and takes you back to the app. If you wait
   more than 10 minutes the page says "It waited 10 minutes without an answer. Start again from the
   app."
5. Ask Claude, for example, "List my xDesign designs".

The app is now listed on the Account page under "Connected apps", with "Connected <date> · Last
used <time ago>" ("Not used yet" before its first call) and its "Ask first" switch. Click
"Disconnect" ("Disconnect <app>?") to end it: its next call is refused, and it works again only
after it is connected and allowed again. An app also ends by itself after 30 days without use.
The site owner sees every person's keys and apps in Settings > Claude connections (see section 9).

If you move the site to another address (a new port or path in "Site address"), the Claude Code
command, the connected apps and the links you sent keep the old address and stop working: connect
again with the new address.

**Who did it.** Every change Claude makes is yours, with its name beside yours. "Activity" (section
9) says "<person> via Claude Code key "<name>"" or "<person> via Claude (connected app)", and
History does the same for the versions Claude made. Activity also shows every use of a key or an
app, and of a Claude link.

---

## 9. Settings (site owner)

Click "Settings" in the top bar. Only the site owner sees it.

### Site name and upload limit

- "Site name": the name shown at the top of every page and on the sign-in page.
- "Upload limit (MB)": the largest file a member can upload, from 1 to 2000.

Click "Save". You see "Settings saved."

### Site address

This card shows the site's full address, with its port and its path, and a "Copy" button. Below
it are the "Port" and the "Web base path" as they are now. You can change them here instead of on
the server with `set-port` and `set-path` (see section 11). The domain stays in the "HTTPS" card.

1. Type another "Port", or change the "Web base path", or click "Random" to fill a new random path
   of 16 letters and digits. The path starts and ends with `/` and has 1 to 3 parts of 4 to 64
   letters, digits, `-` or `_`. A path of just `/` is not offered for a new path (the site can keep
   it if it has it now).
2. "Change address" is active when a value changed and both are right. The card says why a value is
   refused as you type: "Give a port number from 1 to 65535.", "Port 80 cannot serve HTTPS; choose
   another one." or "The path starts and ends with / and has 1 to 3 parts of 4 to 64 letters,
   digits, - or _, for example /k3v9x2m1q8wz7r4t/."
3. Click "Change address". "Confirm it's you" says "Changing the site address needs your password."
   (and asks your code if you have two-factor sign-in on).
4. xDesign asks "Move xDesign to <new address>?" and tells you what happens: the site restarts at
   the new address; the links you sent before (view-only links and Claude links), the Claude Code
   command and the connected Claude apps keep the old address and stop working; people editing see
   "Reconnecting". With a new path it adds "Everyone signs in again at the new address." Click
   "Move" (or "Cancel").
5. xDesign refuses at once, with its reason in this question, when the port is used by another
   program ("Port <n> is in use; choose another one."), when it is the address in use
   ("xDesign already uses this address."), or when a backup or another job is running ("A backup is
   running. Try again when it ends."). Nothing changes then.
6. After "Move" the card says "Moving to <new address>..." and lists the steps as they come. The
   site is away for a moment. If the card says "The server has not taken the request yet" after 2
   minutes, see section 12.
7. When the old address stops answering, the card shows "Open the new address". Click it. After a new
   path, sign in again there. The old address now shows the empty page. If it does not open within
   a minute, the card says "If it does not open within a minute, xDesign went back to the old
   address: reload this page." This happens when the new address fails to start: xDesign puts the
   old address back by itself and the old address works as before. A change of both port and path
   restarts the site twice.

If the port moved but the new path failed, the result says so and names the address that works now
("xDesign moved to port <n>, but the web base path change failed, so xDesign opens at <address>").
`sudo xdesign status` on the server shows the address too.

### HTTPS

The card says "The certificate the site serves. xDesign renews Let's Encrypt certificates by
itself." At its top right are two buttons: "Upload certificate" and "Issue certificate". There is
one way: xDesign does HTTPS itself, on the site's own port that the installer chose, and there is
no setting for nginx, Caddy or Apache. The "Domain" part below the certificate shows the full
address of the site, with its port and its path. This card does not change the port or the path:
use the "Site address" card above, or `sudo xdesign admin set-port` and `sudo xdesign admin
set-path` on the server (see section 11).

**The certificate row.** The site serves one certificate, shown as one row (a card on a narrow
screen):

- "Domain": the first name, then "+N" and "Show all N names" when the certificate has more.
- "Method · issuer": a chip with the method you chose: "HTTP-01", "Cloudflare DNS-01",
  "Wildcard", "Uploaded", "Files on this server" or "Built-in". Under it is the issuer ("Let's
  Encrypt", or who issued an uploaded certificate). A self-signed certificate shows the warning
  "Self-signed": browsers do not trust it.
- "Expires": a bar with the share of the certificate's life that is left, and "62 days", "Expires
  today", "Expired 3 days ago" or hours on the last day. It turns amber when a third of a Let's
  Encrypt certificate's life is left, or when an uploaded certificate has 30 days or fewer, and red
  when it is expired or failing. While Let's Encrypt has not issued the certificate yet it says
  "Not issued", and the site serves the built-in certificate meanwhile.
- "Status": "Valid", "Issuing", "Renewing", "Renewal failing", "Issuance failing", "Expires soon"
  (an uploaded or file certificate with 30 days or fewer), "Expired" or "Files unreadable". Under
  it: "Renews from <date>" or "Next attempt <date and time>" for Let's Encrypt, and "Not
  auto-renewed" or "Upload a renewed certificate" for an upload.
- The icon buttons: "Renew now", "Try now", "Replace" (an uploaded certificate) and "Remove
  certificate".

When something went wrong the row shows "Last error: <first line>". Click it to read the whole
text and the last 8 lines of the log. While Let's Encrypt works, the card reads its state every 2
seconds and shows the last lines of the log under the row. The two header buttons, "Replace" and
"Remove certificate" are off until it is done. If the certificate is not for the site's domain,
the card says "The certificate is not for <domain>" and offers "Issue certificate for <domain>".

**Issue certificate.** This window gets a free Let's Encrypt certificate. It has three parts:

- "Names": the "Domain" (the site's domain to start with). Under it: "Certificate will be issued
  for <names>". An IP address is refused: "Let's Encrypt needs a domain name."
- "Method", "How Let's Encrypt checks that the name is yours.", with three cards:
  - "HTTP-01": a certificate for this name through port 80. It needs no Cloudflare token, but port
    80 must be free and the domain must point at this server. If another program uses port 80 the
    result says "Another program on this server uses port 80. Stop it, or use Cloudflare or
    certificate files."
  - "Cloudflare DNS-01": a certificate for this name through a Cloudflare TXT record. Port 80 can
    stay closed.
  - "Wildcard": one certificate for the domain and every name one level under it, through
    Cloudflare DNS. The line then reads "Certificate will be issued for *.<domain> and <domain>".
  For both Cloudflare cards type the "Cloudflare API token" (it needs Zone:Read and DNS:Edit on
  the zone, and is stored write-only; with a token already saved the field says "A token is saved:
  leave empty to keep it"). "How to create a Cloudflare API token" opens the steps.
- "Result": click "Issue certificate" and confirm with "Confirm it's you" (your password, and your
  code if you have two-factor sign-in on). It shows "Requesting the certificate", "Let's Encrypt
  checks the name now. This can take a few minutes." and the log as it comes. It ends with
  "Certificate issued for <name>. Auto-renewal is on." or "The certificate was not issued", the
  reason and "Fix the cause, then issue it again." Click "Done".

The site keeps its current certificate until the new one is issued. The window starts on the
method you use now when it is Let's Encrypt, else on Cloudflare DNS-01 when a token is saved, else
on HTTP-01.

**Upload certificate.** Use it for a certificate you got elsewhere, with its private key. xDesign
serves it and does not renew it ("Upload a renewed certificate" says when). "Replace" opens the
same window to put a new one in place of an uploaded one. It has two tabs:

- "Paste or load file". Paste the "Certificate (PEM, full chain)" and the "Private key (PEM)" into
  their fields, or click "Load file..." or drop a file on a field. The key must have no passphrase.
  A key pasted into the certificate's field is taken from there. A .pfx, .p12 or .der file is
  refused: it holds no PEM block, so convert it to PEM first.
- "Files on this server". Type the paths of the "Certificate chain (full chain)" and the
  "Private key". The xdesign user must be able to read both files. xDesign reads them again every
  minute, so a renewal by certbot is picked up. The window starts on this tab when you already use
  files. On a Windows server the examples are `C:\Certificates\design.example.com\fullchain.pem` and
  `privkey.pem` in the same folder, and the hint says "The xDesign service must be able to read
  both files. xDesign reads them again every minute, so a renewal is picked up." (the service's
  account is `NT SERVICE\xdesign`).

Click "Upload certificate" (on the second tab "Use these files") and confirm with "Confirm it's
you". The answer says "Certificate stored" ("Certificate stored, replacing the earlier upload"),
"Covers <names>." and "Issued by <issuer>, expires <date>." It also says when a certificate of the
bundle was left out ("One certificate of the bundle was left out"), warns "Self-signed", and says
"It does not cover <domain>" when the certificate is for another name. A refusal says "The
certificate was not stored" with its reason.

**Try now.** When Let's Encrypt, or the files, have a problem, "Try now" tries again. This is also
what you do after the installer said that Let's Encrypt did not issue a certificate: fix what the
card says (for example the domain's DNS record or the Cloudflare token), then click "Try now".
Until it works the site keeps the built-in certificate.

**Renew now.** With a working Let's Encrypt certificate the row has "Renew now". It asks "Renew the
certificate now?" and says "xDesign renews it by itself from <date>. Let's Encrypt allows only a
few new certificates a week for the same names, so renew by hand only when something is wrong."
Click "Renew now" to go on, or "Cancel". The row then shows "Renewing" and the log, and ends
"Valid" with a new expiry. You rarely need it. While a certificate is being issued or renewed the
button is off.

**Remove certificate.** It asks "Remove the certificate?" ("The site goes back to its built-in
certificate, which browsers warn about. A Let's Encrypt certificate stops renewing."), then
"Confirm it's you". You see "Certificate removed. The site serves its built-in certificate." and
the chip turns "Built-in".

To move the site to a new domain, use "Change the domain" and type "New domain". Its DNS record
must already point at this server. The port and the path stay the same.

### Claude connections

For the site owner: every person's API keys and connected Claude apps in one list. Each row says
"API key · <person>" or "Connected app · <person>", then "Last used <time>" or "Not used yet". A
row that says "Can't show questions" belongs to an app that cannot show Claude's questions in the
chat (see section 8): Claude then asks through a ticket. Click "Ask in the chat again" to try the
chat again.

- **Ask first.** The switch on each row. It is on at first. Turn it off only for a key or an app you
  trust: Claude then runs the actions that cannot be undone without asking.
- **Revoke** (a key) stops it at once. **Disconnect** (an app) asks "Disconnect <app> of <person>?"
  and ends the connection.

With nothing connected, the card says "No API keys or connected apps yet."

### Activity

"Activity" is the list of what happened on the site: sign-ins and failed sign-ins,
members added ("Added <name> as <username>"), usernames given or changed ("Gave <name> the
username <username>", "Changed the username of <name> from <old> to <new>"), passwords set
("Set the password of <name>"), members disabled or removed, password changes, designs made, renamed, shared, deleted and
transferred, comments and resolved comments, versions named, restored and deleted, view-only links
and Claude links made and revoked, API keys made, revoked and used, connected apps connected and
disconnected, Ask first turned on and off, templates saved, used and removed, two-factor sign-in
turned on and off ("Turned on two-factor authentication", "Made new recovery codes", "Used a
recovery code (N left)", "Turned off two-factor authentication for <name>"), a changed site
address ("Asked to move the site to port <port> and the path <path>"), and more. A Claude link that
reads a file shows as "A Claude link". A wrong code at sign-in shows as "Failed sign-in as <username>
(wrong code)". A change made through Claude shows the key or the app beside the person: "<person>
via Claude Code key "<name>"" or "<person> via Claude (connected app)". Each row says who did it,
when, and which design. Use "Person" and "Design"
to filter. Under the list, choose how many rows a page shows ("Rows per page": 10, 25, 50 or 100;
25 to start, remembered in this browser) and move between pages with "Previous", the page
numbers and "Next". It also says which rows you see, for example "Rows 26 to 50 of 312". The page
is in the address (`?page=3`), so a reload keeps it and the browser's Back button returns to the
page before; choosing another person, design or number of rows goes back to page 1. On a narrow
screen "Previous" and "Next" show only their arrows. Rows are kept for a year.

---

## 10. Maintenance (site owner)

Click "Maintenance" in the top bar. Only the site owner sees it. It has five cards.

### This server

"This server" shows the version ("Version"), how long it has been running ("Running for"), the
address, the HTTPS state, and the size of the database and the media and the free disk. If the
last update or restore failed, it says so here and shows where the log is.

### Backups

A backup holds everything: the designs, the members, the settings and the certificates.

- xDesign makes one by itself every day at 03:30 (server time) and keeps the last 14.
- It also makes one before every update and every restore, and keeps the last 3 of these.

Open "Backups". The list shows each backup with its size and time.

- **Make a backup now.** Click "Make a backup now".
- **Download.** Click "Download" and confirm with your password ("Confirm it's you"). A backup is
  a `.tar.zst` file. Keep a copy somewhere other than the server.
- **Restore.** Click "Restore" and confirm with your password. The server first makes a backup of
  the site as it is now, then puts back the database, the media, the settings and the certificates
  of the chosen backup, and restarts xDesign. Everything changed since that backup is lost. When
  it ends, you see "xDesign was restored from" and the backup's name.
- **Delete.** Click "Delete" and confirm with your password.

You can also restore a backup on a new server, at the first question of the installer (section 2).

### Update

xDesign has no online update. A new version arrives as a new file, like the first one. To update:

1. Copy the new file (and `SHA256SUMS` if you have it) to your own computer. A `.tar.gz`, zip,
   `tar.xz` or `tar.zst` that holds the file works too. On a Windows server the file is the
   `.exe` (`xdesign-<version>-windows-<cpu>.exe`) or its `.zip`.
2. Open "Update". Drop the file in the box, or click "choose files". You can add `SHA256SUMS` and
   `SHA256SUMS.sig` in the same box.
3. Click "Upload and check". Confirm with your password.
4. xDesign checks the file and lists the results as rows: the version change (for example "1.0.0
   to 1.1.0"), "System: Linux" (or "System: Windows"), "CPU: amd64", "Checksum: matches" (or "not
   given"), "Signature: valid" (or "not signed"), "Disk space: enough" and "Can update from 1.0.0:
   yes". If the file carries release notes, they are shown. If something is wrong, you see "This
   file cannot be installed" and why. A file for the other system is refused: a Linux server
   says "This file is for Windows; this server runs Linux.", and a Windows server says "This file
   is for Linux; this server runs Windows."
5. Click "Install and restart". Confirm with your password.
6. A tracker shows four steps: "Upload the file", "Check it", "Install and restart" and "Back on
   the new build". The last ends with "xDesign 1.1.0 runs now." (with the new version).

During the update the site is away for a short time. Everyone with xDesign open sees "xDesign was
updated. Reload to use the new version." Click "Reload".

**If it fails.** The server makes a backup first. If the new version does not start, xDesign goes
back to the old version by itself. You see "The update went back by itself" and the path of a log
file. Nothing is lost.

### Go back

"Go back" lists the earlier versions that the server keeps (the last 3). Click "Roll back to"
followed by a version, and confirm with your password. xDesign restarts on the old version.

If the update changed the database in a way the old version cannot read, going back needs the old
data too. Then "Also restore the data from before the update" is chosen for you. It brings back
the data of the backup made before that update. Anything changed since is lost.

### Uninstall xDesign

The last card, "Uninstall xDesign", removes xDesign from this server. It reads "Removes xDesign
from this server. The site stops at once." It is there on Linux and Windows servers, for the site
owner only. The desktop app does not have it.

1. **Choose what happens to your data.** Neither choice is chosen at first.
   - **Keep the data.** "The program goes. The designs, the settings and the backups stay on this
     server; installing xDesign again picks them up."
   - **Remove everything.** "The program, the designs, the settings and the backups on this server
     go. This cannot be undone."
2. **Make a backup if you want one.** "Make a backup and download it before you uninstall. With
   Remove everything, the backups on this server go too." Click "Download a backup". The line
   under the button says "Making a backup..." and then "Downloaded" with the file's name. The
   backup also shows in "Backups". It is only an offer: you can uninstall without it. Like
   "Download" in "Backups", it asks "Confirm it's you" unless you confirmed in the last 5 minutes.
3. **Type the word.** Under "Type uninstall to confirm", type `uninstall`. The letter case and the
   spaces around the word do not matter. The button "Uninstall xDesign" works only once you have
   chosen and typed the word.
4. **Click "Uninstall xDesign".** A window titled "Uninstalling xDesign" repeats what your choice
   does and says "It needs your password." (or "your password and a code", when your account has
   a second factor). This is "Confirm it's you", and it asks every time, even if you confirmed a
   moment ago. Click "Uninstall xDesign" in that window.

The card then shows "Uninstalling xDesign..." with "Waiting for the server to take the request."
and, once the server has it, "The uninstaller started. The site stops in a moment." Then the site
stops, and the page says "xDesign is uninstalled from this server." with one more line for your
choice: "Its data stays on the server: installing xDesign again picks it up." after "Keep the
data", or "Nothing of it is left on the server." after "Remove everything". Nothing is left but
the installer's log (on Linux `/var/log/xdesign-install.log`, on Windows
`C:\ProgramData\xDesign\logs\install.log`) and, on Windows, a temporary folder in
`C:\Windows\Temp` that Windows deletes at the next restart. While the uninstall runs, the other
cards of "Maintenance" stay busy.

If the site still answers 3 minutes after the uninstaller started, the page says "xDesign still
answers: the uninstall did not finish." and "Run xdesign --uninstall on the server." (section 11).
Click "Done" to get the form back. If the server refuses the request, the card shows its words,
for example "A backup is running. Try again when it ends." Try again when the backup has ended.

"Activity" records "Started the uninstall: keep the data" or "Started the uninstall: remove
everything".

**Claude cannot do this.** Uninstalling is never open to Claude, not even with full access: asked
to do it, Claude answers "Uninstalling xDesign is not open to Claude: the site owner does it in
Maintenance."

---

## 11. The command line on the server

These commands run on the server. Most need `sudo`. You can see the list with `xdesign help`. On a
Windows server the same commands work without `sudo`, in a terminal opened as Administrator: see
"On Windows" at the end of this section.

| Command | What it does |
|---|---|
| `sudo xdesign status` | Shows the version, the port xDesign serves HTTPS on, the full address (with the port and the path), whether it is healthy, how long it has run, the size of the database and the media, the free disk, the last backups and when the certificate ends. |
| `sudo xdesign backup` | Makes a backup now, in `/var/lib/xdesign/backups/`. |
| `sudo xdesign restore FILE` | Puts a backup file back. It checks the file, makes a backup of the site as it is now, and restarts xDesign. Add `--yes` to skip the question. |
| `sudo xdesign update FILE` | Updates from a new xDesign file (or a `.tar.gz`, zip, `tar.xz` or `tar.zst` that holds it). It checks the file, makes a backup, installs and starts the new version, and goes back by itself if it fails. |
| `sudo xdesign update FILE --dry-run` | Checks the file and shows the plan. Changes nothing. |
| `sudo xdesign rollback` | Goes back to the version before. Add `--to VERSION` for another kept version, and `--restore-db` to also put back the data from before the update. |
| `sudo xdesign admin reset-password USERNAME` | Makes a new password for that person, shows it once and ends their sessions. Use it when the owner forgot the password. |
| `sudo xdesign admin reset-2fa USERNAME` | Turns off two-factor sign-in for that person. Use it when the site owner lost their phone and their recovery codes (for other people, the site owner does it on the Members page). It asks "Turn off two-factor authentication for <username>? [y/N]" and, after y, says "Two-factor authentication is off now." Add `--yes` to skip the question. After it the person signs in with the password alone. |
| `sudo xdesign admin list-users` | Lists everyone: username, name, site owner or member, active or disabled, and when they were last seen. |
| `sudo xdesign admin set-port PORT` | Moves the site to another port, for example `sudo xdesign admin set-port 40000`. It opens the new port in the firewall, restarts xDesign and closes the old port. If xDesign does not answer on the new port, it goes back to the old one. Add `--no-firewall` to leave the firewall alone. If your hosting company has a firewall in its web panel, allow the new port there too. |
| `sudo xdesign admin set-path PATH` | Changes the web base path, for example `sudo xdesign admin set-path --random` for a new random one. The old address stops working: view-only links and Claude links you already sent, and Claude Code's connection to xDesign, need the new address. It asks first. |
| `xdesign logs [-f] [--lines N]` | Windows only: shows the last 100 lines of the service's log (or N lines), each with its time. `-f` goes on showing new lines until you press Ctrl+C. On Linux it prints "Use journalctl -u xdesign (add -f to follow)." |
| `sudo xdesign --uninstall` | Removes xDesign from the server. It asks one question first (see below). |

**Moving the site.** `sudo xdesign admin set-port 40000` shows the new address and asks "Move
xDesign to port 40000? [Y/n]". Then it restarts xDesign and ends with "xDesign now answers at"
the new address. Bookmarks to the old port stop working. `sudo xdesign admin set-path --random`
(or `set-path /your-own-path/`) warns "The old address stops working: view-only links and Claude
links you already sent, and Claude Code's connection to xDesign, need the new address." and asks
"Change the web base path? [y/N]". After it, send new view-only links and Claude links, and connect
Claude Code again with the new address. Both commands refuse while an update, a restore, a backup,
a domain change or an address change asked for in the website is running: try again when it is
done. If the site does not answer after the change, they put the old port or path back. Run
`sudo xdesign status` to see the address again. The "Site address" card in Settings (section 9)
does the same change from the browser.

**Losing two-factor sign-in.** `sudo xdesign admin reset-2fa owner` asks ":: Turn off
two-factor authentication for owner? [y/N]". Answer `y`. It then says "Two-factor
authentication is off now." If the person has it off already you see "Two-factor authentication is
already off for owner."; for a username the site does not know, "No one on this site has
the username owner."; and after `n` (or Enter) ":: Nothing was changed."

**Installing.** `sudo ./xdesign-1.0.0-linux-amd64 --install` asks its questions. The flags that
answer them for a script (`--yes`, `--domain`, `--https`, `--cloudflare-token` and the others) are
in section 2, "Installing without questions".

`sudo xdesign --uninstall` asks "Keep the data or remove everything?" and you pick 1 or 2:

1. **Keep the data.** The program and its services go. The database, the media, the backups, the
   settings and the certificates stay. If you run the installer again later, it picks them up.
2. **Remove everything.** The data, the settings, the backups and the `xdesign` user are deleted
   for good. Before that it offers to make a last backup in `/root/xdesign-final-<time>/`, outside
   the data that is deleted.

It also offers to make a backup first, and asks a final yes or no before it does anything. The
site's owner can do the same from the website: "Uninstall xDesign" in section 10, "Maintenance".

### On Windows

Open a terminal as Administrator (Start, type `PowerShell`, right-click "Windows PowerShell",
"Run as administrator") in place of using `sudo`. In a terminal that is not opened as
Administrator, the commands that change or read the site's files stop with "Run this in a
terminal opened as Administrator." The commands are the ones of the table, written without `sudo`:
`xdesign status`, `xdesign backup`, `xdesign restore FILE`, `xdesign update FILE`, `xdesign
rollback`, `xdesign admin reset-password USERNAME`, `xdesign admin reset-2fa USERNAME`, `xdesign
admin list-users`, `xdesign admin set-port PORT`, `xdesign admin set-path PATH` and `xdesign
--uninstall`. A file path is written the Windows way, for example `xdesign update
.\xdesign-1.1.0-windows-amd64.exe` or `xdesign restore
C:\ProgramData\xDesign\backups\<file>`. A backup is made in `C:\ProgramData\xDesign\backups\`.

- **The service.** `Get-Service xdesign` shows whether xDesign runs ("Running" or "Stopped").
  `Restart-Service xdesign` restarts it, `Stop-Service xdesign` and `Start-Service xdesign` stop and
  start it. Windows starts it again by itself if it stops by mistake. Do not stop
  `xdesign-maintenance` while an update runs: Windows refuses, and the update finishes.
- **The log.** `xdesign logs` shows the end of the log, `xdesign logs -f` follows it and `xdesign
  logs --lines 300` shows more. The file is `C:\ProgramData\xDesign\logs\xdesign.log`; it starts
  a new file at 10 MB and keeps the last 5. The updates and restores write
  `C:\ProgramData\xDesign\logs\maintenance.log`.
- **The port.** `xdesign admin set-port 40000` moves the rule of Windows Firewall too: it makes
  "xDesign (TCP 40000)" and, once xDesign answers there, deletes the old port's rule that the
  installer or an earlier `set-port` made. A port you opened yourself is left alone.
- **Uninstalling.** `xdesign --uninstall` asks the same question, "Keep the data or remove
  everything?". Both services, the firewall rules the installer made, the `xdesign` entry of the
  system PATH and `C:\Program Files\xDesign` go. "Keep the data" leaves `C:\ProgramData\xDesign`
  as it is. "Remove everything" deletes it too, but for the uninstaller's own log, and its last
  backup goes to a folder `xdesign-final-<time>` in your own user folder (for example
  `C:\Users\you\`). There is no `xdesign` user on Windows. When Windows still holds a file of the
  program folder, the uninstaller says so and Windows deletes that file at the next restart. The
  entry in Windows' list of installed apps goes too; its "Uninstall" button runs this command
  (section 2, "Install on Windows"), and the website has "Uninstall xDesign" in section 10.

---

## 12. When something goes wrong

### "xDesign was updated. Reload to use the new version."

The site was updated while you had it open. Click "Reload". Your work is saved.

### "This design is too big to save more changes."

The design has grown past what the server can store. Your last change was not saved, and the top
bar says it is offline. Click "Discard unsaved changes". xDesign throws away the copy in your
browser and reloads the design from the server, so you lose only the changes the server did not
take. Then make the design smaller: delete steps or media you do not need, or split it into two
designs. Tell the site owner if it happens often.

### "The server is busy. Trying again..."

A banner at the top. The server will take your changes in a moment. You do not need to do
anything.

### "Offline, your changes are kept on this computer"

Your browser lost the connection to the server. Keep working. Your changes are kept in your
browser. When the connection is back, the top bar goes through "Reconnecting..." to "Saved", and
your changes are sent and merged with everyone else's. If "Reconnecting..." stays for a long
time, check your internet connection. If that does not help, reload the page.

Do not clear your browser's data before the top bar says "Saved". Unsent changes live there.

### "Read only"

You cannot change this design. You are a Commenter or a Viewer, or you are on a narrow screen (the
note says "Editing works on a computer screen"), or the connection is read-only. Ask the design's
owner for the Editor role. Use a computer for editing.

### "You no longer have access to this design."

The owner removed you from the design, or deleted it. Ask the owner if you need access again.

If you could edit the design, changes you made while offline may not have reached the server, so
xDesign first offers "Download my offline changes". It saves the design as your browser had it, as
a `spec.json` file (without the uploaded files). To keep your work, use "Import" on the Designs
page with that file: it makes a new design that is yours. "Go to Designs" leaves without saving.

### "Sign in to continue."

Your session ended, for example because you signed out in another tab, or the owner disabled your
account, or it was 30 days since you last used the site. Sign in again.

### "Too many tries. Wait 15 minutes or ask the site owner to set a new password."

Too many wrong passwords. Wait 15 minutes, or ask the site owner to set a new password for you
(Members, "Set password", section 3). A new password set by the site owner works at once, even
before the 15 minutes end.

### "Wrong code. 4 attempts left."

At sign-in, the code from your authenticator app was wrong. Check that the code is the one for
xDesign and that it is not about to change, then type the new one. The number says how many tries
you have left. A phone whose clock is wrong makes every code wrong: set the phone's time to
automatic. You can also click "Use a recovery code". After the last try you see "Wrong code, and no
attempts are left. Enter your password again." and you start over with the password.

### "The sign-in step expired. Enter your password again."

The code step lasts 5 minutes, and it also ends when you open it from another network address.
Type your password again, then the code. If you see "Too many failed attempts. Wait and try again.",
wrong passwords and wrong codes were too many: wait 15 minutes.

### I lost my phone and my recovery codes

Ask the site owner to open Members, click the menu on your row and choose "Turn off two-factor
authentication". Then sign in with your password and turn it on again on your Account page. If you
are the site owner, run `sudo xdesign admin reset-2fa <your username>` on the server (section 11).

### "Too many calls. Wait a minute."

Claude (a key or a connected app) made more than 120 calls in a minute. Wait a minute and ask
again.

### Claude's question was not answered

When Claude asks "Delete a design forever, ...?" and you do not answer within 10 minutes, Claude
says "The person did not answer within 10 minutes, so nothing was done." Nothing changed. Ask
Claude again. If your answer was No, Claude says "The person said No, so nothing was done." and
does not ask again unless you tell it to. If the app cannot show the question, Claude shows it in
the chat: say Yes there, and Claude runs it with its ticket (one use, 10 minutes).

### Claude cannot connect

The Claude app and claude.ai need a certificate that browsers trust, and the site's port open to
the internet. On the Account page, "The Claude app needs a certificate browsers trust: choose
Let's Encrypt in Settings > HTTPS." means the site uses the built-in certificate. Choose Let's
Encrypt there (section 9), and open the port in your hosting company's firewall (section 2). If
the page "This request to connect an app cannot go on" appears, the app's request was not valid:
start again from the app. If "This request has ended" appears, it was answered, expired or is open
in another browser: start again from the app. A site address that changed (section 9) stops the
connection: connect again with the new address.

### "This account is disabled. Ask the owner to enable it."

The owner disabled your account. Ask them to click "Enable" for you.

### "Invite links no longer work. Ask the site owner for an account."

xDesign no longer has invite links or password reset links. If you open an old one, you see this
page (or "Password reset links no longer work. Ask the site owner to set a new password."). Ask the
site owner to add you ("Add member") or to set a new password for you, then click "Go to sign in".

### The page says "xDesign is starting..."

xDesign is starting or restarting, for example after an update. Wait a few seconds. The page
comes back by itself. If it stays for more than a minute, ask whoever runs the server to run
`sudo xdesign status` and look at `journalctl -u xdesign -f` (on Windows: `xdesign status` and
`xdesign logs -f`).

### Maintenance says "The server has not taken the request yet"

The helper that carries out updates, restores and address changes is not running. The message shows a command to
check it: `systemctl status xdesign-maintenance.path`. Run it on the server and start the service
if it is stopped.

### "This link no longer works. Ask the person who sent it for a new one."

You opened a view-only link that was revoked, that has expired, or whose design is in Trash. Ask
the person who sent it for a new link.

### "This link was revoked or does not exist."

A Claude link was revoked or was copied wrong. Make a new one in "Share" (section 8).

### "This design was restored to an earlier version."

Someone with access to the design went back to an earlier version in History. Your screen shows the
design as it is now. Your undo list starts again. Nothing is lost: the design before the restore is
kept as "Before restore".

### On a Windows server

**"Run this in a terminal opened as Administrator."** The command needs the rights of an
Administrator. Close the terminal, open a new one with Start, `PowerShell`, right-click "Windows
PowerShell", "Run as administrator", and run the command again. The same happens when you
double-click the installer and answer No to the question Windows asks.

**"xDesign installs on Windows Server 2019, 2022 and 2025, Windows 10 (1809 or later) and Windows
11, 64-bit; this system is ..."** The installer refuses an older Windows. Use a newer one.

**The installer refuses the file for the CPU.** An amd64 file does not install on a Windows that
runs on an ARM computer: the installer names the arm64 file to use instead.

**"80 (IIS or another HTTP.sys program) in use".** IIS, or another program that works like it,
holds port 80. Let's Encrypt over port 80 then cannot work. Choose Let's Encrypt through Cloudflare
DNS or the built-in certificate at the question, or stop that program's site on port 80 and run
the installer again.

**The installer stops at a step.** Run it again: it goes on where it stopped. If the site did not
start, the installer shows the last lines of the service's log. Look at more of them with `xdesign
logs --lines 50` (or `xdesign logs -f`), in a terminal opened as Administrator. The installer's own
log is `C:\ProgramData\xDesign\logs\install.log`.

**The site does not answer.** Run `Get-Service xdesign`. If it says "Stopped", run `Start-Service
xdesign`, then `xdesign status` and `xdesign logs -f`. If the site's port is closed, check that
Windows Firewall has the rule "xDesign (TCP <port>)", or allow the port in your hosting company's
firewall.

**"This file is for Linux; this server runs Windows."** You gave the Windows server a Linux file in
Maintenance > Update (or the other way round: "This file is for Windows; this server runs
Linux."). Use the `.exe` named `windows` for a Windows server.

**"xDesign could not start its maintenance helper (...)" or "This installation has no
maintenance helper (the service xdesign-maintenance)."** The service that carries out updates,
restores and address changes is missing or cannot start. Run the installer again on the server to
repair it: `xdesign --install`, in a terminal opened as Administrator.

### Something else

Run `sudo xdesign status` on the server. Look at the log with `journalctl -u xdesign -f`. Make a
backup (`sudo xdesign backup`) before you try anything bigger. On a Windows server, run `xdesign
status` and `xdesign logs -f` in a terminal opened as Administrator, and `xdesign backup`.

---

## 13. The desktop app

### What it is

The desktop app is xDesign as an app on one computer, for one person. You open it like any other
app, in its own window with xDesign's icon. It keeps your designs on the computer, and it needs no
internet, no server and no sign-in. It runs on Windows 10 and 11, on Linux and on macOS, on amd64
and arm64 computers.

It is the same xDesign as the website: the designs list with templates, the editor, Try it,
Checks, Export, Import and Print. It also has:

- History, to look at an earlier version of a design and go back to it (section 5).
- Comments, which work as notes for yourself (section 5), and the bell.
- Backups, with their own page (below).
- The connection to Claude Code (below).
- The light and dark switch.

It does not have what only makes sense with several people or a server:

- No sign-in, password, two-factor sign-in or sessions. The app makes one account for you the
  first time it starts. Its Name is taken from your computer's user name, and you can change it on
  the Account page.
- No Members, no "Share", no "Shared with me", no view-only links and no Claude links.
- No connection for the Claude app or claude.ai. They cannot reach a computer, so "Connected
  apps" is not shown.
- No Settings (site name, site address, HTTPS and Activity) and no Maintenance. The app has its
  own Backups page instead.

The menus and pages for these are simply not there. If you open the address of one, the app takes
you to Designs.

To move a design between the app and a server, use Export and Import (section 8). A backup of the
app and a backup of a server are different files and cannot be used in each other.

### Getting the file

The desktop files are built by `./build.sh`, on the computer where you build releases. It asks:

```
:: What to build:
   1) Server   2) Desktop app   3) Both
   Choose [1]:
```

Choose "2) Desktop app" (or "3) Both", which first asks "Server for" as well, see "Building the
file" in section 2). Then it asks for the systems, for Windows which file, then for the CPUs:

```
:: Desktop app for:
   1) Windows  2) Linux  3) macOS  4) All
   Choose [4]:
:: Windows desktop file:
   1) Portable   2) Installer   3) Both
   Choose [1]:
:: CPUs:
   1) amd64   2) arm64   3) both
   Choose [3]:
```

"Portable" is one file that runs without installing. "Installer" is a setup file that installs
xDesign as other Windows apps are installed. "Both" makes the two. The setup file needs Wine on the
computer where you build: `./build.sh` checks for it and says how to get it (`pacman -S wine` on
Arch, `apt install wine` on Debian and Ubuntu). The portable file needs nothing more.

To skip the questions, use `./build.sh --desktops windows,linux,macos` (name only the systems you
want) and, if you like, `--arches amd64,arm64`. Naming only `--desktops` also builds the Linux
server; add `--servers none` to build the desktop app alone. For Windows, `--windows-desktop
portable`, `installer` or `both` chooses the file (`portable` when not given), and `make release`
takes it as `WINDOWS_DESKTOP=both`. The files are made in `dist/`:

| System | File |
|---|---|
| Windows | `xdesign-desktop-<version>-windows-<cpu>.exe`, one portable file, and `xdesign-desktop-<version>-windows-<cpu>-setup.exe`, the setup file (the one you chose, or both) |
| Linux | `xdesign-desktop-<version>-linux-<cpu>.AppImage` |
| macOS | `xdesign-desktop-<version>-macos-<cpu>.zip`, with `xDesign.app` inside |

`<cpu>` is `amd64` for most computers and `arm64` for ARM ones (for example a Mac with an Apple
chip, or Windows on ARM). The files are listed in `SHA256SUMS` with the server files and in the
release notes.

### Opening it for the first time

**Windows.** Double-click the `.exe`. Nothing is installed: the file is the app. It unpacks itself
at every start, so it takes a few seconds to open. Windows may warn you the first time that the
publisher is unknown. Click "More info", then "Run anyway".

**Windows, the setup file.** Double-click `xdesign-desktop-<version>-windows-<cpu>-setup.exe` (the
same warning the first time: "More info", then "Run anyway"). It asks nothing and needs no
Administrator: it installs xDesign for you alone in `%LOCALAPPDATA%\Programs\xDesign`, puts
"xDesign" with its icon in the Start menu and on the desktop, and starts it. Settings > Apps >
Installed apps lists it as "xDesign desktop app", with its version. The installed app and the
portable file use the same data folder, so both see the same designs.

**Linux.** Make the `.AppImage` file executable (in your file manager: Properties, then
Permissions, then allow running it as a program; or `chmod +x` and the file's name in a terminal),
then open it. On a recent Ubuntu (24.04 and newer), which restricts what an AppImage may do, the
app sees this and starts without Chromium's extra sandbox; you see no difference.

**macOS.** Unzip the `.zip`: it holds `xDesign.app`. The app is signed ad hoc, not by Apple (there
is no Apple account behind it), so macOS refuses to open it the first time. Open it anyway in one
of these ways:

- Right-click `xDesign.app`, then "Open".
- Or open "Privacy & Security" in the System Settings and click "Open Anyway" for xDesign.
- On a newer Mac, neither may be enough. In a terminal, go to the folder with the app and run
  `xattr -dr com.apple.quarantine xDesign.app`, then open the app again.

When the app starts, the window says "Starting xDesign..." for a few seconds, then shows your
designs, with no sign-in. Open the app again while it runs and the same window comes to the front:
there is only ever one. Closing the window quits the app (also on macOS).

### The window

- The window keeps its size and place for the next time.
- Links to other sites in a design open in your default browser, not in the window.
- The menus are Edit, View (reload, zoom and full screen) and Help. Help has "About xDesign", with
  the version, and "Open data folder". On macOS "About xDesign" is in the xDesign menu instead.
- The person menu (your picture in the top bar) has "Account" and "Backups". There is no "Sign
  out".

### Where your designs are kept

The app keeps everything in a folder of its own:

| System | Folder |
|---|---|
| Windows | `%APPDATA%\xDesign` |
| Linux | `~/.config/xDesign` |
| macOS | `~/Library/Application Support/xDesign` |

To open it, choose Help, then "Open data folder". Inside you find:

- `data`: your designs and their pictures and files. Do not change anything in it by hand.
- `backups`: the backups (below).
- `logs`: `xdesign.log`, what the app did, for when something goes wrong. A new file starts at
  10 MB, and the last 5 are kept.
- `window.json` and `session`: the window's place and the window's own files.

The portable file and the installed app share `%APPDATA%\xDesign` on Windows. Quitting the app does
not remove anything. To use your designs on another computer, use Export and
Import, or copy a backup (below).

### Backups in the app

Open the person menu and click "Backups". The page says "A backup is made every day while xDesign
runs; the last 14 are kept."

- **Automatic.** While the app runs, it checks every hour and makes a backup when the newest one
  is a day old. A backup you make by hand counts as the newest.
- **Make a backup now.** Click it. The page says "Made the backup" and the file's name.
- **The list.** Newest first: the time, the kind ("Automatic", "Made by hand" or "Before a
  restore"), the size, the xDesign version and the file's name. Without any, it says "No backups
  yet." Each backup is one `xdesign-backup-<time>.zip` file in the `backups` folder, and the last
  14 are kept, of all kinds together.
- **Restore.** Click "Restore" on a backup. The app asks "Restore this backup?": "The designs as
  they were at <time> replace the ones in the app now. A backup of the app as it is now is made
  first." Click "Restore". The app makes that backup (its kind is "Before a restore"), then the
  page says "Restoring... xDesign starts again in a moment." A few seconds later the window comes
  back with your designs as they were. If the restore is not what you wanted, restore the "Before
  a restore" backup. Everything made after the backup you restored is gone, including API keys for
  Claude Code.
- **Save a copy...** Saves the backup file wherever you choose, for example on a USB stick.
- **Restore from a file...** Choose a backup file you saved earlier, even from another computer
  with the app. The app asks the same question with the time of that backup. A file that is not an
  xDesign backup (a server backup, for example) says "This is not an xDesign backup." A backup
  made by a newer xDesign says "This backup is from xDesign <version>. Use that version or a newer
  one."
- **Delete.** Asks "Delete the backup of <time>?" with "This cannot be undone." Then click
  "Delete".
- **Open the backups folder.** Opens the folder in your file manager.

While a backup is being made or restored, the page says "A backup is being made or restored now."
A backup holds the designs, their pictures and files, and nothing else: the window's place and the
log are not in it. A backup can hold up to 4 GB; past that the app says "The designs and their
files are over 4 GB, too large for a backup." and you use Export instead.

### Claude Code with the app

Claude Code can read and change your designs in the app, as it can on a server (section 8). Open
Account. The Claude card has "API keys". Make a key, and run the command the card shows in a
terminal. It looks like this:

```
claude mcp add --transport http xdesign http://127.0.0.1:47823/mcp --header "Authorization: Bearer <key>"
```

The card shows your own key and the port of this start. Other MCP programs on the same computer
use the same address, which the card also shows. Each key has "Ask first" and "Revoke", as on the
website.

The address works only on this computer, and only while the app is open.

The port is 47823. If another program already uses it, the app takes another one, and the Claude
card says: "xDesign uses port <n> this time, so Claude Code's saved address does not work. Add it
again with the command above." Run the command again, with the new port. Close the other program
if you want the app to have 47823 back.

Claude has fewer actions in the app: the ones for members, sharing, links, settings, HTTPS and
updates are not there. For backups it can list them, make one, delete one and restore one; the
last two ask you first.

### Updating

Close xDesign, then use the newer file in place of the old one: the new `.exe`, the new
`.AppImage`, or the new `xDesign.app` from the new `.zip`. Nothing needs uninstalling. Your designs
stay in the data folder, and the new version updates them the first time it starts, which can take
a little longer than usual.

Installed with the setup file, run the newer setup file instead. It closes xDesign if it runs
(click OK when it asks), puts the new version in place of the old one and keeps your designs.

It is wise to make a backup first (page "Backups").

An older version refuses designs that a newer one has opened: it says "These designs were saved by
xDesign <version>. Use that version or a newer one." So to go back to an older file, restore a
backup made before the update, or keep using the newer version.

### Uninstalling

The portable file needs no uninstalling: delete it. The data folder stays until you delete it.

Installed with the setup file, open Settings > Apps > Installed apps, find "xDesign desktop app"
and click Uninstall. Answer OK to "Are you sure you want to uninstall xDesign?". It closes xDesign,
then asks:

```
Also remove your designs?

Yes removes the designs, backups and settings in %APPDATA%\xDesign.
No keeps them for the next time you install xDesign.
```

Then it removes xDesign from the computer, the Start menu and the desktop. No, the default, keeps
your designs: install xDesign again and they are there. Yes removes the folder, also for the
portable file, which uses the same one. A newer setup file run over an installed xDesign never asks.

### What can go wrong

The window's own pages end with "Log:" and the path of `xdesign.log`.

**"xDesign stopped unexpectedly."** The part of the app that keeps your designs ended. Click
"Start again". If it happens again, open the log (the path is on the page) and send its last
lines to whoever gave you the app. Your designs are saved as you work.

**"xDesign did not start in 60 seconds."** The app did not answer. This can happen the first time
after an update with a big change to the designs, or on a very slow computer. Click "Start again":
it waits again.

**"xDesign did not start:" and a reason from the system.** The app could not run its own program.
Click "Start again". If it stays, send the page's words to whoever gave you the app.

**"These designs were saved by xDesign <version>. Use that version or a newer one."** You opened
the app with an older file than the one that last used these designs. There is no "Start again"
here: use the file of that version or a newer one.

**"Open xDesign from its app."** This is the page you get when you open the app's address
(`http://127.0.0.1:47823/`) in a web browser. It is on purpose: only the app's window can open
your designs. If the app's own window shows it, close the app and open it again.

**Another program already uses port 47823.** The app still opens, on another port. Only Claude
Code's saved address changes (see "Claude Code with the app").

// A code block's language as each app writes it in the block's header (docs/plan/29-owner-list-2026-10-22.md
// section 8.4, TGP-02): the looks' SkinTokens.code.language. Desktop writes the word as it is
// (text.cpp:1686-1695), so it has no table here.

/**
 * A table of languages written as `Name=word alias alias;` entries, read into a map from each
 * word (lower case) to the name. The name's own lower case is a word too where `withName` (Web K
 * adds it, codeLanguages.ts:955-963). Where two entries share a word the first wins (Web A's
 * find) or the last (`lastWins`: Web K's assignments).
 */
function table(text: string, { withName, lastWins }: { withName: boolean; lastWins: boolean }): Map<string, string> {
  const names = new Map<string, string>()
  for (const entry of text.split(';')) {
    const [name = '', words = ''] = entry.trim().split('=')
    if (!name) continue
    const all = words.split(' ').filter((word) => word !== '')
    if (withName) all.unshift(name.toLowerCase())
    for (const word of all) if (lastWins || !names.has(word)) names.set(word, name)
  }
  return names
}

/**
 * Web A (telegram-tt src/util/codeLanguages.ts:3-106): each language it highlights, the name it
 * writes, then its key and aliases ("1с" with a Cyrillic letter is the app's).
 */
const webANames = table(
  `1C=1c 1с; Ada=ada; Arduino=arduino ino; ARM Assembly=armasm arm; Bash=bash sh; BASIC=basic; C=c h;
  C++=cpp cc c++ h++ hpp hh hxx cxx; C#=csharp cs c#; CSS=css; Dart=dart; Dockerfile=dockerfile docker;
  Erlang=erlang erl; Elixir=elixir ex exs; Go=go golang;
  Handlebars=handlebars hbs html.hbs html.handlebars htmlbars; Haskell=haskell hs; INI=ini toml; Java=java jsp;
  JavaScript=javascript js jsx mjs cjs mjsx cjsx; JSON=json; Kotlin=kotlin kt kts; LaTeX=latex tex; Lisp=lisp;
  Lua=lua; Makefile=makefile mk mak make; Markdown=markdown md mkdown mkd; MATLAB=matlab; Nginx=nginx nginxconf;
  Objective-C=objectivec mm objc obj-c obj-c++ objective-c++; Perl=perl pl pm; PHP=php;
  PowerShell=powershell ps1 ps; Python=python py gyp ipython; R=r; Ruby=ruby rb gemspec podspec thor irb;
  Rust=rust rs; Scheme=scheme; SCSS=scss; Shell=shell; Smalltalk=smalltalk st; SQL=sql; Swift=swift;
  Plain text=plaintext text plain txt; Twig=twig craftcms; TL=typelanguage tl;
  TypeScript=typescript ts tsx mts cts mtsx ctsx; XML=xml html xhtml rss atom xjb xsd xsl plist wsf svg;
  YAML=yaml;`,
  { withName: false, lastWins: false },
)

/**
 * Web K (tweb src/codeLanguages.ts:4-963): Prism's languages by the name it writes, with their
 * aliases; the name's lower case is one too.
 */
const webKNames = table(
  `Markup=html xml svg mathml ssml atom rss; CSS; C-like=clike; Regex; JavaScript=js; ABAP; ABNF; ActionScript;
  Ada; Agda; AL; ANTLR4=g4; Apache Configuration=apacheconf; SQL; Apex; APL; AppleScript; AQL; C; C++=cpp;
  Arduino=ino; ARFF; ARM Assembly=armasm arm-asm; Bash=sh shell; YAML=yml; Markdown=md; Arturo=art; AsciiDoc=adoc;
  C#=csharp cs dotnet; ASP.NET (C#)=aspnet; 6502 Assembly=asm6502; Atmel AVR Assembly=asmatmel; AutoHotkey;
  AutoIt; AviSynth=avs; Avro IDL=avro-idl avdl; AWK=gawk; BASIC; Batch; BBcode=shortcode; BBj; Bicep; Birb; Bison;
  BNF=rbnf; BQN; Brainfuck; BrightScript; Bro; CFScript=cfc; ChaiScript; CIL; Cilk/C=cilkc cilk-c;
  Cilk/C++=cilkcpp cilk-cpp cilk; Clojure; CMake; COBOL; CoffeeScript=coffee; Concurnas=conc;
  Content-Security-Policy=csp; Cooklang; Ruby=rb; Crystal; CSV; CUE; Cypher; D; Dart; DataWeave; DAX; Dhall; Diff;
  Markup templating=markup-templating; Django/Jinja2=django jinja2; DNS zone file=dns-zone-file dns-zone;
  Docker=dockerfile; DOT (Graphviz)=dot gv; EBNF; EditorConfig; Eiffel; EJS=eta; Elixir; Elm; Lua;
  Embedded Lua templating=etlua; ERB; Erlang; Excel Formula=excel-formula xlsx xls; F#=fsharp; Factor; False;
  Firestore security rules=firestore-security-rules; Flow; Fortran; FreeMarker Template Language=ftl;
  GameMaker Language=gml gamemakerlanguage; GAP (CAS)=gap; G-code=gcode; GDScript; GEDCOM; gettext=po; Git; GLSL;
  GN=gni; GNU Linker Script=linker-script ld; Go; Go module=go-module go-mod; Gradle; GraphQL; Groovy; Less;
  Sass (SCSS)=scss; Textile; Haml; Handlebars=hbs mustache; Haskell=hs; Haxe; HCL; HLSL; Hoon;
  HTTP Public-Key-Pins=hpkp; HTTP Strict-Transport-Security=hsts; JSON=webmanifest; URI=url; HTTP; IchigoJam;
  Icon; ICU Message Format=icu-message-format; Idris=idr; .ignore=ignore gitignore hgignore npmignore;
  Inform 7=inform7; Ini; Io; J; Java; Scala; PHP; JavaDoc-like=javadoclike; JavaDoc;
  Java stack trace=javastacktrace; Jolie; JQ; TypeScript=ts; JSDoc; N4JS=n4jsd; JSON5; JSONP;
  JS stack trace=jsstacktrace; Julia; Keepalived Configure=keepalived; Keyman; Kotlin=kt kts; Kusto;
  LaTeX=tex context; Latte; Scheme; LilyPond=ly; Liquid; Lisp=emacs elisp emacs-lisp; LiveScript; LLVM IR=llvm;
  Log file=log; LOLCODE; Magma (CAS)=magma; Makefile; Mata; MATLAB; MAXScript; MEL; Mermaid; METAFONT; Mizar;
  MongoDB; Monkey; MoonScript=moon; N1QL; Nand To Tetris HDL=nand2tetris-hdl; Naninovel Script=naniscript nani;
  NASM; NEON; Nevod; nginx; Nim; Nix; NSIS; Objective-C=objectivec objc; OCaml; Odin; OpenCL; OpenQasm=qasm; Oz;
  PARI/GP=parigp; Parser; Pascal=objectpascal; Pascaligo; PATROL Scripting Language=psl; PC-Axis=pcaxis px;
  PeopleCode=pcode; Perl; PHPDoc; PlantUML=plant-uml; PL/SQL=plsql; PowerQuery=pq mscript; PowerShell; Processing;
  Prolog; PromQL; .properties=properties; Protocol Buffers=protobuf; Stylus; Twig; Pug; Puppet; PureBasic=pbfasm;
  Python=py; Q#=qsharp qs; Q (kdb+ database)=q; QML; Qore; R; Racket=rkt; Razor C#=cshtml razor; React JSX=jsx;
  React TSX=tsx; Reason; Rego; Ren'py=renpy rpy; ReScript=res; reST (reStructuredText)=rest; Rip; Roboconf;
  Robot Framework=robotframework robot; Rust; SAS; Sass (Sass)=sass;
  Shell session=shell-session sh-session shellsession; Smali; Smalltalk; Smarty; SML=smlnj;
  Solidity (Ethereum)=solidity sol; Solution file=solution-file sln; Soy (Closure Template)=soy;
  Splunk SPL=splunk-spl; SQF: Status Quo Function (Arma 3)=sqf; Squirrel; Stan; Stata Ado=stata;
  Structured Text (IEC 61131-3)=iecst; SuperCollider=sclang; Swift; Systemd configuration file=systemd;
  T4 templating=t4-templating; T4 Text Templates (C#)=t4-cs t4; VB.Net=vbnet; T4 Text Templates (VB)=t4-vb; TAP;
  Tcl; Template Toolkit 2=tt2; TOML; Tremor=trickle troy; TypoScript=tsconfig; UnrealScript=uscript uc;
  UO Razor Script=uorazor; V; Vala; Velocity; Verilog; VHDL; vim; Visual Basic=visual-basic vb vba; WarpScript;
  WebAssembly=wasm; Web IDL=web-idl webidl; WGSL; Wiki markup=wiki; Wolfram language=wolfram mathematica nb wl;
  Wren; Xeora=xeoracube; Xojo (REALbasic)=xojo; XQuery; YANG; Zig;`,
  { withName: true, lastWins: true },
)

/** Android's own names (MessageObject.java:1131-1201), by the word without its marks and a final "lang". */
const androidNames: Readonly<Record<string, string>> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  objc: 'Objective-C',
  objectivec: 'Objective-C',
  md: 'Markdown',
  markdown: 'Markdown',
  rb: 'Ruby',
  ruby: 'Ruby',
  py: 'Python',
  python: 'Python',
  vbnet: 'VB.NET',
  gdscript: 'GDScript',
  bbcode: 'BBCode',
  actionscript: 'ActionScript',
  autohotkey: 'AutoHotKey',
  cpp: 'C++',
  csharp: 'C#',
  cs: 'C#',
  fsharp: 'F#',
  aspnet: 'ASP.NET',
  tlb: 'TL-B',
  func: 'FunC',
}

/** The words Android writes in capitals as the sender typed them (MessageObject.java:1167-1197). */
const androidCapitals = new Set(
  'http html css scss less asm nasm wasm xml yaml yml php json json5 r ini glsl hlsl csv cobol jsx tsx tl sql qml sass matlab jsonp'.split(
    ' ',
  ),
)

/** Swift's String.capitalized (CFStringCapitalize): each letter after a cased letter small, any other capital. */
function capitalized(text: string): string {
  let out = ''
  let afterCased = false
  for (const ch of text) {
    out += afterCased ? ch.toLowerCase() : ch.toUpperCase()
    afterCased = /\p{Cased}/u.test(ch) || (afterCased && /\p{Case_Ignorable}/u.test(ch))
  }
  return out
}

/**
 * A code block's language as each app writes it (SkinTokens.code.language); null: the app writes
 * the header of a block without a language (Web K's "copy" for one it does not know).
 */
export const codeLanguage = {
  /** Web A: its name ("js" as "JavaScript", "txt" as "Plain text"), else the word (codeLanguages.ts:108-117). */
  web: (language: string): string | null => webANames.get(language.toLowerCase()) ?? language,
  /** Web K: Prism's name, or "copy" for a language it does not know (wrapRichText.ts:349-355). */
  webk: (language: string): string | null => webKNames.get(language.toLowerCase()) ?? null,
  /** Desktop: the word as it is (text.cpp:1686-1695). */
  desktop: (language: string): string | null => language,
  /**
   * Android (MessageObject.java:1129-1204): its own names, some words in capitals, else the word
   * with only its first letter capital ("golang" as "Golang").
   */
  android: (language: string): string | null => {
    const word = language.toLowerCase().replace(/\W|lang$/g, '')
    const name = androidNames[word]
    if (name) return name
    if (androidCapitals.has(word)) return language.toUpperCase()
    return language.slice(0, 1).toUpperCase() + language.slice(1).toLowerCase()
  },
  /** iOS: each word capitalized, "json" as "Json" (StringWithAppliedEntities.swift:403). */
  ios: (language: string): string | null => capitalized(language),
}

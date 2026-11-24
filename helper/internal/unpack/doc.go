// Package unpack takes apart the packed files an xDesign update may come in
// (docs/plan/07-server-install-update.md section 6). The update check of the website and
// `xdesign update` hand the file to [Resolve] and then work with the payload it finds, the
// xdesign file, exactly as they work with a file that came that way. internal/release itself
// stays standard library only: the archive libraries (ulikunitz/xz, klauspost/compress for
// zstd) are used here, nowhere else (depguard rule archives-only-in-unpack). Copied from
// xWriter's internal/release/unpack as it is, without rar; the release archive is xWriter's
// older layout (one folder with VERSION and MANIFEST.sha256), which no xDesign release has.
//
// # What is accepted
//
// A zip, tar, tar.gz, tar.xz or tar.zst file that holds the update, and one file packed
// alone with gzip, xz or zstd ("xdesign.xz"). The update is an xdesign file (an ELF or a PE file)
// or a release archive; a packed file holds one of them within two layers, so a zip with
// the release archive inside works and a zip inside a zip does not. A gzip tar file whose
// one top folder holds VERSION and MANIFEST.sha256 is the release archive itself, and a
// program is its own payload: neither is unpacked.
//
// The format is read from the first bytes ([Sniff]), never from the name. Names only choose
// between several updates in one container: those built for this server first (the ELF
// machine type in the program's header, or amd64 or arm64 in the name), then release archives
// before bare programs, then the names a release gives its files.
//
// # What is refused
//
// Resolve returns an [*Error] with a sentence for the owner, and a [Reason] to tell the cases
// apart, for: rar, 7z and bzip2 files; passwords; archives in several files; a release folder
// packed again (its files may have lost their modes, and the signed SHA256SUMS covers only the
// release archive and the program); a container with no update or with several; an update
// packed more than once; files that ask for more than the [Limits] allow; and damaged files,
// links, devices and names that leave their folder. Any other error is a failure of the file
// system or the context, not of the file.
//
// # Calling Resolve
//
//	found, err := unpack.Resolve(ctx, file, size, scratch, unpack.Options{
//		Name: "xdesign-1.2.0-linux-amd64.zip", Path: path, Arch: "amd64",
//		Limits: unpack.Limits{Payload: 512 << 20},
//	})
//
// file is an io.ReaderAt (an *os.File) of size bytes, scratch an existing folder. found.Kind
// is release.KindArchive or release.KindBinary. When the file is itself the payload,
// found.Path is Options.Path and found.Unpacked is false; otherwise the payload is a new
// 0600 file called .unpacked-<random> in scratch that the caller renames, uses and removes.
// found.Name, Size and SHA256 describe the payload (the checks of the update run on it, and
// SHA256SUMS lists it by that name), found.Layers say what was opened ("zip"), and
// found.Sums and found.Sig are the SHA256SUMS and SHA256SUMS.sig that lay next to the payload
// in the container. Options.Before is called before the first byte is written, with the
// size the payload declares, so the caller can check the free disk space.
//
// # How it works
//
//  1. An ELF file is a program already; an unknown format is refused. A gzip, xz or zstd
//     file is opened and its first 512 bytes decide: an ELF file is a program packed alone
//     (its stream is copied out), a tar header makes it a tar container, anything else is
//     refused.
//  2. A container (tar, zip) is looked through in one pass: its entries at depth one, or
//     at depth two below a single top folder, with their first bytes. SHA256SUMS and
//     SHA256SUMS.sig are kept (64 KiB each at most). A gzip tar file whose top folder holds
//     VERSION and MANIFEST.sha256 is the release archive itself: the pass ends there.
//     Any other container with that layout is a repacked release folder.
//  3. The candidates are the entries that start with the ELF or the gzip magic, and a gzip
//     entry counts only when it holds a tar file with a top folder. A gzip entry that is
//     something else, and any other packed file, shows that the update was packed twice.
//  4. A second pass copies the chosen entry to scratch through a limit reader, hashing it, and
//     checks that it is what the first pass saw.
//
// # Limits
//
// A payload of at most Limits.Payload bytes (512 MiB by default; the website and the command
// choose); 1000 entries; at most 4 GiB read out of a compressed tar; clean relative names
// only; no links, devices or encrypted entries; every copy through a limit reader, so a file
// that lies about its sizes cannot fill the disk; zstd windows of at most 128 MiB; and an xz
// stream whose first LZMA2 block asks for a dictionary above 256 MiB, which the xz library
// would allocate without a question, is refused before it is handed over (only the first
// block is looked at, and an xz file must be one stream, with nothing after it). A zip's
// directory is read within a budget of 8 MiB, because archive/zip keeps every entry in
// memory. The caller's context ends any work: every read of the file asks it first.
package unpack

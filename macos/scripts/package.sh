#!/bin/bash
set -euo pipefail

macos_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
web_dist="$macos_dir/../web/dist"
output_dir="$macos_dir/dist"
app="$output_dir/Writing Studio.app"

if [[ ! -f "$web_dist/index.html" || ! -d "$web_dist/assets" ]]; then
    printf '%s\n' 'Run the web build first. Expected web/dist/index.html and web/dist/assets.' >&2
    exit 1
fi

unexpected="$(/usr/bin/find "$web_dist" ! -type f ! -type d -print -quit)"
if [[ -n "$unexpected" ]]; then
    printf '%s\n' 'web/dist must contain only regular files and directories.' >&2
    exit 1
fi

swift build --package-path "$macos_dir" --configuration release
bin_dir="$(swift build --package-path "$macos_dir" --configuration release --show-bin-path)"
mkdir -p "$output_dir"
staging="$(mktemp -d "$output_dir/.package.XXXXXX")"
trap 'rm -rf "$staging"' EXIT
bundle="$staging/Writing Studio.app"
/bin/mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources"
install -m 0644 "$macos_dir/Info.plist" "$bundle/Contents/Info.plist"
install -m 0755 "$bin_dir/WritingStudio" "$bundle/Contents/MacOS/WritingStudio"
/usr/bin/ditto --norsrc --noextattr --noqtn "$web_dist" "$bundle/Contents/Resources/Web"
/usr/bin/plutil -lint "$bundle/Contents/Info.plist"

if [[ -e "$app" || -L "$app" ]]; then
    mv "$app" "$staging/previous.app"
fi
if ! mv "$bundle" "$app"; then
    if [[ -e "$staging/previous.app" || -L "$staging/previous.app" ]]; then
        mv "$staging/previous.app" "$app"
    fi
    exit 1
fi
printf '%s\n' "$app"

#!/usr/bin/env bash
set -euo pipefail

src_root="${1:-"$HOME/.pi/agent/skills"}"
dest_root="${2:-"$HOME/.codex/skills"}"

if [[ ! -d "$src_root" ]]; then
  echo "Source skills directory does not exist: $src_root" >&2
  exit 1
fi

mkdir -p "$dest_root"

created=0
skipped=0
conflicts=0
removed=0
kept_foreign=0

build_link_name() {
  basename "$2"
}

# Returns 0 if the symlink $name -> $target is a valid, up-to-date link for a
# skill that still exists in the source root.
is_current_link() {
  local name="$1"
  local target="$2"

  # Target must live inside the source root.
  case "$target" in
    "$src_root"/*) ;;
    *) return 1 ;;
  esac

  # Target must still exist and be a skill directory.
  [[ -d "$target" && -f "$target/SKILL.md" ]] || return 1

  # The link name must match the current naming convention.
  local expected
  if expected="$(build_link_name "$src_root" "$target")"; then
    [[ "$expected" == "$name" ]]
  else
    return 1
  fi
}

# Cleanup phase: remove stale symlinks from the destination, i.e. links whose
# target was deleted, renamed, or is no longer a skill. Live symlinks pointing
# outside the source root are kept (not managed by this script). Real
# directories are never touched.
while IFS= read -r -d '' link_path; do
  name="$(basename "$link_path")"
  target="$(readlink "$link_path")"

  if is_current_link "$name" "$target"; then
    continue
  fi

  # Keep live symlinks that point outside the source root (not managed here).
  case "$target" in
    "$src_root"/*) ;;
    *)
      if [[ -e "$target" ]]; then
        echo "keep  $name -> $target (outside source root)"
        kept_foreign=$((kept_foreign + 1))
        continue
      fi
      ;;
  esac

  rm "$link_path"
  echo "remove  $name -> $target"
  removed=$((removed + 1))
done < <(find "$dest_root" -maxdepth 1 -type l -print0 | sort -z)

# Sync phase: create missing links.
while IFS= read -r -d '' skill_md; do
  skill_dir="$(dirname "$skill_md")"
  if ! link_name="$(build_link_name "$src_root" "$skill_dir")"; then
    echo "Skipping path outside source root: $skill_dir" >&2
    conflicts=$((conflicts + 1))
    continue
  fi

  dest_path="$dest_root/$link_name"

  if [[ -L "$dest_path" ]]; then
    current_target="$(readlink "$dest_path")"
    if [[ "$current_target" == "$skill_dir" ]]; then
      echo "skip  $link_name -> $skill_dir"
      skipped=$((skipped + 1))
    else
      echo "conflict symlink exists: $dest_path -> $current_target, expected $skill_dir" >&2
      conflicts=$((conflicts + 1))
    fi
    continue
  fi

  if [[ -e "$dest_path" ]]; then
    echo "conflict path exists and is not a symlink: $dest_path" >&2
    conflicts=$((conflicts + 1))
    continue
  fi

  ln -s "$skill_dir" "$dest_path"
  echo "link  $link_name -> $skill_dir"
  created=$((created + 1))
done < <(find "$src_root" -type f -name SKILL.md -print0 | sort -z)

echo
echo "Created: $created"
echo "Skipped: $skipped"
echo "Removed: $removed"
echo "Kept (outside source): $kept_foreign"
echo "Conflicts: $conflicts"

if [[ "$conflicts" -gt 0 ]]; then
  exit 2
fi

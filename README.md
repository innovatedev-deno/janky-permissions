# janky-permissions

POC for simplifying permissions with Deno

## What does this do?

When used to run a script, this spawns a child deno process with permissions from a manifest file. It will look for a key matching the filename of the last argument that is a `.ts` file.

## Motivation

denoland/deno#12763

We need a better model for documenting and using permissions than embedding them in tasks or breaking the entire security model of deno and using `-A`

* [x] Manifest file
* [x] Support Multiple scripts/entrypoints in same project
* [x] Run using documented permissions
* [x] Help build permission strings for legacy projects
* [ ] Audit mode to identify needed permissions
* [ ] Examples and tests to show how this could make things better
* [ ] add to deno.land
* [ ] Convice Deno team to do something about this

Ideally this would work something like this:

```bash
deno run --permissions dev.ts
```

or

```bash
deno run --permissions=permissions.json dev.ts
```

You would opt into using this simplified model as there are some scenarios you may not want this. But you could much more easily stop using `-A` for so many things.

## Usage

> The `-A` allows all permissions! You shouldn't use it! No, really, really, you shouldn't use it! Should you use that here? NO!
> If this script ever changed to do something you don't want, you wouldn't have the benefit of Deno's security as you would have bypassed it all.

```bash
deno run --allow-read=deno.jsonc --allow-run=$HOME/.dneo/bin/deno --allow-net=deno.land --allow-env=HOME https://raw.githubusercontent.com/innovatedev-deno/janky-permissions/main/mod.ts main.ts
```

Even with the warning, and providing the fully expanded version, I bet there will be someone that still uses this with `-A` instead. Litterally a script that's only purpose is to get people to stop using `-A` with deno. That is the problem with where things are at right now.

### Manifest search order

Locations searched in order:

1. deno.jsonc
2. deno.json
3. permissions.jsonc
4. permissions.json

# Example

This is an example for Fresh. Even fresh which is maintained by the Deno team uses `-A` - and creating a manifest for the permissions it needs, it is understandable why. This makes it a great case study for how to improve things. Fresh could ship with a `permissions.json` file that declared the permissions needed for each entry point and rather than recommending insecure defaults, `-A`. Then we can start mitigating the risks that deno developers are being conditioned to accept.

```json
{
  "permissions": {
    "main.ts": {
      "read": [".", "///<cache_path>/esbuild/bin/@esbuild-linux-x64@0.19.4"],
      "env": true,
      "net": [
        "0.0.0.0:8000",
        "deno.land",
        "esm.sh",
      ],
      "run": [
        "///<cache_path>/esbuild/bin/@esbuild-linux-x64@0.19.4",
      ],
    },
    "dev.ts": {
      "read": [
        ".",
        "///<cache_path>/fresh/latest.json",
        "///<cache_path>/esbuild/bin/@esbuild-linux-x64@0.19.4",
        "///<exec_path>"
      ],
      "run": [
        "///<cache_path>/esbuild/bin/@esbuild-linux-x64@0.19.4",
        "///<exec_path>"
      ],
      "write": [
        "///<cache_path>/fresh",
        "fresh.gen.ts"
      ],
      "env": true,
      "net": [
        "0.0.0.0:8000",
        "deno.land",
        "esm.sh",
        "dl.deno.land",
      ]
    }
  }
}
```

## Format

Setting `permission` to `true` is the same as specifying a permission with with no limits (all). e.g. `--allow-read`. You shouldn't do this in practice. The limits are there to protect you. This can be almost as bad as using `-A` for the security of your systems. It is far better to document what is needed for each permission and only use this when necessary (ideally with a documented reason for why it is necessary).

```
{
  "permissions": {
    "script.ts": {
      "permission-name": true | [ "value1", "value2", ... ]
    }
  }
}
```

## Special Paths

Linux only. May want to mix with [deno_dirs](https://deno.land/x/dir)

```
///<exec_path> - $HOME/.deno/bin/deno - Deno.execPath() requires this just to get the path.
///<cache_path> - $HOME/.cache - Fresh drops a file in the cache folder
```

There needs to be something that works for these kinds of use cases, especially <exec_path> as there doesn't really seem to be a sane cross platform way to allow using that without resorting to `--allow-read`.

## importing

When imported, this script will show missing permissions from the manifest as well as a complete permission string to use with `tasks` in your deno config if you would rather go that route.

e.g. Fresh `dev.ts`

```typescript
#!/usr/bin/env -S deno run -A --watch=static/,routes/
import "https://raw.githubusercontent.com/innovatedev-deno/janky-permissions/main/mod.ts";
import dev from "$fresh/dev.ts";
import config from "./fresh.config.ts";


import "$std/dotenv/load.ts";

await dev(import.meta.url, "./main.ts", config);
```

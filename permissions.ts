import { parse } from "$std/jsonc/mod.ts";

const key = Deno.args.find((arg) => arg.endsWith(".ts"));

function getPermissionsFromManifest(manifestPath?: string) {
  for (
    const permissionsManifest of manifestPath ? [manifestPath] : [
      "deno.jsonc",
      "deno.json",
      "permissions.jsonc",
      "permissions.json",
    ]
  ) {
    try {
      const fileExists = Deno.statSync(permissionsManifest);

      if (fileExists) {
        console.log(`Found permissions manifest: ${permissionsManifest}`);
        const data = parse(Deno.readTextFileSync(permissionsManifest)) as {
          permissions?: Record<string, Record<string, string[]>>;
        };
        if (
          typeof data === "object" && data.permissions && key &&
          key in data.permissions
        ) {
          return data.permissions[key];
        }

        console.log(`No permissions found in ${permissionsManifest}`);
        return undefined;
      }
    } catch (e) {}
  }
}

const permissions = getPermissionsFromManifest();

if (!permissions) {
  console.log("No permissions found in manifest");
  Deno.exit(1);
}

const makePermissionString = (permission: string, value: string[]) => {
  return `--allow-${permission}${
    value
      ? `=${
        (Array.isArray(value) ? value : [value]).map((v: string) => {
          v = v === "///<exec_path>"
            ? `${Deno.env.get("HOME")}/.deno/bin/deno`
            : v.startsWith("///<cache_path>")
            ? v.replace("///<cache_path>", `${Deno.env.get("HOME")}/.cache`)
            : v;
          return v;
        }).join(",")
      }`
      : ""
  }`;
};

const perms = Object.entries(permissions).map(
  ([permission, value]: any) => {
    return [
      permission,
      value,
    ];
  },
);

const fullPermissionStrings: string[] = [];
const missingPermissionStrings: string[] = [];
let missingPermission = false;

for (const [permission, value] of perms) {
  let hasPermission = false;

  if (!permission) continue;
  if (!import.meta.main) {
    if (!value) {
      hasPermission =
        (Deno.permissions.querySync({ name: permission })).state ===
          "granted";
      if (!hasPermission) {
        missingPermission = true;
        missingPermissionStrings.push(
          makePermissionString(permission, value),
        );
      }
    } else {
      for (let v of value) {
        v = v === "///<exec_path>"
          ? `${Deno.env.get("HOME")}/.deno/bin/deno`
          : v;

        const hasPerm = (Deno.permissions.querySync(
          permission === "env"
            ? {
              name: permission,
              variable: v,
            }
            : permission === "run"
            ? {
              name: permission,
              command: v,
            }
            : permission === "net"
            ? {
              name: permission,
              host: v,
            }
            : permission === "sys"
            ? {
              name: permission,
              kind: v,
            }
            : permission === "hrtime"
            ? {
              name: permission,
            }
            : { name: permission, path: v } as any,
        )).state === "granted";

        if (!hasPerm) {
          hasPermission = false;
          missingPermission = true;
          missingPermissionStrings.push(
            makePermissionString(permission, v),
          );
        }
      }
    }
  }
  fullPermissionStrings.push(makePermissionString(permission, value));
}

if (!import.meta.main) {
  console.log("\nfull permissions string\n");
  console.log(fullPermissionStrings.join(" "));

  if (missingPermission) {
    console.log("\nMissing permissions:\n");
    console.log(missingPermissionStrings.join("\n"));
  } else {
    console.log("\nAll permissions granted\n");
  }
} else {
  const args = [
    "run",
    ...fullPermissionStrings,
    ...Deno.args,
  ];
  console.log(args);
  const command = new Deno.Command(`${Deno.env.get("HOME")}/.deno/bin/deno`, {
    args,
  });

  const child = command.spawn();
  await child.status;
}

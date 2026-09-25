{
  description = "Puzzle Craze — React, TypeScript, and pnpm development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [ nodejs_24 pnpm_11 typescript-language-server ];

            shellHook = ''
              export PATH="$PWD/node_modules/.bin:$PATH"
              echo "Puzzle Craze · Node $(node --version) · pnpm $(pnpm --version)"
              echo "Run pnpm install, then pnpm dev"
            '';
          };
        });
    };
}
